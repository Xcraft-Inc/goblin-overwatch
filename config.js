'use strict';

module.exports = [
  {
    type: 'input',
    name: 'mode',
    message: 'Mode define how you want to get or report erros',
    default: 'debounce',
  },
  {
    type: 'input',
    name: 'channels',
    message: 'list of available channels',
    default: null,
  },
  {
    type: 'input',
    name: 'agent',
    message:
      'Define the agent who report errors/hazardous behavior in your app',
    default: 'ana',
  },
];
