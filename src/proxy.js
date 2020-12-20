const config = require("../config");
const minecraft = require('minecraft-protocol');
const tokens = require('prismarine-tokens-fixed');
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
let auxEnabled = false;

let serverCache = {
    chunks: new Map(),
    inventory: [],
    abilities: null,
    loginPacket: null,
    posPacket: null,
    playerInfo: null
}

let auxCache = {
    chunks: new Map(),
    inventory: [],
    abilities: null,
    loginPacket: null,
    posPacket: null,
    playerInfo: null
}

let parseChat = require('./chatParser.js');

let host = '2b2t.org'

function startCache(connection, cache){
    connection.on('packet', (packet, meta, raw)=>{
        switch (meta.name) {
            case "map_chunk":
                if(config.misc.chunkCache)cache.chunks.set(packet.x + "-" + packet.z, raw);
                break;
            case "unload_chunk":
                if(config.misc.chunkCache)cache.chunks.delete(packet.chunkX + "-" + packet.chunkZ);
                break;
            case "respawn":
                Object.assign(cache.loginPacket, packet);
                cache.chunks = new Map();
                cache.inventory = [];
                break;
            case "login":
                cache.loginPacket = packet;
                break;
            case "game_state_change":
                cache.loginPacket.gameMode = packet.gameMode;
                cache.loginPacket.prevGameMode = packet.gameMode;
                break;
            case "abilities":
                cache.abilities = raw;
                break;
            case "position":
                cache.posPacket = raw;
                break;
            case "set_slot":
                if(packet.windowId == 0) { 
                    cache.inventory[packet.slot] = packet;
                }
                break;
            case 'player_info':
                if (packet.action == 0){
                    cache.playerInfo = raw;
                }
                break;
        }
    });
}

function releaseCache(connection, cache){
    connection.write('login', cache.loginPacket);
    connection.writeRaw(cache.posPacket);
    connection.writeRaw(cache.abilities);
    connection.writeRaw(cache.playerInfo);
    if(cache.inventory.forEach)cache.inventory.forEach((slot)=>{
        if(slot != null) {
            connection.write("set_slot", slot);
        }
    });
    setTimeout(()=>{
        if(config.misc.chunkCache)cache.chunks.forEach((data) => {
            connection.writeRaw(data);
        });
    }, 1000);
}

function parseCommand(cmd){
    function reply(txt){
        clientConnection.write('chat', {position: 1, message: JSON.stringify(parseChat(txt))});
    }
    reply('&a> '+cmd);
    let args = cmd.split(/ +/g);
    cmd = args.shift().toLowerCase();
    log('[CMD ]'.cyan, 'cmd='+cmd, 'args='+args.join(','));
    if (cmd=='ping'){
        reply('&1pong!');
    }else if (cmd=='eval'&&config.misc.allowEval){
        try{
            let z = eval(args.join(' '));
            if (typeof z == 'object')z = require('util').inspect(z, {depth: 2});
            if (z === undefined)z = 'undefined';
            z = z.toString().split('\n');
            for (var k of z){
                reply('&b'+k);
            }
        }catch(e){
            z = e.stack.toString().split('\n');
            for (var k of z){
                reply('&4'+k);
            }
        }
    }else if (cmd=='help'){
        let msg = [
            '&6---------------------',
            '&72n2s Command List',
            '',
            '&ehelp&7: Show this list',
            '&eeval [js]&7: Evaluate JavaScript proxyside (config needed)',
            '&eping&7: pong!',
            '&eeta&7: Calculates an ETA differently',
            '&econnect [ip]&7: [&4Experimental&7] Connects you to another server',
            '&6---------------------'
        ];
        for (var k of msg){
            reply(k);
        }
    }else if (cmd=='eta'){
        reply('&6Estimated time: &l'+eta);
    }else{
        reply('&6Unknown command.')
    }
}

