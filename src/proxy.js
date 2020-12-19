const config = require("../config");
const minecraft = require('minecraft-protocol');
const secrets = require("../secrets");

// 2b2t proxy service
let state = 'stopped';
let eta = null;
let pos = null;
let neta = null;

let reconnectAttempts = 0;

let serverConnection = null;
let clientConnection = null;
let auxConnection = null;
let proxyServer = null;

let oldState = null;

let serverCache = {
    chunks: new Map(),
    inventory: {},
    abilities: null,
    loginPacket: null,
    posPacket: null 
}

function startCache(){

}

function updateAct(){
    if (state!==oldState){
        log('[PROX]'.magenta, `State changed from ${oldState?oldState.red:'none'.bold} to ${state.green}`);
        oldState = state;
    }
    if (bot){
        if (state=='waiting'){
            bot.editAct('pos: '+pos+' | eta: '+eta+' | 2n2s');
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
        neta
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
        return client.end('\u00A76Not whitelisted.') // temporary
        clientConnection = client;
    })
}

function joinServerClient(){
    serverConnection = minecraft.createClient({
        host: '2b2t.org', // allow to change this?
        username: secrets.mc.email,
        password: secrets.mc.password
    })
    serverConnection.on('error', (e)=>{
        log('[ERR ]'.bold.red, e.toString());
    })
    serverConnection.on('end', (r)=>{
        log('[WARN]'.bold.yellow, 'Disconnected:', r);
        stop();
    })
    serverConnection.on('packet', (packet, meta, raw)=>{
        console.log(meta);
        if (meta.name=='kick_disconnect'){
            console.log(packet);
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
function stop(){
    // End the queue
    log('[INFO]'.green, `Stopping queue.`);
    proxyServer.close();
    proxyServer = null;
    serverConnection.end();
    serverConnection = null;
    state = 'stopped';
    updateAct();
    oldState = null;
    log('[INFO]'.green, 'Stopped queue.')
}

global.proxy = {
    start,
    stop, 
    state,
    pos,
    eta,
    neta
}