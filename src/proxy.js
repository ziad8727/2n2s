let mcVer = '1.12.2';

const minecraft = require('minecraft-protocol');
const tokens = require('prismarine-tokens-fixed');
const mcData = require('minecraft-data')(mcVer);
const Chunk = require('prismarine-chunk')(mcVer);
const Vec3 = require('vec3');
const parseChat = require('./chatParser.js');
const cache = require('./cache.js');

// 2b2t proxy service
let state = 'stopped';
let eta = null;
let pos = null;

let reconnectAttempts = 0;

let serverConnection = null;
let clientConnection = null;
let proxyServer = null;

let oldState = null;
let twTime = null;
let isClose = false;

let auxEnabled = false;
let redirAuxPackets = false;
let auxConnection = null;
let sentTip = false;

let endChunk = new Chunk();

for (let x = 0; x < 16; x++) {
    for (let z = 0; z < 16; z++) {
        for (let y = 0; y < 256; y++) {
            //endChunk.setBiome(new Vec3(x, y, z), 9)
            if ((x>=6&&x<=10)){
                if ((z>=6&&z<=10)){
                    if (y>237&&y<243){
                        if ((x==6||z==6||z==10||x==10)||y==242||y==238){
                            endChunk.setBlockType(new Vec3(x, y, z), mcData.blocksByName.end_gateway.id)
                            endChunk.setBlockData(new Vec3(x, y, z), 0)
                            endChunk.setSkyLight(new Vec3(x, y, z), 15);
                            endChunk.setBlockLight(new Vec3(x, y, z), 15);   
                        }
                    }
                }
            }
        }
    }
}

let airChunk = new Chunk();
let useEndChunk = false; // you can enable this if you wish, but its buggy and glitchy clientside :3

let host = '2b2t.org'

function reply(txt){
    if(clientConnection)clientConnection.write('chat', {position: 1, message: JSON.stringify(parseChat(txt))});
}

function sendChunk(){
    // Why not bring back the old feels?
    if (state=='finished')return;
    if (useEndChunk)sendPos();
    if(clientConnection)clientConnection.write('map_chunk', {
        x: 0,
        z: 0,
        groundUp: true, 
        bitMap: (useEndChunk?endChunk:airChunk).getMask(),
        chunkData: (useEndChunk?endChunk:airChunk).dump(),
        blockEntities: []
    })
}

function sendPos(){
    if(clientConnection){
        clientConnection.write('position', {
            x: 8,
            y: 240,
            z: 8,
            yaw: 90,
            pitch: 0,
            flags: 0x00
        })
    }
}

function joinAuxServer(ip){
    //if (ip.endsWith('2b2t.org'))return reply('&4No');
    auxEnabled = true;
    log('[CONN]'.green, 'Connecting to', ip);
    log('[CONN]'.green, 'Authenticating into Minecraft');
    authClient({
        host: ip,
        username: secrets.mc.email,
        password: secrets.mc.password,
        version: mcVer,
        tokensLocation: './data/mctokens.json'
    },(_opts)=>{
        auxConnection = minecraft.createClient(_opts);
        auxConnection.on('error', (e)=>{
            log('[CONN]'.green,'[ERR ]'.bold.red, e.toString());
            if(redirAuxPackets)returnTo2b();
            reply('&4Something went wrong with your connection');
            auxEnabled = false;
        });
        auxConnection.on('end', (r)=>{
            if (auxEnabled){
                log('[CONN]'.green, '[WARN]'.bold.yellow, 'Disconnected:', r);
                if(redirAuxPackets)returnTo2b();
                reply('&4You got disconnected!');
                auxEnabled = false;
            }
        });
        cache.start(auxConnection, cache.auxCache);
        auxConnection.on('packet', (packet, meta, raw)=>{
            if (meta.name=='kick_disconnect'){
                return reply('&eYou got kicked for \''+JSON.parse(packet.reason).text+"'");
            }
            if (!redirAuxPackets){
                if (cache.auxCache.loginPacket){
                    clientConnection.write('respawn', {
                        dimension: auxCache.loginPacket.dimension,
                        difficulty: auxCache.loginPacket.difficulty,
                        gamemode: auxCache.loginPacket.gameMode,
                        levelType: auxCache.loginPacket.levelType
                    })
                    redirAuxPackets = true;
                    cache.release(clientConnection, cache.auxCache, true);
                    log('[CONN]'.green, 'Connected to', ip+'!');
                    reply('&bConnected.')
                }
            }else{
                if (meta.name !== "keep_alive" && meta.name !== "update_time"){
                    clientConnection.writeRaw(raw);
                }
            }
        });
    }, ()=>{
        reply('&4Error during Minecraft authentication');
        log('[CONN]'.green, '[WARN]'.bold.yellow, 'Failed MC auth..');
        auxEnabled = false;
    });
}

