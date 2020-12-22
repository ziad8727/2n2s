// 2n2s web server
const Express = require('express');
const cookieSession = require('cookie-session');
let app = Express();
let expressWs = require('express-ws')(app);
const apiRouter = require('./api.js');
const path = require('path');
let loginRequired = config.web.password ? config.web.password!='' : false;
let port = config.web.port || 8090;

log('[INFO]'.green, 'Starting webserver on port', port);

let cookieSecret = null;
try{
    cookieSecret = require('../data/cookies.json').secret;
}catch(e){
    log('[INFO]'.green, 'No cookie secret found or it is corrupted, generating a new one.');
    let cs = {secret: (require('crypto').randomBytes(32).toString('hex'))};
    require('fs').writeFileSync(path.join(__dirname, '..', 'data', 'cookies.json'), JSON.stringify(cs));
    cookieSecret = cs.secret;
}

if (loginRequired)app.use(cookieSession({
    name: '2n2s:session',
    keys: [cookieSecret],
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
}));

app.use('/api/v1/', apiRouter);

if (loginRequired)app.use((req, res, next)=>{
    if (req.session.pw==config.web.password)return next();
    res.sendFile(path.join(__dirname, '..', 'www', 'login.html'));
})

app.use(Express.static(path.join(__dirname, '..', 'www')));

app.listen(port, ()=>{
    log('[INFO]'.green, 'Listening on port', port);
})

function wsBroadcast(state, pos, eta){
    let wss = expressWs.getWss();
    wss.clients.forEach((client)=>{
        if (client.authenticated) {
            client.send(JSON.stringify({state, pos, eta}));
        }
    });
}
global.bcPos = wsBroadcast;