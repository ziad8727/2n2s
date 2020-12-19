// 2b2t proxy service
let state = 'stopped';
let eta = null;
let pos = null;

let reconnectAttempts = 0;

let serverConnection = null;
let clientConnection = null;
let auxConnection = null;

function start(){
    // Start the queue
    log('[INFO]'.green, `Starting queue.`);
}
function stop(){
    // End the queue
    log('[INFO]'.green, `Stopping queue.`);
}

module.exports = {
    start,
    stop, 
    state,
    pos,
    eta
}