const path = require('path');
const {ArrayCollector, crypto} = require('xcraft-core-utils');
const xFs = require('xcraft-core-fs');
const xHost = require('xcraft-core-host');
const {OrderedMap} = require('immutable');
const {appId, variantId} = xHost;

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
  const {err} = error;
  return crypto.sha256(JSON.stringify(err));
}

let onCollect = function* (collected, resp, next) {
  for (const [source, errors] of Object.entries(collected)) {
    yield resp.command.send(
      `${goblinName}.push-errors`,
      {source, errors},
      next
    );
  }
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

Goblin.registerQuest(goblinName, 'init', function (quest, debounceTime = 2000) {
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

  collector = new ArrayCollector(debounceTime, onCollect, false);

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
  const errorName = getErrorName(error);
  collector.grab(`exception.${errorName}`, [error]);
});

Goblin.registerQuest(goblinName, 'hazard', function (quest, error) {
  const errorName = getErrorName(error);
  collector.grab(`hazard.${errorName}`, [error]);
});

Goblin.registerQuest(goblinName, 'push-errors', function* (
  quest,
  errors,
  source
) {
  // don't push errors from goblin-overwatch
  errors = errors.filter(
    (error) =>
      error && (!error._xcraftOverwatch || error.goblin.id !== goblinName)
  );

  if (errors.length === 0) {
    return;
  }

  const state = quest.goblin.getState();
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
    yield quest.me.change({
      path: `errors.${source}`,
      newValue: firstError,
    });
  }

  for (const error of errors) {
    yield quest.me.push({path: `errors.${source}.time`, value: error.time});
    if (error._xcraftOverwatch) {
      for (const key in error.goblin) {
        yield quest.me.push({
          path: `errors.${source}.goblin.${key}`,
          value: error.goblin[key],
        });
      }
    } else {
      yield quest.me.push({path: `errors.${source}.mod`, value: error.mod});
    }
  }

  if (state.get('mode') === 'debounce') {
    yield quest.me.sendErrors();
  }
});

Goblin.registerQuest(goblinName, 'send-errors', function* (quest) {
  const state = quest.goblin.getState();
  const {log} = quest;

  for (const key of state.get('errors.exception').keys()) {
    for (const [_, backend] of backends) {
      yield backend.send(
        state.get('channels'),
        state.get(`errors.exception.${key}`),
        'exception',
        state.get('appInfo'),
        state.get('agent'),
        log
      );
    }
  }

  for (const key of state.get('errors.hazard').keys()) {
    for (const [_, backend] of backends) {
      yield backend.send(
        state.get('channels'),
        state.get(`errors.hazard.${key}`),
        'hazard',
        state.get('appInfo'),
        state.get('agent'),
        log
      );
    }
  }

  yield quest.me.clearAllErrors();
});

Goblin.registerQuest(goblinName, 'get-all-errors', function* (quest, next) {
  const state = quest.goblin.getState();
  const errors = state.get('errors');
  yield quest.me.clearAllErrors();
  return errors;
});

Goblin.registerQuest(goblinName, 'clear-all-errors', function* (quest, next) {
  yield quest.me.change({
    path: 'errors',
    newValue: {
      exception: OrderedMap(),
      hazard: OrderedMap(),
    },
  });
});

module.exports = Goblin.configure(goblinName, logicState, logicHandlers);
Goblin.createSingle(goblinName);
