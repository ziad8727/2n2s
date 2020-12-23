// 2n2s API router
let app = require('express').Router();
let bodyParser = require('body-parser');
let loginRequired = config.web.password ? config.web.password!='' : false;
let tokens = [];

function genToken(){
    return require('crypto').randomBytes(64).toString('hex');
}

app.use(bodyParser.json());
app.post('/auth/login', (req, res)=>{
    var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (req.body&&req.body.pass){
        if (req.body.pass===config.web.password){
            log('[WEB ]'.yellow, 'Login attempt succeded from', ip+'.')
            req.session.pw = config.web.password;
            res.status(204).end();
        }else{
            log('[WEB ]'.yellow, 'Login attempt FAILED from', ip+'!')
            res.status(401).json({code: 401, msg: 'Invalid password'});
        }
    }else{
        res.status(400).json({code: 400, msg: 'Invalid body'});
    }
})

app.ws('/ws', (ws)=>{
    ws.on('message', (msg)=>{
        try{
            msg = JSON.parse(msg);
            if (msg.op){
                if (msg.op===2&&msg.token&&!ws.authenticated){ // auth
                    let idx = tokens.indexOf(msg.token);
                    if (idx==-1)return ws.close(4000, 'Authentication failed.');
                    tokens.splice(idx, 1);
                    ws.authenticated = true;
                    ws.send(JSON.stringify({state: proxy.state, pos: proxy.pos, eta: proxy.eta, fpos: proxy.fpos, size: queueChecker.size, whenFinish: config.misc.reconnectOnMiss}));  
                } // more later?
            }
        }catch(e){
            console.log(e);
            ws.close(4001, 'Payload parse error or internal server error.');
        }
    })
})

if (loginRequired)app.use((req, res, next)=>{
    if (req.session.pw==config.web.password)return next();
    if (req.headers.authorization=='2n2s:'+config.web.password)return next();
    res.status(401).json({code: 401, msg: 'Authorization required'});
})

app.get('/auth/ws', (req, res)=>{
    let tk = genToken();
    tokens.push(tk);
    res.json({token: tk});
});

app.post('/start', (req, res)=>{
    let state = proxy.state;
    if (state=='stopped'||state=='reconnecting'){
        proxy.start();
        res.status(204).end();
    }else{
        res.status(400).json({code: 400, msg: 'Queue already started!!'});
    }
})

app.post('/stop', (req, res)=>{
    let state = proxy.state;
    if (state!='stopped'){
        proxy.stop();
        res.status(204).end();
    }else{
        res.status(400).json({code: 400, msg: 'Queue already stopped!!'});
    }
})

app.post('/toggleReconnectOnMiss', (req, res)=>{
    config.misc.reconnectOnMiss = !config.misc.reconnectOnMiss;
    res.json({reconnectOnMiss: config.misc.reconnectOnMiss});
})

app.get('/status', (req, res)=>{
    res.json({state: proxy.state, pos: proxy.pos, eta: proxy.eta, startPos: proxy.fpos, queueSize: queueChecker.size});
});

app.get('/history', (req, res)=>{
    res.json({queueSize: queueChecker.lastCheck, posHistory: queueChecker.posHistory})
})

app.use((req,res)=>{
    res.status(404).json({code: 404, msg: 'Not found'});
})

module.exports = app;