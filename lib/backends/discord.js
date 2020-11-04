const request = require('request');
const watt = require('gigawatts');

const discordTemplatePayload = `{
  "content": "An overwatch agent reported this",
  "username": "Webhook",
  "avatar_url": "https://i.imgur.com/4M34hi2.png"
}`;

module.exports = class OverwatchDiscord {
  constructor() {
    watt.wrapAll(this);
  }

  _buildDiscordNotif(error, source, appInfo, agent) {
    let discordNotif = JSON.parse(discordTemplatePayload);
    const time = error.get('time');
    const errorCount = time.size;
    if (source === 'exception') {
      discordNotif.content = `**Whoa there ! An exception has occured on ${appInfo}**`;
    } else {
      discordNotif.content = `**Barrier, activated ! A suspicious behavior has been detected on ${appInfo}**`;
    }
    discordNotif.content += `\`\`\`${time.get(0).toLocaleString()}\n${error.get(
      'err'
    )}\`\`\``;
    if (error.get('_xcraftOverwatch')) {
      const goblinInfo = error.get('goblin');
      discordNotif.content += `\`\`\`Goblin callstack\n`;
      const callStackSize = goblinInfo.get('id').size - 1;
      for (let i = callStackSize; i > 0; i--) {
        discordNotif.content += `\tat ${goblinInfo
          .get('id')
          .get(i)}.${goblinInfo.get('quest').get(i)}\n`;
      }
      discordNotif.content += `\tat ${goblinInfo
        .get('callerGoblin')
        .get(0)}.${goblinInfo.get('callerQuest').get(0)}\`\`\`\n`;
    } else {
      discordNotif.content += `**module**: ${
        error.get('mod').get(0) || 'undefined'
      }\n`;
    }
    discordNotif.content += `**error count**: ${errorCount}`;
    discordNotif.username = agent;
    discordNotif.avatar_url = `http://xcraft.ch/_discord/wh/icon/${agent}.png`;
    return discordNotif;
  }

  *send(channels, error, source, appInfo, agent, log) {
    const body = this._buildDiscordNotif(error, source, appInfo, agent);
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
