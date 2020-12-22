const config = require("../config");

require("colors");
global.log = (...args)=>{
    console.log(("["+require("moment")().format("DD/MM/YYYY hh:mm:ss")+"]").blue, ...args)
}
log('[INFO]'.green, `Starting 2n2s v${require('../package.json').version}`);
try{
    global.config = require('../config.js');
    global.secrets = require('../secrets.js');
}catch(e){
    log('[ERR ]'.bold.red, 'Could not read config or secrets!!');
    process.exit(1);
}

require('./proxy.js');
if (config.discord.enabled)require('./discord.js');
if (config.web.enabled)require('./web.js');
if (config.misc.queueOnStart)proxy.start();

process.on('uncaughtException', (e)=>{
    log('[ERR ]'.bold.red, e);
})