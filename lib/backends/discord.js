const request = require('request');
const watt = require('gigawatts');
const dataURI = require('../data/overwatch-agents-icon.js');

const messageColor = {
  error: 16711680,
  warning: 16771840,
  info: 44543,
  success: 65280,
};

const discordTemplatePayload = {
  content: "Un agent d'overwatch nous a rapporté ceci",
  embeds: [
    {
      title: 'Une exception a eu lieu en production...',
      description: 'Rapport detaillé, cliquez ici pour **voir la suite....**',
      url: 'https://google.com/',
      color: 16711680,
      fields: [],
      author: {
        name: 'Ana',
        url: 'https://www.reddit.com/r/cats/',
      },
      footer: {
        text: 'It seems you have to do some magics 🧙',
      },
      image: {
        url:
          'https://tenor.com/view/fuuuuuuu-cant-flaming-flames-train-gif-18078311.gif',
      },
    },
  ],
  username: 'Webhook',
  avatar_url: 'https://i.imgur.com/4M34hi2.png',
};

module.exports = class OverwatchDiscord {
  constructor() {
    watt.wrapAll(this);
  }

  _buildDiscordNotif(error, agent) {
    let discordNotif = {...discordTemplatePayload};
    if (error._overwatch.source === 'exception') {
      discordNotif.embeds[0].title = 'Une exception a eu lieu en prod';
      discordNotif.embeds[0].color = messageColor.error;
    } else {
      discordNotif.embeds[0].title =
        'Un comportement suspect a été detecté en prod';
      discordNotif.embeds[0].color = messageColor.warning;
    }
    if (error._xcraftOverwatch) {
      discordNotif.embeds[0].description = `${error.time}\n${error.err}`;
      discordNotif.embeds[0].fields.push({
        name: 'goblinId',
        value: error.goblin.id,
        inline: false,
      });
      discordNotif.embeds[0].fields.push({
        name: 'goblinQuest',
        value: error.goblin.quest,
        inline: true,
      });
      discordNotif.embeds[0].fields.push({
        name: 'callerGoblin',
        value: error.goblin.callerGoblin,
        inline: false,
      });
      discordNotif.embeds[0].fields.push({
        name: 'callerQuest',
        value: error.goblin.callerQuest,
        inline: true,
      });
    } else {
      discordNotif.embeds[0].description = `${error.time}\n${error.err}`;
    }
    discordNotif.embeds[0].author.name = agent;
    discordNotif.embeds[0].author.icon_url = `data:image/png;base64,${dataURI[agent]}`;
    return discordNotif;
  }

  *send(quest, error, next) {
    const state = quest.goblin.getState();

    const body = this._buildDiscordNotif(error, state.get('agent'));

    for (const discordHook of state.get('channels.discord', [])) {
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
      if (result.statusCode === 200 || result.statusCode === 204) {
        return;
      } else {
        // TODO: Handle error, use the wrapper to retry ?
      }
    }
  }
};