function disconnectAux(){
    log('[CONN]'.green, 'Disconnected.');
    redirAuxPackets = false;
    if(auxConnection)auxConnection.end();
    auxEnabled = false;
    auxConnection = null;
    cache.reset(1);
}

function returnTo2b(){
    log('[CONN]'.green, 'Returning to 2b...');
    auxEnabled = false;
    redirAuxPackets = false;
    clientConnection.write('respawn', {
        dimension: cache.serverCache.loginPacket.dimension,
        difficulty: cache.serverCache.loginPacket.difficulty,
        gamemode: cache.serverCache.loginPacket.gameMode,
        levelType: cache.serverCache.loginPacket.levelType
    })
    disconnectAux();
    cache.release(clientConnection, cache.serverCache, true);
    sendChunk();
    if(!sentTip){
        reply('&eYou should rejoin if you want to get rid of any scoreboards or boss bars.');
        sentTip = true;
    }
}

function parseCommand(cmd){
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
            z = e.toString().split('\n');
            for (var k of z){
                reply('&4'+k);
            }
        }
    }else if (cmd=='help'){
        let msg = [
            '&6-----------------------------------------',
            '&72n2s Command List',
            '',
            '&ehelp&7: Show this list',
            '&eeval [js]&7: Evaluate JavaScript proxyside (config needed)',
            '&eping&7: pong!',
            '&eeta&7: Calculates an ETA differently',
            '&eclear&7: Clears the chat',
            '&econnect [ip]&7: [&4Experimental&7] Connects you to another server',
            '&ereturn&7: [&4Experimental&7] Returns back to 2b2t and disconnects',
            '&estop&7: &8Stops the queue. Be very careful!',
            '&6-----------------------------------------'
        ];
        for (var k of msg){
            reply(k);
        }
    }else if (cmd=='eta'){
        reply('&6Estimated time: &l'+eta);
    }else if (cmd=='clear'){
        for (var k = 0; k < 256; k++){
            reply(' ');
        }
    }else if (cmd=='connect'){
        if (state=='finished')return reply('&4The 2b2t queue is already finished! what\'s the point?')
        if (auxEnabled)return reply('&4You are already connected! Did you mean &7?return&4?');
        if (!args[0])return reply('&4You need to specify an IP');
        reply('&5Connecting to the server...');
        setTimeout(()=>joinAuxServer(args[0]), 1000);
    }else if (cmd=='return'){
        if (!auxEnabled)return reply('&4You are not connected! Did you mean &7?connect [ip]&4?');
        reply('&5Connecting to the server...');
        setTimeout(returnTo2b, 1000);
    }else if (cmd=='stop'){
        reply('&5Stopping the queue...');
        setTimeout(stop, 1000);
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
        (redirAuxPackets?auxConnection:serverConnection).writeRaw(raw);
    }
}

function serverToClient(raw, meta){
    if (redirAuxPackets)return;
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
    if (bcPos){
        bcPos(state, pos, eta);
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
		version: mcVer,
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
        cache.release(clientConnection, cache.serverCache);
        if (state!=='finished')sendChunk();
        clientConnection.on('packet', (packet, meta, raw)=>{
            clientToServer(raw, meta, packet);
        })
        clientConnection.on('end', ()=>{
            if (auxEnabled)disconnectAux();
            clientConnection = null;
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
                    if(redirAuxPackets)reply('&6Position in queue: &l'+posi);
                };
                if (sz.text&&sz.text==='Connecting to the server...'){
                    state='finished';
                    log('[INFO]'.green, 'FINISHED!');
                    pos = 0;
                    eta = 'NOW';
                    DMNotif(`The queue is complete, your pos is \`${pos}\` with eta \`${eta}\``);
                    updateAct();
                    if (config.misc.reconnnectOnMiss&&!clientConnection)stop(true);
                    if (auxEnabled)returnTo2b();
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
    cache.start(serverConnection, cache.serverCache);
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
        version: mcVer,
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
    if(clientConnection)clientConnection.end('\u00a76Queue was stopped');
    if(proxyServer)proxyServer.close();
    proxyServer = null;
    state = isReconStop?'reconnecting':'stopped';
    if(serverConnection)serverConnection.end();
    if(auxConnection)auxConnection.end();
    serverConnection = null;
    updateAct();
    if(!isReconStop)oldState = null;
    twTime = null;
    isClose = false;
    auxEnabled = false;
    redirAuxPackets = false;
    cache.reset();
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

// SMH moment
global.proxy = {
    start,
    stop, 
    state,
    pos,
    eta,
    evalu
}