const path = require('path');
const debounce = require('lodash/debounce');

const goblinName = path.basename(module.parent.filename, '.js');
const Goblin = require('xcraft-core-goblin');

// Define initial logic values
const logicState = {
  id: goblinName,
  firstError: true,
  errors:[],
};

/*****************************************************/

// Define logic handlers according rc.json
const logicHandlers = {
  create: (state, action) => {
    return state.set('id', action.get('id'));
  },
  change: (state, action) => {
    return state.set(action.get('path'), action.get('newValue'));
  },
  push: (state, action) => {
    return state.push(action.get('path'), action.get('value'));
  },
};

Goblin.registerQuest(goblinName, 'exception', function (quest) {
  yield quest.me.sendError();
});

Goblin.registerQuest(goblinName, 'hazard', function (quest) {});

Goblin.registerQuest(goblinName, 'send-error', function (quest, error) {
  const state = quest.goblin.getState();
  if(state.get('firstError')){
    yield quest.me.push({path: 'errors', value: error});
    yield quest.me.sendErrors();
    quest.goblin.setX('debounce', debounce(() => {
      quest.cmd(`overwatch.sendErrors`, {});
    }, 1000 * 60 * 60));
    // Change flag so we don't send errors during 1 hour
    yield quest.me.change({path:'firstError', newValue: false});
  } else {
    yield quest.me.push({path: 'errors', value: error});
  }
});

Goblin.registerQuest(goblinName, 'send-errors', function (quest) {
  const state = quest.goblin.getState();
  //TODO: Send error by the configured way in goblin config
  // Send
  quest.me.log(state.get('errors').toJS());
  // Reset first error
  yield quest.me.change({path:'firstError', newValue: true});
});

Goblin.registerQuest(goblinName, 'nuke', function* (quest, next) {
  // Not implemented
});

Goblin.createSingle(Goblin);
module.exports = Goblin.configure(goblinName, logicState, logicHandlers);
