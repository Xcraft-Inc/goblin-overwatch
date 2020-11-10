# goblin-overwatch

goblin to report errors or strange behavior in your apps.
example of config in your app.json :

```json
"goblin-overwatch": {
    "mode": "debounce",
    "channels": {
    "discord": [
        "${serverId}/${channelId}" // insert ids of your discord webhook
    ],
    "mail": []
    },
    "agent": "genji"
}
```

List of all overwatch agents available :

- ana
- ange
- ashe
- baptiste
- bastion
- bouldozer
- brigitte
- chacal
- doomfist
- dva
- echo
- fatale
- genji
- hanzo
- lucio
- mccree
- mei
- moira
- orisa
- pharah
- faucheur
- reinhardt
- roadhog
- sigma
- soldat-76
- sombra
- symmetra
- torbjorn
- tracer
- winston
- zarya
- zenyatta
