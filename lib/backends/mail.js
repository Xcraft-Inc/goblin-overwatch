const nodemailer = require('nodemailer');
const watt = require('gigawatts');

module.exports = class OverwatchMail {
  constructor() {
    watt.wrapAll(this);
  }

  _buildMail(error, source, appInfo) {
    let subject = `Whoa there ! An exception has occured on ${appInfo}`;
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

  *send(quest, error, source, appInfo, next) {
    const {log} = quest;
    if (process.platform !== 'linux') {
      log.err(`You can't use sendMail if you are not on linux !`);
      return;
    }

    const state = quest.goblin.getState();

    let transporter = nodemailer.createTransport({
      sendmail: true,
      newline: 'unix',
      path: '/usr/sbin/sendmail',
    });

    const {subject, text} = this._buildMail(error, source, appInfo);

    for (const mail of state.get('channels.mail', [])) {
      const info = yield transporter.sendMail(
        {
          from: 'goblin-overwatch@epsitec.ch',
          to: mail,
          subject,
          text,
        },
        next
      );
      log.info(info.envelope);
      log.info(info.messageId);
    }
  }
};
