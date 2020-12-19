let Eris = require('eris');
var bot = new Eris(secrets.discordToken, {intents:4609});
let prefix = config.discord.prefix;
bot.on("ready", () => {
    log('[DISC]'.cyan, 'Connected.');
    bot.editAct('2n2s')
});
bot.on("messageCreate", (msg) => {
    if (msg.author.id==config.discord.userID&&msg.content.startsWith(prefix)){
        let args = msg.content.substring(prefix.length).split(/ +/g);
        let cmd = args.shift().toLowerCase();
        log('[DISC]'.cyan, 'cmd='+cmd, 'args='+args.join(','));
        if (cmd=='start'){
            proxy.start();
            bot.createMessage(msg.channel.id, 'Started the queue');
        }
        if (cmd=='info'){
            bot.createMessage(msg.channel.id, `**2n2s information**\n\nState: \`${proxy.state}\`\nPosition: ${proxy.pos?'`'+proxy.pos+'`':'`none`'}\nCalculated ETA: ${proxy.eta?'`'+proxy.eta+'`':'`none`'}\n2b2t ETA: ${proxy.neta?'`'+proxy.neta+'`':'`none`'}`)
        }
    }
});
bot.connect();
bot.editAct = (a)=>{
    bot.editStatus("online", {name: a, type: 3});
}
module.exports = bot;