let Eris = require('eris');
var bot = new Eris(secrets.discordToken, {intents:4609});
let prefix = config.discord.prefix;
bot.on("ready", () => {
    log('[DISC]'.cyan, 'Connected.');
    bot.editAct('2n2s - state: stopped');
});
bot.on("messageCreate", (msg) => {
    if (msg.author.id==config.discord.userID&&msg.content.startsWith(prefix)){
        let args = msg.content.substring(prefix.length).split(/ +/g);
        let cmd = args.shift().toLowerCase();
        log('[DISC]'.cyan, 'cmd='+cmd, 'args='+args.join(','));
        if (cmd=='start'){
            if (proxy.state=='stopped'){
                proxy.start();
                bot.createMessage(msg.channel.id, 'Started the queue');
            }else{
                bot.createMessage(msg.channel.id, 'Queue already started');
            }
        }
        if (cmd=='info'){
            bot.createMessage(msg.channel.id, `**2n2s information**\n\nState: \`${proxy.state}\`\nPosition: ${proxy.pos?'`'+proxy.pos+'`':'`none`'}\nCalculated ETA: ${proxy.eta?'`'+proxy.eta+'`':'`none`'}`)
        }
    }
});
bot.connect();
bot.editAct = (a)=>{
    bot.editStatus("online", {name: a, type: 3});
}
global.bot = bot;