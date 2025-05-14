'use strict';

const xUtils = require('xcraft-core-utils');
const Report = require('../report.js');

module.exports = class OverwatchMail {
  constructor() {}

  _buildMail(errors, source, appInfo, agent, log) {
    agent = xUtils.string.capitalize(agent);
    let report;
    let subject = `${agent} reported errors from ${appInfo}`;
    let text;
    try {
      for (const key of errors.keySeq()) {
        report = new Report(errors.get(key), source, appInfo, 'Mail');
        text += report.head + '\n\n';
        text += report.error + '\n';
        text += report.callstackHead + '\n';
        text += report.callstack + '\n';
        text += `${report.footerHead} : ${report.footer}\n\n`;
      }

      subject = OverwatchMail.htmlStripTags(subject);
      text = OverwatchMail.htmlToPlain(text);

      return {subject, text};
    } catch (ex) {
      if (report) {
        report.internalException(log, ex);
      }
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

  async send(channel, errors, source, appInfo, agent, log) {
    const result = this._buildMail(errors, source, appInfo, agent, log);
    if (!result) {
      return;
    }

    throw new Error('Not implemented! See nodemailer module');
  }
};
