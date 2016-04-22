var http = require('http');
var port = process.env.port || 1337;
var express = require("express");
var app = express();

var controllers = require("./controllers");

var flash = require('connect-flash');
var session = require("express-session");
var bodyParser = require("body-parser");

function maybe(fn) {
    return function(req, res, next) {
        if (req.path === '/admin/episode/upload' && req.method === 'POST') {
            console.log("skipped bodyParser");
            next();
        } else {
            fn(req, res, next);
        }
    }
}

app.use(flash());
app.use(maybe(bodyParser.urlencoded({ extended: true })));
//app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ resave: true, saveUninitialized: true, 
                      secret: 'thesocialclubni' }));

app.set("view engine", "vash");
app.use(express.static(__dirname + "/public"));

var auth = require("./auth");
auth.init(app);

controllers.init(app);


http.createServer(app).listen(port);