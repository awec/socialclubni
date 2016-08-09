(function(data){
	
    var moment = require("moment");
    var nconf = require("nconf");
    nconf.env();
    var token = nconf.get("TSC_ORCHESTRATE_TOKEN");
    var orchestrate = require('orchestrate')(token);

	
    data.getLatestPodcast = function(next) {
        orchestrate.newSearchBuilder()
            .collection('episodes')
            .sort('published', 'desc')
            .limit(1)
            .query('value.season: "1617"')
            .then(function (res) {
                next(null, res.body.results[0].value)
            })
            .fail(function(err){
                next(err, null);
            });
    }
    
    data.getPodcast = function(stub, next){
       orchestrate.get('episodes', stub)
        .then(function (res) {
            next(null, res.body);
        })
        .fail(function (err) {
            next(err, null);
        });
    }
    
    data.getUser = function(email, next) {
        orchestrate.get('users', email)
        .then(function (res) {
            next(null, res.body);
        })
        .fail(function (err) {
            next(err, null);
        });
    }
    
    data.checkIfUserExists = function(email, next) {
        orchestrate.newSearchBuilder()
            .collection('users')
            .query('value.email: "' + email +'"')
            .then(function (res) {
                next(null, res.body.results.length > 0);
            })
            .fail(function(err){
                next(err, null);
            });
    }
    
    data.getPodcastsForSeason = function(season, next) {
        orchestrate.newSearchBuilder()
            .collection('episodes')
            .sort('published', 'desc')
            .limit(100)
            .query('value.season: "' + season +'"')
            .then(function (res) {
                var results = [];
                res.body.results.forEach(function(ep){
                   results.push(ep.value); 
                });
                next(null, results);
            })
            .fail(function(err){
                next(err, null);
            });
    }
    
	data.insertUser = function(user, next) {
        orchestrate.put('users', user.email, user)
            .then(function (result) {
                next(null, result);
            })
            .fail(function (err) {
                next(err, result);
            });
    }
    
	data.insertPodcast = function(podcast, next) {
		 orchestrate.put('episodes', podcast.stub, podcast)
            .then(function (result) {
                next(null, result);
            })
            .fail(function (err) {
                next(err, result);
            });
	}
	
})(module.exports);
