const path = require('path');
const request = require('request');
const debounce = require('lodash/debounce');
const busClient = require('xcraft-core-busclient').getGlobal();
const resp = busClient.newResponse('overwatch', 'token');
const nodemailer = require('nodemailer');

const goblinName = path.basename(module.parent.filename, '.js');
const Goblin = require('xcraft-core-goblin');

// Define initial logic values
const logicState = {
  id: goblinName,
  firstError: true,
  errors: [],
  channels: {discord: [], mail: []},
  agent: 'ana',
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
      title: 'Une exception a eu lieu en production...',
      description: 'Rapport detaillé, cliquez ici pour **voir la suite....**',
      url: 'https://google.com/',
      color: 16711680,
      fields: [
        {
          name: 'goblinId',
          value: '',
          inline: false,
        },
        {
          name: 'errorMessage',
          value: '',
          inline: false,
        },
      ],
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

/*****************************************************/

const sendErrorsDebounce = debounce(() => {
  resp.events.send(`${goblinName}.debounced`, {});
}, 1000 * 4 /**60 * 60*/);

const baseIconUrl =
  'https://owncloud.epsitec.ch/owncloud/index.php/apps/files_sharing/publicpreview/4s8fC2j2Ps9PiTH?fileId=1395194&file=/';

function buildDiscordNotif(error, agent) {
  let discordNotif = {...discordTemplatePayload};
  if (error.get('source') === 'exception') {
    discordNotif.embeds[0].title = 'Une exception a eu lieu en prod';
    discordNotif.embeds[0].color = messageColor.error;
  } else {
    discordNotif.embeds[0].title =
      'Un comportement suspect a été detecté en prod';
    discordNotif.embeds[0].color = messageColor.warning;
  }
  discordNotif.embeds[0].description = error.get('stack');
  discordNotif.embeds[0].fields[0].value = error.get('goblinId', '');
  discordNotif.embeds[0].fields[1].value = error.get('message', '');
  discordNotif.embeds[0].author.name = agent;
  discordNotif.embeds[0].author.icon_url = `${baseIconUrl}${agent}.png`;
  return discordNotif;
}

/*****************************************************/

// Define logic handlers according rc.json
const logicHandlers = {
  init: (state, action) => {
    return state
      .set('id', action.get('id'))
      .set('channels', action.get('channels'))
      .set('agent', action.get('agent'));
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
  const overwatchConfig = require('xcraft-core-etc')().load('goblin-overwatch');
  quest.do({channels: overwatchConfig.channels, agent: overwatchConfig.agent});
});

Goblin.registerQuest(goblinName, 'change', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'push', function (quest) {
  quest.do();
});

Goblin.registerQuest(goblinName, 'exception', function* (quest, error) {
  error = error.set('source', 'exception');
  yield quest.me.pushError({error});
});

Goblin.registerQuest(goblinName, 'hazard', function (quest, error) {
  error = error.set('source', 'hazard');
  // Not implemented
});

Goblin.registerQuest(goblinName, 'push-error', function* (quest, error) {
  // Ignore error from goblin-overwatch
  if (error.get('goblinId') === goblinName) {
    return;
  }
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
  for (const error of state.get('errors')) {
    if (sendDiscord) {
      yield quest.me.sendDiscordAgent({error});
    }
    if (sendMail) {
      yield quest.me.sendMailAgent({error});
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
  const state = quest.goblin.getState();

  let body = buildDiscordNotif(error, state.get('agent'));

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
});

Goblin.registerQuest(goblinName, 'send-mail-agent', function (
  quest,
  error,
  next
) {
  const {log} = quest;
  if (process.platform !== 'linux') {
    log.err(`You can't use overwatch.sendMailAgent if you are not on linux !`);
    return;
  }

  const state = quest.goblin.getState();

  let transporter = nodemailer.createTransport({
    sendmail: true,
    newline: 'unix',
    path: '/usr/sbin/sendmail',
  });

  for (const mail of state.get('channels.mail', [])) {
    transporter.sendMail(
      {
        from: 'goblin-overwatch@epsitec.ch',
        to: mail,
        subject: `Exception occured in ${error.get('goblinId')}`,
        text: error.get('stack'),
      },
      (err, info) => {
        log.info(info.envelope);
        log.info(info.messageId);
        if (err) {
          log.err(err);
        }
      }
    );
  }
});

Goblin.registerQuest(goblinName, 'nuke', function* (quest, next) {
  // Not implemented
});

module.exports = Goblin.configure(goblinName, logicState, logicHandlers);
Goblin.createSingle(goblinName);
