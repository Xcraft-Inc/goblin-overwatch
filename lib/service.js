const path = require('path');
const debounce = require('lodash/debounce');
const busClient = require('xcraft-core-busclient').getGlobal();
const resp = busClient.newResponse('overwatch', 'token');

const goblinName = path.basename(module.parent.filename, '.js');
const Goblin = require('xcraft-core-goblin');

// Define initial logic values
const logicState = {
  id: goblinName,
  firstError: true,
  errors: [],
};

/*****************************************************/

const sendErrorsDebounce = debounce(() => {
  resp.events.send(`${goblinName}.debounced`, {});
}, 1000 * 4 /**60 * 60*/);

/*****************************************************/

// Define logic handlers according rc.json
const logicHandlers = {
  init: (state, action) => {
    return state.set('id', action.get('id'));
  },
  change: (state, action) => {
    return state.set(action.get('path'), action.get('newValue'));
  },
  push: (state, action) => {
    return state.push(action.get('path'), action.get('value'));
  },
};

Goblin.registerQuest(goblinName, 'init', function (quest) {
  quest.goblin.defer(
    quest.sub('*::overwatch.debounced', function* (_, {msg, resp}) {
      yield resp.cmd(`${goblinName}.send-errors`, {});
    })
  );
  quest.do();
});

Goblin.registerQuest(goblinName, 'change', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'push', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'exception', function* (quest, error) {
  yield quest.me.pushError({error});
});

Goblin.registerQuest(goblinName, 'hazard', function (quest) {
  // Not implemented
});

Goblin.registerQuest(goblinName, 'push-error', function* (quest, error) {
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
  //TODO: Send error by the configured way in goblin config
  // Send
  console.log(state.get('errors').toJS());
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
