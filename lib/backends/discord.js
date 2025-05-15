'use strict';

const xUtils = require('xcraft-core-utils');
const Report = require('../report.js');
const {FormData, File} = require('formdata-node');

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
      } else {
        log.err(
          `Error while building Discord notification! Exception:`,
          JSON.stringify(ex, null, 2)
        );
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
      } else {
        log.err(
          `Error while building Discord notification! Exception:`,
          JSON.stringify(ex, null, 2)
        );
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

  async send(channel, errors, source, appInfo, agent, log) {
    const body = this._buildDiscordNotif(errors, source, appInfo, agent, log);
    // error during build of notifications
    if (!body) {
      return;
    }
    let content;
    if (body.content && body.content.length > 2000) {
      content = this._formatDiscordContentTooBig(errors, source, appInfo, log);
    }
    return await this.sendRequest(channel, body, content, log);
  }

  async sendRequest(discordHook, body, content, log) {
    const {got} = await import('got');

    const url = `https://discordapp.com/api/webhooks/${discordHook}`;
    const options = {
      timeout: {request: 15000},
      throwHttpErrors: false,
      responseType: 'json',
    };

    let result;

    // if content exceed max size, send body.content as text file
    if (content) {
      const form = new FormData();

      Object.entries(body)
        .filter(([key]) => key !== 'content')
        .forEach(([key, value]) => {
          value = typeof value === 'object' ? JSON.stringify(value) : value;
          form.append(key, value);
        });

      form.append('content', content);
      form.append('file', new File([body.content], 'error.md'));

      result = await got.post(url, {
        ...options,
        body: form,
      });
    } else {
      result = await got.post(url, {
        ...options,
        json: body,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    // Discord return '200' or '204: no-content' code if message was sent
    if (result.statusCode.toString()[0] === '2') {
      return null;
    }
    // Error code when too much request to discord
    if (result.statusCode === 429) {
      // Return number of seconds to wait until next request
      return parseInt(result.headers['retry-after']);
    }
    log.warn(
      `Cannot send overwatchDiscord exception!`,
      result.statusCode,
      result.statusMessage
    );
  }
};
