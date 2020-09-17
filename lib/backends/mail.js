const nodemailer = require('nodemailer');
const watt = require('gigawatts');

module.exports = class OverwatchMail {
  constructor() {
    watt.wrapAll(this);
  }
  *send(quest, error, next) {
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

    for (const mail of state.get('channels.mail', [])) {
      const info = yield transporter.sendMail(
        {
          from: 'goblin-overwatch@epsitec.ch',
          to: mail,
          subject: `Exception occured in ${error.get('goblinId')}`,
          text: error.get('stack'),
        },
        next
      );
      log.info(info.envelope);
      log.info(info.messageId);
    }
  }
};
