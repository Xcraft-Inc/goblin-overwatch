'use strict';

const path = require('path');
const {ArrayCollector, crypto} = require('xcraft-core-utils');
const xFs = require('xcraft-core-fs');
const xHost = require('xcraft-core-host');
const {OrderedMap} = require('immutable');
const {appId, variantId} = xHost;
const {setTimeout: setTimeoutAsync} = require('node:timers/promises');
const locks = require('xcraft-core-utils/lib/locks');
const pushErrorLock = locks.getMutex;

const goblinName = path.basename(module.parent.filename, '.js');
const Goblin = require('xcraft-core-goblin');

let backends = new Map();

// Define initial logic values
const logicState = {
  id: goblinName,
  mode: 'debounce', // or manual
  errors: {exception: OrderedMap(), hazard: OrderedMap()},
  channels: {discord: [], mail: []},
  agent: 'ana',
  appInfo: null,
};

/*****************************************************/

function getErrorName(error) {
  return error.id || crypto.sha256(JSON.stringify(error.err));
}

const onCollect = async function (collected, resp) {
  await resp.command.sendAsync(`${goblinName}.push-errors`, {
    errorsCollected: collected,
  });
};

let collector;

/*****************************************************/

// Define logic handlers according rc.json
const logicHandlers = {
  init: (state, action) => {
    return state
      .set('id', action.get('id'))
      .set('mode', action.get('mode'))
      .set('channels', action.get('channels'))
      .set('agent', action.get('agent'))
      .set('appInfo', action.get('appInfo'));
  },
  change: (state, action) => {
    return state.set(action.get('path'), action.get('newValue'));
  },
  push: (state, action) => {
    return state.push(action.get('path'), action.get('value'));
  },
};

Goblin.registerQuest(goblinName, 'init', function (
  quest,
  debounceTime = 30000
) {
  const overwatchConfig = require('xcraft-core-etc')().load('goblin-overwatch');

  if (overwatchConfig.mode === 'debounce') {
    if (!overwatchConfig.channels) {
      throw new Error(
        `Define at least one discord or mail channel in your app.json for goblin overwatch !\nFor example : \n{\n\tdiscord:[],\n\tmail:['overwatch@company.com']\n}`
      );
    }
    const backendsPath = path.join(__dirname, 'backends');
    // Filter available channels with at least one "contact"
    // And call require and constructor
    xFs
      .ls(backendsPath, /\.js$/)
      .filter(
        (mod) => overwatchConfig.channels[mod.replace(/\.js$/, '')].length > 0
      )
      .forEach((mod) =>
        backends.set(
          mod.replace(/\.js$/, ''),
          new (require(path.join(backendsPath, mod)))()
        )
      );
  } else if (overwatchConfig.mode === 'manual') {
    debounceTime = 0;
  }

  let appInfo = variantId ? `${appId}@${variantId}` : appId;

  collector = new ArrayCollector(
    quest.newResponse(),
    debounceTime,
    onCollect,
    false,
    true
  );

  quest.do({
    mode: overwatchConfig.mode,
    channels: overwatchConfig.channels,
    agent: overwatchConfig.agent,
    appInfo,
  });
});

Goblin.registerQuest(goblinName, 'change', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'push', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'exception', function (quest, error) {
  if (!collector) {
    return;
  }
  const errorName = getErrorName(error);
  collector.grab(`exception.${errorName}`, [error]);
});

Goblin.registerQuest(goblinName, 'hazard', function (quest, error) {
  if (!collector) {
    return;
  }
  const errorName = getErrorName(error);
  collector.grab(`hazard.${errorName}`, [error]);
});

Goblin.registerQuest(goblinName, 'push-errors', async function (
  quest,
  errorsCollected
) {
  // Add a lock here to ensure one send-errors at a time
  // await pushErrorLock.lock(goblinName);
  // quest.defer(() => pushErrorLock.unlock(goblinName));
  let state;
  for (let [source, errors] of Object.entries(errorsCollected)) {
    // don't push errors from goblin-overwatch
    errors = errors.filter(
      (error) =>
        error && (!error._xcraftOverwatch || error.goblin.id !== goblinName)
    );

    if (errors.length === 0) {
      continue;
    }

    state = quest.goblin.getState();

    if (!state.get(`errors.${source}`)) {
      const firstError = errors.shift();
      firstError.time = [firstError.time];
      if (firstError._xcraftOverwatch) {
        for (const key in firstError.goblin) {
          firstError.goblin[key] = [firstError.goblin[key]];
        }
      } else {
        firstError.mod = [firstError.mod];
      }
      await quest.me.change({
        path: `errors.${source}`,
        newValue: firstError,
      });
    }

    for (const error of errors) {
      await quest.me.push({path: `errors.${source}.time`, value: error.time});
      if (error._xcraftOverwatch) {
        for (const key in error.goblin) {
          await quest.me.push({
            path: `errors.${source}.goblin.${key}`,
            value: error.goblin[key],
          });
        }
      } else {
        await quest.me.push({path: `errors.${source}.mod`, value: error.mod});
      }
    }
  }
  state = quest.goblin.getState();
  if (state.get('mode') === 'debounce') {
    await quest.me.prepareSendErrors();
  }
});

Goblin.registerQuest(goblinName, 'prepare-send-errors', async function (quest) {
  let promises = [];

  for (const [backendKey, _] of backends) {
    promises.push(
      quest.me.sendErrorsByBackend({
        backendKey,
        mode: 'exception',
      })
    );
  }

  await Promise.all(promises);
  promises = [];

  for (const [backendKey, _] of backends) {
    promises.push(
      quest.me.sendErrorsByBackend({
        backendKey,
        mode: 'hazard',
      })
    );
  }

  await Promise.all(promises);

  await quest.me.clearAllErrors();
});

Goblin.registerQuest(goblinName, 'send-errors-by-backend', async function (
  quest,
  backendKey,
  mode
) {
  const state = quest.goblin.getState();
  const channels = state.get('channels');
  const appInfo = state.get('appInfo');
  const agent = state.get('agent');
  const backend = backends.get(backendKey);
  for (const channel of channels.get(backendKey, [])) {
    await quest.me.sendErrors({
      backend,
      channel,
      errors: state.get(`errors.${mode}`),
      mode,
      appInfo,
      agent,
    });
  }
});

Goblin.registerQuest(goblinName, 'send-errors', async function (
  quest,
  backend,
  channel,
  errors,
  mode,
  appInfo,
  agent
) {
  if (errors.size === 0) {
    return;
  }
  const {log} = quest;
  const retryAfter = await backend.send(
    channel,
    errors,
    mode,
    appInfo,
    agent,
    log
  );
  if (retryAfter) {
    // Transform sec to ms + 10 ms
    await setTimeoutAsync(retryAfter * 1000 + 10);
    await quest.me.sendErrors({
      backend,
      channel,
      errors,
      mode,
      appInfo,
      agent,
    });
  }
});

Goblin.registerQuest(goblinName, 'get-all-errors', async function (quest) {
  const state = quest.goblin.getState();
  const errors = state.get('errors');
  await quest.me.clearAllErrors();
  return errors;
});

Goblin.registerQuest(goblinName, 'clear-all-errors', async function (quest) {
  await quest.me.change({
    path: 'errors',
    newValue: {
      exception: OrderedMap(),
      hazard: OrderedMap(),
    },
  });
});

const dispose = () => {
  collector?.cancel();
  collector = null;
};

module.exports = Goblin.configure(goblinName, logicState, logicHandlers, {
  dispose,
});
Goblin.createSingle(goblinName);
