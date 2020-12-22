// 2n2s API router
let app = require('express').Router();
let bodyParser = require('body-parser');

app.use(bodyParser.json());
app.post('/auth/login', (req, res)=>{
    if (req.body&&req.body.pass){
        if (req.body.pass===config.web.password){
            req.session.pw = config.web.password;
            res.status(204).end();
        }else{
            res.status(401).json({code: 401, msg: 'Invalid password'});
        }
    }else{
        res.status(400).json({code: 400, msg: 'Invalid body'});
    }
})
app.use((req,res)=>{
    res.status(404).json({code: 404, msg: 'Not found'});
})

module.exports = app;