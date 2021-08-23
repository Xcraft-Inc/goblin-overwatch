'use strict';

const request = require('request');
const watt = require('gigawatts');
const xUtils = require('xcraft-core-utils');
const Report = require('../report.js');

const discordTemplatePayload = `{
  "content": "",
  "username": "Webhook",
  "avatar_url": "https://i.imgur.com/4M34hi2.png"
}`;

const emoji = [
  '💉',
  '⚠',
  '🔫',
  '🏹',
  '🔞',
  '🪓',
  '⚔',
  '🚭',
  '☣',
  '🔥',
  '‍☠️',
  '🏴',
  '⚡',
  '☢',
];
let counter = 0;

module.exports = class OverwatchDiscord {
  constructor() {
    watt.wrapAll(this);
  }

  _buildDiscordNotif(errors, source, appInfo, agent, log) {
    const username =
      xUtils.string.capitalize(agent) + ` ${emoji[counter++ % emoji.length]}`;
    let report;
    try {
      const discordNotif = JSON.parse(discordTemplatePayload);
      for (const key of errors.keySeq()) {
        report = new Report(errors.get(key), source, appInfo, 'Discord');
        discordNotif.content += `${report.head}  \n`;
        discordNotif.content += `${report.subject} @ ${report.date}  \n`;
        discordNotif.content += `${report.error.replace(/```/g, '')}\n`;
        discordNotif.content += `${report.callstackHead}`;
        discordNotif.content += `\n${report.callstack}\n`;
        discordNotif.content += `${report.footerHead} : ${report.footer}\n\n`;
      }

      discordNotif.content = OverwatchDiscord.htmlToMD101(discordNotif.content);
      discordNotif.username = username;
      discordNotif.avatar_url = `http://xcraft.ch/_discord/wh/icon/${agent}.png`;

      return discordNotif;
    } catch (ex) {
      if (report) {
        report.internalException(log, ex);
      }
      return false;
    }
  }

  _formatDiscordContentTooBig(errors, source, appInfo, log) {
    let report;
    let shortContent = '';
    try {
      let firstError = true;
      for (const key of errors.keySeq()) {
        report = new Report(errors.get(key), source, appInfo, 'Discord');
        if (firstError) {
          shortContent += `${report.head}\n`;
          shortContent += `${report.subject} @ ${report.date}\n`;
          shortContent = OverwatchDiscord.htmlToMD101(`${shortContent}\`\`\``);
          firstError = false;
        }
        let shortError = OverwatchDiscord.htmlToMD101(report.error).replace(
          /\n?```\n?/g,
          ''
        );
        let endOfFirstLine = shortError.indexOf('\n');
        if (endOfFirstLine === -1) {
          endOfFirstLine = shortError.length;
        }
        shortError = shortError.slice(0, endOfFirstLine) + `\n`;
        if (shortContent.length + shortError.length + 3 > 2000) {
          break;
        }
        shortContent += shortError;
      }
      shortContent += '```';
    } catch (ex) {
      if (report) {
        report.internalException(log, ex);
      }
      return 'Error during build of short errors, see attached file for detailed errors';
    }
    return shortContent;
  }

  static htmlToMD101(text) {
    return text
      .replace(/<\/?b>/g, '**')
      .replace(/<\/?i>/g, '_')
      .replace(/<code>/g, '```\n')
      .replace(/<\/code>/g, '\n```')
      .replace(/<\/?em>/g, '`');
  }

  *send(channel, errors, source, appInfo, agent, log) {
    const body = this._buildDiscordNotif(errors, source, appInfo, agent, log);
    // error during build of notifications
    if (!body) {
      return;
    }
    let content;
    if (body.content && body.content.length > 2000) {
      content = this._formatDiscordContentTooBig(errors, source, appInfo, log);
    }
    return yield this.sendRequest(channel, body, content, log);
  }

  *sendRequest(discordHook, body, content, log, next) {
    let options = {
      uri: `https://discordapp.com/api/webhooks/${discordHook}`,
      method: 'POST',
      timeout: 15000,
      headers: {'Content-Type': null},
    };
    // if content exceed max size, send body.content as text file
    if (content) {
      options.headers['Content-Type'] = 'multipart/form-data';
      options.formData = {
        ...body,
        content,
        file: {
          value: Buffer.from(body.content),
          options: {
            filename: 'error.md',
          },
        },
      };
    } else {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    const result = yield request(options, next);

    if (result.statusCode.toString()[0] !== '2') {
      // Error code when too much request to discord
      if (result.statusCode === 429) {
        // Return number of seconds to wait until next request
        return parseInt(result.headers['retry-after']);
      } else {
        log.warn(
          `Cannot send overwatchDiscord exception ! ${JSON.stringify(
            result,
            null,
            2
          )}`
        );
      }
    }
    // Discord return '200' or '204: no-content' code if message was sent
    return null;
  }
};
