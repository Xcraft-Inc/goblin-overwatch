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
    const time = error.get('time');
    const date = time.get(0).toLocaleString();
    if (error.get('_xcraftOverwatch')) {
      const goblinInfo = error.get('goblin');
      text = `${date}\n\n${error.get('err')}\n\n`;
      text += `goblinId: ${goblinInfo.get('id')}\n`;
      text += `goblinQuest: ${goblinInfo.get('quest')}\n`;
      text += `callerGoblin: ${goblinInfo.get('callerGoblin')}\n`;
      text += `callerQuest: ${goblinInfo.get('callerQuest')}\n`;
      text += `errorCount: ${time.size}\n`;
      text += `module: ${error.get('mod')}`;
    } else {
      text = `${date}\n\n${error.get('err')}\n\n`;
      text += `errorCount: ${time.size}\n`;
      text += `module: ${error.get('mod')}`;
    }
    return {subject, text};
  }

  *send(channels, error, source, appInfo, agent, log, next) {
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
