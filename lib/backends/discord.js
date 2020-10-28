const request = require('request');
const watt = require('gigawatts');

const messageColor = {
  error: 16711680,
  warning: 16771840,
  info: 44543,
  success: 65280,
};

const discordTemplatePayload = `{
  "content": "An overwatch agent reported this",
  "embeds": [
    {
      "color": 16711680,
      "fields": [],
      "footer": {
        "text": "It seems you have to do some magics 🧙"
      },
      "image": {
        "url": "https://media1.tenor.com/images/f73637e947925a0e34eabb45a393c079/tenor.gif"
      }
    }
  ],
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
      discordNotif.embeds[0].color = messageColor.error;
    } else {
      discordNotif.content = `**Barrier, activated ! A suspicious behavior has been detected on ${appInfo}**`;
      discordNotif.embeds[0].color = messageColor.warning;
    }
    if (error.get('_xcraftOverwatch')) {
      const goblinInfo = error.get('goblin');
      discordNotif.embeds[0].fields.push({
        name: 'goblinId',
        value: goblinInfo.get('id') || 'undefined',
        inline: true,
      });
      discordNotif.embeds[0].fields.push({
        name: 'goblinQuest',
        value: goblinInfo.get('quest') || 'undefined',
        inline: true,
      });
      discordNotif.embeds[0].fields.push({
        name: 'callerGoblin',
        value: goblinInfo.get('callerGoblin') || 'undefined',
        inline: true,
      });
      discordNotif.embeds[0].fields.push({
        name: 'callerQuest',
        value: goblinInfo.get('callerQuest') || 'undefined',
        inline: true,
      });
      discordNotif.embeds[0].fields.push({
        name: 'module',
        value: error.get('mod') || 'undefined',
        inline: true,
      });
    } else {
      discordNotif.embeds[0].fields.push({
        name: 'module',
        value: error.get('mod') || 'undefined',
        inline: true,
      });
    }
    discordNotif.embeds[0].fields.push({
      name: 'Error count',
      value: `${errorCount}`,
      inline: true,
    });
    discordNotif.content += `\`\`\`${time.get(0).toLocaleString()}\n${error.get(
      'err'
    )}\`\`\``;
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
        log.err(
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
