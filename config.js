'use strict';

module.exports = [
  {
    type: 'input',
    name: 'channels',
    message: 'list of available channels',
    default: null,
  },
  {
    type: 'input',
    name: 'agent',
    message:
      'Define the agent who report errors/hazardous behavior in your app',
    default: 'ana',
  },
];

// Implemented agents on owncloud
// https://owncloud.epsitec.ch/owncloud/index.php/apps/files_sharing/publicpreview/4s8fC2j2Ps9PiTH?fileId=1395194&file=/${agent}.png
// const agents = [
//   'ana',
//   'ange',
//   'ashe',
//   'baptiste',
//   'bastion',
//   'bouldozer',
//   'brigitte',
//   'chacal',
//   'doomfist',
//   'dva',
//   'echo',
//   'fatale',
//   'genji',
//   'hanzo',
//   'lucio',
//   'mccree',
//   'mei',
//   'moira',
//   'orisa',
//   'pharah',
//   'faucheur',
//   'reinhardt',
//   'roadhog',
//   'sigma',
//   'soldat-76',
//   'sombra',
//   'symmetra',
//   'torbjorn',
//   'tracer',
//   'winston',
//   'zarya',
//   'zenyatta',
// ];
