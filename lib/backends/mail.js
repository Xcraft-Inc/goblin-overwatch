const sendmail = require('sendmail')();
const watt = require('gigawatts');

module.exports = class OverwatchMail {
  constructor() {
    watt.wrapAll(this);
  }

  _buildMail(error, source, appInfo, agent) {
    let subject = `${agent}: Whoa there ! An exception has occured on ${appInfo}`;
    if (source !== 'exception') {
      subject = `Barrier, activated ! A suspicious behavior has been detected on ${appInfo}`;
    }
    let text = '';
    if (error._xcraftOverwatch) {
      text = `${error.time.toLocaleString()}\n\n${error.err}\n\n`;
      text += `goblinId: ${error.goblin.id}\n`;
      text += `goblinQuest: ${error.goblin.quest}\n`;
      text += `callerGoblin: ${error.goblin.callerGoblin}\n`;
      text += `callerQuest: ${error.goblin.callerQuest}\n`;
      text += `module: ${error.mod}`;
    } else {
      text = `${error.time.toLocaleString()}\n\n${error.err}\n\n`;
      text += `module: ${error.mod}`;
    }
    return {subject, text};
  }

  *send(channels, error, source, appInfo, agent, log) {
    const {subject, text} = this._buildMail(error, source, appInfo, agent);

    for (const mail of channels.get('mail', [])) {
      const info = yield sendmail(
        {
          from: 'goblin-overwatch@epsitec.ch',
          to: mail,
          subject,
          text,
        },
        next
      );
      log.info(info);
    }
  }
};
