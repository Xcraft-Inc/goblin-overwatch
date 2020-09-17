const path = require('path');
const debounce = require('lodash/debounce');
const busClient = require('xcraft-core-busclient').getGlobal();
const resp = busClient.newResponse('overwatch', 'token');
const xFs = require('xcraft-core-fs');

const goblinName = path.basename(module.parent.filename, '.js');
const Goblin = require('xcraft-core-goblin');

// Define initial logic values
const logicState = {
  id: goblinName,
  firstError: true,
  errors: [],
  channels: {discord: [], mail: []},
  agent: 'ana',
};

/*****************************************************/

const createDebounce = (debounceTime) => {
  return debounce(() => {
    resp.events.send(`${goblinName}.debounced`, {});
  }, debounceTime);
};

let sendErrorsDebounce = null;

/*****************************************************/

// Define logic handlers according rc.json
const logicHandlers = {
  init: (state, action) => {
    return state
      .set('id', action.get('id'))
      .set('channels', action.get('channels'))
      .set('agent', action.get('agent'));
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
  debounceTime = 60000
) {
  quest.goblin.defer(
    quest.sub('*::overwatch.debounced', function* (_, {msg, resp}) {
      yield resp.cmd(`${goblinName}.send-errors`, {});
    })
  );
  sendErrorsDebounce = createDebounce(debounceTime);
  const overwatchConfig = require('xcraft-core-etc')().load('goblin-overwatch');
  quest.do({channels: overwatchConfig.channels, agent: overwatchConfig.agent});
  const backendsPath = path.join(__dirname, 'backends');
  let backends = new Map();
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
  quest.goblin.setX('backends', backends);
});

Goblin.registerQuest(goblinName, 'change', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'push', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'exception', function* (quest, error) {
  error._overwatch = {source: 'exception'};
  yield quest.me.pushError({error});
});

Goblin.registerQuest(goblinName, 'hazard', function (quest, error) {
  error._overwatch = {source: 'hazard'};
  // Not implemented
});

Goblin.registerQuest(goblinName, 'push-error', function* (quest, error) {
  // Ignore error from goblin-overwatch
  if (error.overwatch && error.overwatch.goblin.id === goblinName) {
    return;
  }
  yield quest.me.push({path: 'errors', value: error});
  const state = quest.goblin.getState();
  if (state.get('firstError')) {
    yield quest.me.sendErrors();
    yield quest.me.change({path: 'firstError', newValue: false});
  } else {
    sendErrorsDebounce();
  }
});

Goblin.registerQuest(goblinName, 'send-errors', function* (quest) {
  const state = quest.goblin.getState();
  const backends = quest.goblin.getX('backends');
  for (const error of state.get('errors')) {
    for (const backend of backends) {
      yield backend.send(quest, error);
    }
  }
  // Reset first error to true once with function debounce executed
  // and clear errors who has been sent
  yield quest.me.change({path: 'firstError', newValue: true});
  yield quest.me.change({path: 'errors', newValue: []});
});

Goblin.registerQuest(goblinName, 'nuke', function* (quest, next) {
  // Not implemented
});

module.exports = Goblin.configure(goblinName, logicState, logicHandlers);
Goblin.createSingle(goblinName);
