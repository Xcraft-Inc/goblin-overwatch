'use strict';

const watt = require('gigawatts');
const xUtils = require('xcraft-core-utils');
const Report = require('../report.js');

module.exports = class OverwatchMail {
  constructor() {
    watt.wrapAll(this);
  }

  _buildMail(error, source, appInfo, agent, log) {
    const report = new Report(error, source, appInfo, 'Mail');

    agent = xUtils.string.capitalize(agent);

    try {
      let subject = `${agent}: ${report.subject} @ ${report.date}`;
      let text = report.head + '\n\n';
      text += report.error + '\n';
      text += report.callstackHead + '\n';
      text += report.callstack + '\n';
      text += `${report.footerHead} : ${report.footer}\n`;

      subject = OverwatchMail.htmlStripTags(subject);
      text = OverwatchMail.htmlToPlain(text);

      return {subject, text};
    } catch (ex) {
      report.internalException(log, ex);
      return false;
    }
  }

  static htmlToPlain(text) {
    return text
      .replace(/<\/?b>/g, '*')
      .replace(/<\/?i>/g, '/')
      .replace(/<code>/g, '')
      .replace(/<\/code>/g, '\n')
      .replace(/<\/?em>/g, '');
  }

  static htmlStripTags(text) {
    return text.replace(/<[/a-z]+>/g, '');
  }

  *send(channel, error, source, appInfo, agent, log, next) {
    const result = this._buildMail(error, source, appInfo, agent, log);
    if (!result) {
      return;
    }

    const sendmail = require('sendmail')({
      logger: {
        debug: log.verb.bind(log),
        info: log.info.bind(log),
        warn: log.warn.bind(log),
        error: log.err.bind(log),
      },
    });

    const info = yield sendmail(
      {
        from: 'goblin-overwatch@epsitec.ch',
        to: channel,
        subject: result.subject,
        text: result.text,
      },
      next
    );
    // wait x sec before next send
    yield setTimeout(next, 5000);
    log.info(info);
  }
};