function clientToServer(raw, meta, pk){
    if (meta.name=='chat'){
        if (pk.message.startsWith('?')){
            return parseCommand(pk.message.substring(1));
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
            bot.editStatus("online", {name: 'pos: '+pos+' | eta: '+eta, type: 3});
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
        evalu
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
        'Real life sucks anyway!',
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
        if (config.server.whitelist&&(client.uuid!==serverConnection.uuid))return client.end('\u00A76Unauthorized');
        if (!(state=='queueWaiting'||state=='waiting'||state=='finished')){
            return client.end('\u00A76Invalid state set');
        }
        clientConnection = client;
        releaseCache(clientConnection, serverCache);
        clientConnection.on('packet', (packet, meta, raw)=>{
            clientToServer(raw, meta, packet);
        })
    })
}

async function DMNotif(txt){
    if (!config.discord.notifications.enabled)return;
    let channel = await bot.getDMChannel(config.discord.userID);
    bot.createMessage(channel.id, txt);
}

function joinServerClient(opts){
    serverConnection = minecraft.createClient(opts);
    serverConnection.on('error', (e)=>{
        log('[ERR ]'.bold.red, e.toString());
    })
    serverConnection.on('end', (r)=>{
        log('[WARN]'.bold.yellow, 'Disconnected:', r);
        if (clientConnection)clientConnection.end('\u00A76Connection Lost.');
        if (state=='finished')DMNotif(`You got disconnected!!`);
        if(state!='stopped'&&state!=='reconnecting')stop(true);
    })
    serverConnection.on('packet', (packet, meta, raw)=>{
        if (state == 'clientConnecting'){
            state = 'queueWaiting';
            updateAct();
        }
        switch(meta.name){
            case 'playerlist_header':
                if (host!='2b2t.org')break;
                if (state=='finished')break;
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
                        reconnectAttempts = 0;
                        state = 'waiting';
                        updateAct();
                        DMNotif(`The queue has started, your pos is \`${posi}\` with eta \`${eta}\``);
                    }
                }
                break;
            case 'chat':
                if (host!='2b2t.org')break;
                if (state=='finished')break;
                let sz = JSON.parse(packet.message);
                if(sz.extra&&sz.extra[1]){
                    let posi = Number(sz.extra[1].text);
                    if (posi<=config.discord.notifications.queuePos&&!isClose){
                        isClose=true;
                        DMNotif(`The queue is nearly complete, your pos is \`${posi}\` with eta \`${eta}\``);
                        log('[INFO]'.green, 'Queue threshold passed.');
                    }
                };
                if (sz.text&&sz.text==='Connecting to the server...'){
                    state='finished';
                    log('[INFO]'.green, 'FINISHED!');
                    pos = 0;
                    eta = 'NOW';
                    DMNotif(`The queue is complete, your pos is \`${pos}\` with eta \`${eta}\``);
                    updateAct();
                }
                break;
            case 'kick_disconnect':
                log('[WARN]'.bold.yellow, 'Kicked for', JSON.parse(packet.reason).text);
                break;
        }
        if (clientConnection){
            serverToClient(raw, meta);
        }
    })
    startCache(serverConnection, serverCache);
}

function authClient(opts, cb, errCb){
    tokens.use(opts, (err, _opts)=>{
        if (err){
            log('[ERR ]'.bold.red, 'Invalid MC credentials!\n', err);
            return errCb();
        }
        cb(_opts);
    })
}

function start(){
    // Start the queue
    log('[INFO]'.green, `Starting queue.`);
    state = 'serverStarting'
    updateAct();
    createServer();
    state = 'authenticating'
    updateAct();
    authClient({
        host: host, // allow to change this?
        username: secrets.mc.email,
        password: secrets.mc.password,
        version: '1.12.2',
        tokensLocation: './data/mctokens.json'
    },(_opts)=>{
        state = 'clientConnecting';
        updateAct();
        joinServerClient(_opts);
    }, stop);
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
    isClose = false;
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

function evalu(e){
    return eval(e);
}

global.proxy = {
    start,
    stop, 
    state,
    pos,
    eta,
    evalu
}