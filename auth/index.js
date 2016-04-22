(function(auth){
    
    var data = require("../data");
    var hasher = require("./hasher");
    var passport = require("passport");
    var LocalStrategy = require("passport-local").Strategy;
    var moment = require("moment");
    var nconf = require("nconf");
        
    nconf.env();
    
    auth.init = function(app) {
        
        function isLoggedIn(req, res, next) {
            if (req.isAuthenticated())
                return next();

            res.redirect('/login');
        }
        
        function isLoggedOut(req, res, next) {
            if (!req.isAuthenticated())
                return next();

            res.redirect('/');
        }
        
        passport.use('local-signup', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
            usernameField : 'email',
            passwordField : 'password',
            passReqToCallback : true // allows us to pass back the entire request to the callback
        },
        function(req, email, password, done) {
            process.nextTick(function(){
                if(req.body.signupsecret != nconf.get("TSC_SIGNUP_SECRET")){
                    return done(null, false, { message: "Registration secret incorrect. You cannot register yet." });
                }
                if(req.body.password != req.body.passwordConfirm){
                    return done(null, false, { message: "Passwords do not match. "});
                }
                data.checkIfUserExists(req.body.email, function(err, user){
                    if(err) {
                        console.log(err);
                        return done(err);
                    } 
                    
                    if(user) {
                        console.log("User already exists");
                        return done(null, false, { message : 'A user with that email already exists' } );
                    }
                    else {
                        var newuser = {};
                        newuser.username = req.body.username;
                        console.log(req.body);
                        newuser.email = req.body.email;
                        newuser.created = moment().toISOString();
                        var salt = hasher.createSalt();
                        newuser.password = hasher.computeHash(req.body.password, salt);
                        newuser.salt = salt;
                        
                        data.insertUser(newuser, function(err) {
                            if(err) {
                                return done(null, false, { message : 'Could not save user to database' });
                            }
                            else {
                                console.log("user registered");
                                return done(null, newuser);
                            }
                        });
                    }
                    
                });
            });
        }));
        
        passport.use('local-login', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
        },
        function(req, email, password, done) { // callback with email and password from our form
                
                data.getUser(email, function(err, user){
                if(!err && user){
                    console.log(err);
                    console.log(user);
                    var test = hasher.computeHash(password, user.salt);
                    
                    if(test === user.password) {
                        done(null, user);
                        return;
                    }
                } 
                done(null, false, { message: "The username or password specified does not match any account in the database." });
                });

        }));
        
        // passport needs to know how to read/write a user.
        passport.serializeUser(function(user, next) {
            next(null, user.email);
        });

        passport.deserializeUser(function(key, next) {
            data.getUser(key, function(err, user) {
                if (err) {
                    next(null, false, { message: 'Failed to retrieve user.' });
                } else {
                    next(null, user);
                }
            });
        });
        
        app.use(passport.initialize());
        app.use(passport.session());
        
        app.get("/register", isLoggedOut, function(req, res) {
            res.render("register", { title : "Register", message: req.flash("error") });
        });
        
        app.get("/login", isLoggedOut, function(req, res) {
            res.render("login", { title : "Login", message: req.flash("error") }); 
        });
         
        app.post('/login', isLoggedOut, passport.authenticate('local-login', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/login', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));
        
        app.post('/register', isLoggedOut, passport.authenticate('local-signup', {
            successRedirect : '/', // redirect to the secure profile section
            failureRedirect : '/register', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));
        
        app.get('/logout', function(req, res) {
            req.logout();
            res.redirect('/');
        });
    }

})(module.exports);