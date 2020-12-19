const config = require("../config");
const minecraft = require('minecraft-protocol');
const secrets = require("../secrets");

// 2b2t proxy service
let state = 'stopped';
let eta = null;
let pos = null;

let reconnectAttempts = 0;

let serverConnection = null;
let clientConnection = null;
let auxConnection = null;
let proxyServer = null;

let oldState = null;
let twTime = null;
let isClose = false;

let serverCache = {
    chunks: new Map(),
    inventory: {},
    abilities: null,
    loginPacket: null,
    posPacket: null,
    playerInfo: null
}

function startCache(){

}

function releaseCache(){

}

function parseCommand(cmd){
    function reply(txt){
        clientConnection.write('chat', {position: 1, message: JSON.stringify({text: txt})});
    }
    let args = cmd.split(/ +/g);
    cmd = args.shift();
    if (cmd=='ping'){
        reply('pong!');
    }
}

function clientToServer(raw, meta, pk){
    if (meta.name=='chat'){
        let msg = JSON.parse(pk.message);
        if (msg.text.startsWith('?')){
            return parseCommand(msg.text);
        }
    }
    if (meta.name !== "keep_alive" && meta.name !== "update_time"){
        serverConnection.writeRaw(raw);
    }
}

function serverToClient(raw, meta){
    if (meta.name !== "keep_alive" && meta.name !== "update_time"){
        clientConnection.writeRaw(raw);
    }
}

function updateAct(){
    if (state!==oldState){
        log('[PROX]'.magenta, `State changed from ${oldState?oldState.red:'none'.bold} to ${state.green}`);
        oldState = state;
    }
    if (bot){
        if (state=='waiting'){
            bot.editAct('pos: '+pos+' | eta: '+eta);
        }else{
            bot.editAct('2n2s - state: '+state);
        }
    }
    global.proxy = {
        start,
        stop, 
        state,
        pos,
        eta,
    }
}

function genMotd(){
    let randoms = [
        '1.13 Soon',
        '2n2s is full',
        'how interesting',
        'DIAMONDS!',
        'kill or be killed',
        'Proxy connections disabled due to an exploit.',
        'welcome to die',
        'Everyone is a shit',
        'eat shit and die', // Funny
        '\u00A74Can\'t connect to server'
    ]
    return `\u00A77\u00A7o\u00A7l2N \u00A7r\u00A76${randoms[Math.floor(Math.random()*randoms.length)]}\u00A7r\n\u00A77\u00A7o\u00A7l2S \u00A7r\u00A71state: ${state} | pos: ${pos?pos:'none'} | eta: ${eta?eta:'none'}`
}

function createServer(){
    proxyServer = minecraft.createServer({ // create a server for us to connect to
		'online-mode': true,
		encryption: true,
		host: '0.0.0.0',
		port: config.server.port,
		version: '1.12.2',
        'max-players': 1,
        beforePing: (r)=>{
            r.description.text = genMotd();
            return r;
        }
    });
    proxyServer.on('login', (client)=>{
        if (!serverConnection)return client.end('\u00A76Server connection nonexistent');
        clientConnection = client;
        releaseCache();
    })
}

async function DMNotif(txt){
    if (!config.discord.notifications.enabled)return;
    let channel = await bot.getDMChannel(config.discord.userID);
    bot.createMessage(channel.id, txt);
}

function joinServerClient(){
    serverConnection = minecraft.createClient({
        host: '2b2t.org', // allow to change this?
        username: secrets.mc.email,
        password: secrets.mc.password,
        version: '1.12.2'
    })
    serverConnection.on('error', (e)=>{
        log('[ERR ]'.bold.red, e.toString());
    })
    serverConnection.on('end', (r)=>{
        log('[WARN]'.bold.yellow, 'Disconnected:', r);
        if (clientConnection)clientConnection.end('\u00A76Connection Lost.') // temporary
        if(state!='stopped'&&state!=='reconnecting')stop(true);
    })
    serverConnection.on('packet', (packet, meta, raw)=>{
        if (state == 'clientConnecting'){
            state = 'queueWaiting';
            updateAct();
        }
        switch(meta.name){
            case 'playerlist_header':
                let msg = JSON.parse(packet.header);
                let posi = msg.text.split("\n")[5].substring(25);
                if (posi!='None'&&posi!=pos){
                    pos = posi;
                    if (!twTime){
                        twTime = pos / 2;
                    }
                    let tpTime = -(pos / 2) + twTime;
                    let eh = twTime - tpTime;
                    eta = Math.floor(eh / 60) + "h " + Math.floor(eh % 60) + "m";
                    log('[WAIT]'.blue, `pos: ${pos}, eta: ${eta}`);     
                    updateAct();    
                }
                if (state=='queueWaiting'){
                    if (pos&&eta){
                        state = 'waiting';
                        updateAct();
                    }
                }
                break;
            case 'chat':
                let sz = JSON.parse(packet.message);
                if(sz.extra){
                    let posi = Number(sz.extra[1].text);
                    if (posi<=config.discord.notifications.queuePos&&!isClose){
                        isClose=true;
                        DMNotif(`The queue is nearly complete, your pos is \`${posi}\` with eta \`${eta}\``);
                        log('[INFO]'.green, 'Queue threshold passed.');
                    }
                };
                break;
            case 'kick_disconnect':
                log('[WARN]'.bold.blue, 'Kicked for', JSON.parse(packet.reason).text);
                break;
        }
        if (clientConnection){
            serverToClient(raw, meta);
        }
    })
}

function start(){
    // Start the queue
    log('[INFO]'.green, `Starting queue.`);
    state = 'serverStarting'
    updateAct();
    createServer();
    state = 'clientConnecting'
    updateAct();
    joinServerClient();
}
function stop(isReconStop){
    // End the queue
    log('[INFO]'.green, `Stopping queue.`);
    if(proxyServer)proxyServer.close();
    proxyServer = null;
    state = isReconStop?'reconnecting':'stopped';
    if(serverConnection)serverConnection.end();
    serverConnection = null;
    updateAct();
    if(!isReconStop)oldState = null;
    twTime = null;
    serverCache = {
        chunks: new Map(),
        inventory: {},
        abilities: null,
        loginPacket: null,
        posPacket: null 
    }
    log('[INFO]'.green, 'Stopped queue.');
    if (isReconStop){
        reconnectAttempts++;
        let time = reconnectAttempts*30;
        if (time>120)time=120;
        log('[INFO]'.green, `Reconnecting in ${time}s...`);
        setTimeout(()=>{
            log('[INFO]'.green, `Reconnecting...`);
            start();
        }, time*1000)
    }else{
        reconnectAttempts = 0;
    }
}

global.proxy = {
    start,
    stop, 
    state,
    pos,
    eta,
}