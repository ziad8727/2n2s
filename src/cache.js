let serverCache;
let auxCache;

function resetCache(t=0){
    if(t===0||t===2)serverCache = {
        chunks: new Map(),
        inventory: {},
        abilities: null,
        loginPacket: null,
        posPacket: null 
    }
    if(t===0||t===1)auxCache = {
        chunks: new Map(),
        inventory: [],
        abilities: null,
        loginPacket: null,
        posPacket: null,
        playerInfo: null
    }
}
resetCache();

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
                cache.loginPacket.gameMode = packet.gamemode
                cache.chunks = new Map();
                cache.inventory = [];
                break;
            case "login":
                cache.loginPacket = packet;
                if (config.misc.useEndChunk)cache.loginPacket.dimension = 0;
                break;
            case "game_state_change":
                cache.loginPacket.gameMode = packet.gameMode;
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

function releaseCache(connection, cache, noLogin){
    if (proxy.state=='finished')cache.loginPacket.gameMode = 0;
    if(!noLogin)connection.write('login', cache.loginPacket);
    if(cache.posPacket)connection.writeRaw(cache.posPacket);
    if(cache.abilites)connection.writeRaw(cache.abilities);
    if(cache.playerInfo)connection.writeRaw(cache.playerInfo);
    if(cache.inventory&&cache.inventory.forEach)cache.inventory.forEach((slot)=>{
        if(slot != null) {
            connection.write("set_slot", slot);
        }
    });
    setTimeout(()=>{
        if(config.misc.chunkCache&&cache.chunks)cache.chunks.forEach((data) => {
            connection.writeRaw(data);
        });
        if (proxy.state=='finished'){
            connection.write('game_state_change', {reason: 3, gameMode: 0});
        }
    }, 1000);
}

module.exports = {
    start: startCache,
    release: releaseCache,
    reset: resetCache,
    serverCache, auxCache
}