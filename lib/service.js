const path = require('path');
const debounce = require('lodash/debounce');
const busClient = require('xcraft-core-busclient').getGlobal();
const {ArrayCollector} = require('xcraft-core-utils');
const resp = busClient.newResponse('overwatch', 'token');
const xFs = require('xcraft-core-fs');
const xHost = require('xcraft-core-host');
const {appId, variantId} = xHost;

const goblinName = path.basename(module.parent.filename, '.js');
const Goblin = require('xcraft-core-goblin');

let backends = new Map();

// Define initial logic values
const logicState = {
  id: goblinName,
  mode: 'debounce', // or manual
  firstError: true,
  errors: {exception: [], hazard: []},
  channels: {discord: [], mail: []},
  agent: 'ana',
  appInfo: null,
};

/*****************************************************/

const createDebounce = (debounceTime) => {
  return debounce(() => {
    resp.events.send(`${goblinName}.sendErrorsDebounced`, {});
  }, debounceTime);
};

let sendErrorsDebounce = () => {};

const onCollect = function* (collected, resp, next) {
  for (const [source, errors] of Object.entries(collected)) {
    yield resp.command.send(
      `${goblinName}.push-errors`,
      {source, errors},
      next
    );
  }
};

const collector = new ArrayCollector(2000, onCollect);

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
  concat: (state, action) => {
    return state.concat(action.get('path'), action.get('value'));
  },
};

Goblin.registerQuest(goblinName, 'init', function (
  quest,
  debounceTime = 60000
) {
  const overwatchConfig = require('xcraft-core-etc')().load('goblin-overwatch');

  if (overwatchConfig.mode == 'debounce') {
    if (!overwatchConfig.channels) {
      throw new Error(
        `Define at least one discord or mail channel in your app.json for goblin overwatch !\nFor example : \n{\n\tdiscord:[],\n\tmail:['overwatch@company.com']\n}`
      );
    }
    quest.goblin.defer(
      quest.sub('*::overwatch.sendErrorsDebounced', function* (_, {msg, resp}) {
        yield resp.cmd(`${goblinName}.send-errors`, {});
      })
    );
    sendErrorsDebounce = createDebounce(debounceTime);
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
  }

  let appInfo = variantId ? `${appId}@${variantId}` : appId;

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

Goblin.registerQuest(goblinName, 'concat', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'exception', function* (quest, error) {
  collector.grab('exception', [error]);
});

Goblin.registerQuest(goblinName, 'hazard', function* (quest, error) {
  collector.grab('hazard', [error]);
});

Goblin.registerQuest(goblinName, 'push-errors', function* (
  quest,
  errors,
  source
) {
  errors = errors.filter(
    (error) => !error._xcraftOverwatch || error.goblin.id !== goblinName
  );
  if (errors.length === 0) {
    return;
  }
  yield quest.me.concat({path: `errors.${source}`, value: errors});
  const state = quest.goblin.getState();
  if (state.get('mode') === 'debounce') {
    if (state.get('firstError')) {
      yield quest.me.sendErrors();
      yield quest.me.change({path: 'firstError', newValue: false});
    } else {
      sendErrorsDebounce();
    }
  }
});

Goblin.registerQuest(goblinName, 'send-errors', function* (quest) {
  const state = quest.goblin.getState();
  const {log} = quest;
  for (const error of state.get('errors.exception')) {
    for (const [key, backend] of backends) {
      yield backend.send(
        state.get('channels'),
        error,
        'exception',
        state.get('appInfo'),
        state.get('agent'),
        log
      );
    }
  }

  for (const error of state.get('errors.hazard')) {
    for (const [key, backend] of backends) {
      yield backend.send(
        quest,
        error,
        'hazard',
        state.get('appInfo'),
        state.get('agent'),
        log
      );
    }
  }
  // Reset first error to true once with function debounce executed
  yield quest.me.change({path: 'firstError', newValue: true});
  // Clear errors who has been sent
  yield quest.me.change({
    path: 'errors',
    newValue: {exception: [], hazard: []},
  });
});

Goblin.registerQuest(goblinName, 'get-all-errors', function* (quest, next) {
  const state = quest.goblin.getState();
  const errors = state.get('errors');
  yield quest.me.change({
    path: 'errors',
    newValue: {exception: [], hazard: []},
  });
  return errors;
});

module.exports = Goblin.configure(goblinName, logicState, logicHandlers);
Goblin.createSingle(goblinName);
