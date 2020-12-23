require("colors");
global.log = (...args)=>{
    if(config?config.misc.log:true)console.log(("["+require("moment")().format("DD/MM/YYYY hh:mm:ss")+"]").blue, ...args)
}
try{
    global.config = require('../config.js');
    global.secrets = require('../secrets.js');
}catch(e){
    log('[ERR ]'.bold.red, 'Could not read config or secrets!!');
    process.exit(1);
}
log('[INFO]'.green, `Starting 2n2s v${require('../package.json').version}`);


require('./proxy.js');
require('./fetchQueue.js'); // for the api
if (config.discord.enabled)require('./discord.js');
if (config.web.enabled)require('./web.js');
if (config.misc.queueOnStart)proxy.start();

process.on('uncaughtException', (e)=>{
    log('[ERR ]'.bold.red, e);
})