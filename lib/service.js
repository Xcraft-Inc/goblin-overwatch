const path = require('path');
const request = require('request');
const debounce = require('lodash/debounce');
const busClient = require('xcraft-core-busclient').getGlobal();
const resp = busClient.newResponse('overwatch', 'token');

const goblinName = path.basename(module.parent.filename, '.js');
const Goblin = require('xcraft-core-goblin');

// Define initial logic values
const logicState = {
  id: goblinName,
  firstError: true,
  errors: [],
  channels: {discord: [], mail: [], whatsApp: []},
};

/*****************************************************/

// Discord message color
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
      title: "Rapport d'une activité suspecte",
      description: 'Rapport detaillé, cliquez ici pour **voir la suite....**',
      url: 'https://google.com/',
      color: messageColor.error,
      fields: [
        {
          name: 'goblinId',
          value: 'shop@jd87ewr23hsd892',
          inline: true,
        },
      ],
      author: {
        name: 'Genji',
        url: 'https://www.reddit.com/r/cats/',
        icon_url:
          'https://d15f34w2p8l1cc.cloudfront.net/overwatch/765cd44aab948bd53082079dfdcf3ce967e8786cf26e4505b797b092c1e6478e.png',
      },
      footer: {
        text: 'Woah! So cool! :smirk:',
        icon_url: 'https://i.imgur.com/fKL31aD.jpg',
      },
      image: {
        url:
          'https://upload.wikimedia.org/wikipedia/commons/5/5a/A_picture_from_China_every_day_108.jpg',
      },
      thumbnail: {
        url:
          'https://upload.wikimedia.org/wikipedia/commons/3/38/4-Nature-Wallpapers-2014-1_ukaavUI.jpg',
      },
    },
  ],
  username: 'Webhook',
  avatar_url: 'https://i.imgur.com/4M34hi2.png',
};

/*****************************************************/

const sendErrorsDebounce = debounce(() => {
  resp.events.send(`${goblinName}.debounced`, {});
}, 1000 * 4 /**60 * 60*/);

/*****************************************************/

// Define logic handlers according rc.json
const logicHandlers = {
  init: (state, action) => {
    return state
      .set('id', action.get('id'))
      .set('channels', action.get('channels'));
  },
  change: (state, action) => {
    return state.set(action.get('path'), action.get('newValue'));
  },
  push: (state, action) => {
    return state.push(action.get('path'), action.get('value'));
  },
};

Goblin.registerQuest(goblinName, 'init', function (quest) {
  quest.goblin.defer(
    quest.sub('*::overwatch.debounced', function* (_, {msg, resp}) {
      yield resp.cmd(`${goblinName}.send-errors`, {});
    })
  );
  overwatchConfig = require('xcraft-core-etc')().load('goblin-overwatch');
  quest.do({channels: overwatchConfig.channels});
});

Goblin.registerQuest(goblinName, 'change', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'push', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'exception', function* (quest, error) {
  yield quest.me.pushError({error});
});

Goblin.registerQuest(goblinName, 'hazard', function (quest) {
  // Not implemented
});

Goblin.registerQuest(goblinName, 'push-error', function* (quest, error) {
  yield quest.me.push({path: 'errors', value: error});
  const state = quest.goblin.getState();
  if (state.get('firstError')) {
    yield quest.me.sendErrors();
    yield quest.me.change({path: 'firstError', newValue: false});
  } else {
    sendErrorsDebounce();
  }
});

Goblin.registerQuest(goblinName, 'send-errors', function* (quest) {
  const state = quest.goblin.getState();
  const sendDiscord = state.get('channels.discord').size > 0;
  const sendMail = state.get('channels.mail').size > 0;
  const sendWhatsApp = state.get('channels.whatsApp').size > 0;
  //TODO: Send error by the configured way in goblin config
  for (const error of state.get('errors')) {
    if (sendDiscord) {
      yield quest.me.sendDiscordAgent({error});
    }
    if (sendMail) {
      yield quest.me.sendMailAgent({error});
    }
    if (sendWhatsApp) {
      yield quest.me.sendWhatsAppAgent({error});
    }
  }
  // Reset first error to true once with function debounce executed
  // and clear errors who has been sent
  yield quest.me.change({path: 'firstError', newValue: true});
  yield quest.me.change({path: 'errors', newValue: []});
});

Goblin.registerQuest(goblinName, 'send-discord-agent', function* (
  quest,
  error,
  next
) {
  let body = {...discordTemplatePayload};
  body.embeds[0].description = error;

  const state = quest.goblin.getState();

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
      return JSON.parse(result.body);
    } else {
      // TODO: Handle error, use the wrapper to retry ?
    }
  }
});

Goblin.registerQuest(goblinName, 'send-mail-agent', function* (
  quest,
  error,
  next
) {
  let body = {...discordTemplatePayload};
  body.embeds[0].description = error;

  const state = quest.goblin.getState();

  for (const mail of state.get('channels.mail', [])) {
    // TODO: Implement send mail with linux
    // const result = yield sendMail({error});
    // if (result.statusCode === 200 || result.statusCode === 204) {
    //   return JSON.parse(result.body);
    // } else {
    //   // TODO: Handle error, use the wrapper to retry ?
    // }
  }
});

Goblin.registerQuest(goblinName, 'send-whats-app-agent', function* (
  quest,
  error,
  next
) {
  let body = {...discordTemplatePayload};
  body.embeds[0].description = error;

  const state = quest.goblin.getState();

  for (const phoneNumber of state.get('channels.whatsApp', [])) {
    // TODO: Implement send mail with linux
    // const result = yield sendMail({error});
    // if (result.statusCode === 200 || result.statusCode === 204) {
    //   return JSON.parse(result.body);
    // } else {
    //   // TODO: Handle error, use the wrapper to retry ?
    // }
  }
});

Goblin.registerQuest(goblinName, 'nuke', function* (quest, next) {
  // Not implemented
});

module.exports = Goblin.configure(goblinName, logicState, logicHandlers);
Goblin.createSingle(goblinName);
