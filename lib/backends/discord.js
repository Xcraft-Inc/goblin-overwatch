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

module.exports = class OverwatchDiscord {
  constructor() {
    watt.wrapAll(this);
  }

  _buildDiscordNotif(error, source, appInfo, agent, log) {
    const report = new Report(error, source, appInfo, 'Discord');

    const username = xUtils.string.capitalize(agent);

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

  *send(channels, error, source, appInfo, agent, log) {
    const body = this._buildDiscordNotif(error, source, appInfo, agent, log);
    if (!body) {
      return;
    }
    for (const discordHook of channels.get('discord', [])) {
      yield this.sendRequest(discordHook, body, null, log);
    }
  }

  *sendRequest(discordHook, body, retryAfter = null, log, next) {
    if (retryAfter) {
      yield setTimeout(next, retryAfter);
    }
    const result = yield request(
      {
        uri: `https://discordapp.com/api/webhooks/${discordHook}`,
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        timeout: 15000,
        body: JSON.stringify(body),
      },
      next
    );
    if (result.statusCode !== 204) {
      // Error code when too much request to discord
      if (result.statusCode === 429) {
        yield this.sendRequest(
          discordHook,
          body,
          result.headers['retry-after'],
          log
        );
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
    // Discord return a '204: no-content' code if it's ok
  }
};
