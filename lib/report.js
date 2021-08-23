'use strict';

const os = require('os');

class Report {
  constructor(error, source, appInfo, backend) {
    this._error = error;
    this._source = source;
    this._appInfo = appInfo;
    this._backend = backend;

    this._time = error.get('time');
    this._errorCount = this._time.size;
    this._date = this._time.get(0);
  }

  get head() {
    const host = `<b>${os.hostname()}</b> ◢◤◢◤ <b>${this._appInfo}</b>`;
    const title =
      process.env.NODE_ENV === 'development' ? `[test] ${host}` : host;
    return `◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤ ${title} ◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤`;
  }

  get subject() {
    return this._source === 'exception'
      ? `<b>Whoa there !</b> An exception has occured`
      : `<b>Barrier, activated !</b> A suspicious behavior has been detected`;
  }

  get date() {
    return `<i>${this._date}</i>`;
  }

  get error() {
    return `<code>${this._error.get('err')}</code>`;
  }

  get footer() {
    return `<em>${this._errorCount}</em>`;
  }

  get footerHead() {
    return '<b>Error count</b>';
  }

  get callstack() {
    if (this._error.get('_xcraftOverwatch')) {
      const goblinInfo = this._error.get('goblin');
      const callStackSize = goblinInfo.get('id').size;

      let callstack = '<code>';
      for (let i = 0; i < callStackSize; i++) {
        callstack += `    at ${goblinInfo.get(`id.${i}`)}.${goblinInfo.get(
          `quest.${i}`
        )}\n`;
      }
      callstack += `    at ${goblinInfo.get(
        `callerGoblin.${callStackSize - 1}`
      )}.${goblinInfo.get(`callerQuest.${callStackSize - 1}`)}`;
      callstack += '</code>';

      return callstack;
    }

    return `<code>    at ${this._error.get('mod.0')}</code>`;
  }

  get callstackHead() {
    return this._error.get('_xcraftOverwatch')
      ? '<b>Goblin callstack</b>'
      : '<b>Module</b>';
  }

  internalException(log, ex) {
    const error = this._error ? this._error.toJS() : this._error;
    log.err(
      `Error while building ${
        this._backend
      } notification ! Exception : ${JSON.stringify(
        ex,
        null,
        2
      )}\nError content : ${JSON.stringify(error, null, 2)}`
    );
  }
}

module.exports = Report;
