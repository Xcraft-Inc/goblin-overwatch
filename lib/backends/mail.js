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
    text += `${date}\n${error.get('err')}\n`;
    if (error.get('_xcraftOverwatch')) {
      const goblinInfo = error.get('goblin');
      text += `Goblin callstack\n`;
      const callStackSize = goblinInfo.get('id').size - 1;
      for (let i = callStackSize; i > 0; i--) {
        text += `\tat ${goblinInfo.get('id').get(i)}.${goblinInfo
          .get('quest')
          .get(i)}\n`;
      }
      text += `\tat ${goblinInfo.get('callerGoblin').get(0)}.${goblinInfo
        .get('callerQuest')
        .get(0)}\n`;
    } else {
      text += `module : ${error.get('mod').get(0) || 'undefined'}\n`;
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
