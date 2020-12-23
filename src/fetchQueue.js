// fetch stuff from 2b2t.io
let fetch = require('node-fetch');
const { reset } = require('./cache');

async function getQueueSize(range='1h'){
    return await (await fetch('https://2b2t.io/api/queue?range='+range)).json();
}

let size = 0;
let lastCheck = [];
let posHistory = [];

async function checkQueue(){
    log('[INFO]'.green, '[Queue Size Checker]'.bold.white, 'Checking queue size...');
    try{
        lastCheck = await getQueueSize('24h');
        size = lastCheck[0][1];
        posHistory.push()
        log('[INFO]'.green, '[Queue Size Checker]'.bold.white, 'Size is', size.toString().bold.yellow);
    }catch(e){
        log('[ERR ]'.bold.red, '[Queue Size Checker]'.bold.white, 'Error occured.');
    }
    global.queueChecker = {
        getQueueSize, checkQueue,
        lastCheck, size,
        interval, posHistory,
        reset
    }
}

function reset(){
    size = 0;
    lastCheck = [];
    posHistory = [];
}

let interval = setInterval(checkQueue,60*1000*2) // 2 mins

global.queueChecker = {
    getQueueSize, checkQueue,
    lastCheck, size,
    interval, posHistory,
    reset
}