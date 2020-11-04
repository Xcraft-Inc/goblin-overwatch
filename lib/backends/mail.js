const sendmail = require('sendmail')();
const watt = require('gigawatts');

module.exports = class OverwatchMail {
  constructor() {
    watt.wrapAll(this);
  }

  _buildMail(error, source, appInfo, agent, log) {
    let subject = `${agent}: Whoa there ! An exception has occured on ${appInfo}`;
    if (source !== 'exception') {
      subject = `Barrier, activated ! A suspicious behavior has been detected on ${appInfo}`;
    }
    let text = '';
    try {
      const time = error.get('time');
      const errorCount = time.size;
      const date = time.get(0);
      text += `${date.toLocaleString()}\n`;
      text += `\`\`\`${error.get('err')}\`\`\``;
      if (error.get('_xcraftOverwatch')) {
        const goblinInfo = error.get('goblin');
        text += `\`\`\`Goblin callstack\n`;
        const callStackSize = goblinInfo.get('id').size - 1;
        for (let i = callStackSize; i > 0; i--) {
          text += `\tat ${goblinInfo.get(`id.${i}`)}.${goblinInfo.get(
            `quest.${i}`
          )}\n`;
        }
        text += `\tat ${goblinInfo.get('callerGoblin.0')}.${goblinInfo.get(
          'callerQuest.0'
        )}\`\`\`\n`;
      } else {
        text += `**module**: ${error.get('mod.0')}\n`;
      }
      text += `**error count**: ${errorCount}\n`;
      return {subject, text};
    } catch (ex) {
      error = error ? error.toJS() : error;
      log.err(
        `Error while building mail notification for overwatch ! Exception : ${JSON.stringify(
          ex,
          null,
          2
        )}\nError content : ${JSON.stringify(error, null, 2)}`
      );
      return false;
    }
  }

  *send(channels, error, source, appInfo, agent, log, next) {
    const result = this._buildMail(error, source, appInfo, agent, log);
    if (!result) {
      return;
    }
    for (const mail of channels.get('mail', [])) {
      const info = yield sendmail(
        {
          from: 'goblin-overwatch@epsitec.ch',
          to: mail,
          result: result.subject,
          text: result.text,
        },
        next
      );
      log.info(info);
    }
  }
};
