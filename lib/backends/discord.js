'use strict';

const request = require('request');
const watt = require('gigawatts');
const xUtils = require('xcraft-core-utils');
const Report = require('../report.js');

const discordTemplatePayload = `{
  "content": "An overwatch agent reported this",
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

  _buildDiscordNotif(error, source, appInfo, agent, log) {
    const report = new Report(error, source, appInfo, 'Discord');

    const username =
      xUtils.string.capitalize(agent) + ` ${emoji[counter++ % emoji.length]}`;

    try {
      const discordNotif = JSON.parse(discordTemplatePayload);
      discordNotif.content = `${report.head}\n`;
      discordNotif.content += `${report.subject} @ ${report.date}\n`;
      discordNotif.content += `${report.error.replace(/```/g, '')}\n`;
      discordNotif.content += `${report.callstackHead}`;
      discordNotif.content += `\n${report.callstack}\n`;
      discordNotif.content += `${report.footerHead} : ${report.footer}\n\n`;
      discordNotif.content = OverwatchDiscord.htmlToMD101(discordNotif.content);
      discordNotif.username = username;
      discordNotif.avatar_url = `http://xcraft.ch/_discord/wh/icon/${agent}.png`;
      return discordNotif;
    } catch (ex) {
      report.internalException(log, ex);
      return false;
    }
  }

  static htmlToMD101(text) {
    return text
      .replace(/<\/?b>/g, '**')
      .replace(/<\/?i>/g, '_')
      .replace(/<code>/g, '```\n')
      .replace(/<\/code>/g, '\n```')
      .replace(/<\/?em>/g, '`');
  }

  *send(channel, error, source, appInfo, agent, log) {
    const body = this._buildDiscordNotif(error, source, appInfo, agent, log);
    if (!body) {
      return;
    }
    yield this.sendRequest(channel, body, null, log);
  }

  *sendRequest(discordHook, body, retryAfter = null, log, next) {
    let options = {
      uri: `https://discordapp.com/api/webhooks/${discordHook}`,
      method: 'POST',
      timeout: 15000,
      headers: {'Content-Type': null},
    };
    // if content is exceed max size, send content as text file
    if (body.content.length > 2000) {
      options.headers['Content-Type'] = 'multipart/form-data';
      options.formData = {
        ...body,
        content: 'Error is too big to be displayed, attached as file below :',
        file: {
          value: Buffer.from(JSON.stringify(body, null, 2)),
          options: {
            filename: 'error.txt',
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
        return result.headers['retry-after'] + 50;
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
