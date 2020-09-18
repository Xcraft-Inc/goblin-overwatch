const request = require('request');
const watt = require('gigawatts');

const messageColor = {
  error: 16711680,
  warning: 16771840,
  info: 44543,
  success: 65280,
};

const discordTemplatePayload = {
  content: 'An overwatch agent reported this',
  embeds: [
    {
      title: 'An exception has occured',
      description: 'stackTrace',
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

  _buildDiscordNotif(error, source, agent, appInfo) {
    let discordNotif = Object.assign({}, discordTemplatePayload);
    if (source === 'exception') {
      discordNotif.embeds[0].title = `Whoa there ! An exception has occured on ${appInfo}`;
      discordNotif.embeds[0].color = messageColor.error;
    } else {
      discordNotif.embeds[0].title = `Barrier, activated ! A suspicious behavior has been detected on ${appInfo}`;
      discordNotif.embeds[0].color = messageColor.warning;
    }
    if (error._xcraftOverwatch) {
      discordNotif.embeds[0].description = `${error.time.toLocaleString()}\n${
        error.err
      }`;
      discordNotif.embeds[0].fields.push({
        name: 'goblinId',
        value: error.goblin.id,
        inline: true,
      });
      discordNotif.embeds[0].fields.push({
        name: 'goblinQuest',
        value: error.goblin.quest,
        inline: true,
      });
      discordNotif.embeds[0].fields.push({
        name: 'callerGoblin',
        value: error.goblin.callerGoblin,
        inline: true,
      });
      discordNotif.embeds[0].fields.push({
        name: 'callerQuest',
        value: error.goblin.callerQuest,
        inline: true,
      });
      discordNotif.embeds[0].fields.push({
        name: 'module',
        value: error.mod,
        inline: true,
      });
    } else {
      discordNotif.embeds[0].description = `${error.time.toLocaleString()}\n${
        error.err
      }`;
      discordNotif.embeds[0].fields.push({
        name: 'module',
        value: error.mod,
        inline: true,
      });
    }
    discordNotif.embeds[0].author.name = agent;
    discordNotif.avatar_url = `http://xcraft.ch/_discord/wh/icon/${agent}.png`;
    return discordNotif;
  }

  *send(quest, error, source, appInfo, next) {
    const state = quest.goblin.getState();

    const body = this._buildDiscordNotif(
      error,
      source,
      state.get('agent'),
      appInfo
    );

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
      // Discord return a 'no-content' code if it's ok
      if (result.statusCode === 204) {
        return;
      } else {
        quest.log.err(
          `Cannot send overwatchDiscord exception ! ${JSON.stringify(
            result,
            null,
            2
          )}`
        );
      }
    }
  }
};
