(function (homeController) {
    
    var data = require("../data");
    var moment = require("moment");
    var request = require("request");
    var azure = require("azure-storage");
    var eless = require('exceptionless').ExceptionlessClient.default;
    var Busboy = require("busboy");
    require("moment-duration-format");
    var nconf = require("nconf");
    
    nconf.env();
     
    var exless = nconf.get("EXLESS_API_KEY");
    eless.config.apiKey = exless;
    var blobStoreName = nconf.get("BLOB_STORAGE_NAME");
    var blobStoreKey = nconf.get("BLOB_STORAGE_KEY");
    console.log(nconf.get("BLOB_STORAGE_KEY"));
    console.log(blobStoreKey);
    
    homeController.init = function (app) {
        
        function isLoggedIn(req, res, next) {
            if (req.isAuthenticated())
                return next();

            res.redirect('/login');
        }
        
        app.get("/", function (req, res) {
            eless.submitFeatureUsage("/");
            data.getLatestPodcast(function(err, pod){
                if(err) {
                    console.log(err);
                    eless.submitException(err);
                }
                else {
                    var time = moment(pod.published);
                    
                    pod.published = time.format("dddd, DD MMMM YYYY");
                    
                    res.render("index", { podcast: pod, user: req.user });
                }
            });
        });
        
        app.get("/team", function (req, res) {
            eless.submitFeatureUsage("/team");
            res.render("team");
        });
        
        app.get("/episodes", function(req, res){
            eless.submitFeatureUsage("/episodes");
           data.getPodcasts(function(err, pods){
              if(err) {
                  console.log(err);
                  eless.submitException(err);
              } 
              else {
                  for(var i = 0; i < pods.length; i ++) {
                      var time = moment(pods[i].published);
                    
                    pods[i].published = time.format("dddd, DD MMMM YYYY");
                  }
                  res.render("podcasts", { podcasts: pods.splice(1), latest: pods[0] });
              }
           });
        });
        
        app.get("/seasons/:season?", function(req, res){
            var season = req.params.season || "1516";
            
            eless.submitFeatureUsage("/seasons/" + season);
            
            data.getPodcastsForSeason(season, function(err, pods){
               if(err){
                   console.log(err);
                   eless.submitException(err);
               } 
               else{
                   for(var i = 0; i < pods.length; i ++) {
                      var time = moment(pods[i].published);
                    
                    pods[i].published = time.format("dddd, DD MMMM YYYY");
                  }
                  data.getLatestPodcast(function(err, latest){
                     if(err){
                         console.log(err);
                         eless.submitException(err);
                     } 
                     else{
                         var time = moment(latest.published);
                         latest.published = time.format("dddd, DD MMMM YYYY");
                         res.render("podcasts", { podcasts: pods.splice(1), latest: latest });
                     }
                  });
               }
            });
        });
        
        app.get("/download/:filename", function(req, res){
           var filename = req.params.filename;
           
           eless.submitFeatureUsage("/download/" + filename);
           
           var startDate = new Date();
           var expiryDate = new Date(startDate);
           expiryDate.setMinutes(startDate.getMinutes() + 60);
           startDate.setMinutes(startDate.getMinutes() - 60);
           
           var sasPolicy = {
               AccessPolicy: {
                   Permissions: azure.BlobUtilities.SharedAccessPermissions.READ,
                   Start: startDate,
                   Expiry: expiryDate
               }
           };
           
           var blobService = azure.createBlobService(blobStoreName, blobStoreKey);
           var blobSAS = blobService.generateSharedAccessSignature("podcasts", filename, sasPolicy);
           
           var sharedBlobService = azure.createBlobServiceWithSas(blobService.host, blobSAS);
           var url = sharedBlobService.getUrl("podcasts", filename, blobSAS);
           
           res.redirect(url);           
        });
        
        app.get("/episodes/:podcastStub", function(req, res){
           var stub = req.params.podcastStub;
           eless.submitFeatureUsage("/episodes/" + stub);
           data.getPodcast(stub, function(err, pod) {
              if(err) {
                  console.log(err);
                  eless.createlog("getPodcast", err, "Error").submit();
              } 
              else {
                  if(pod != null) {
                      
                      var time = moment(pod.published);
                            pod.published = time.format("dddd, DD MMMM YYYY");
                      var url = "https://www.mixcloud.com/oembed/?url=https%3A//www.mixcloud.com/ardskeith/{0}/&format=json";
                      url = url.replace("{0}", pod.stub);
                      var embed = "";
                      request({
                        url: url,
                        json: true
                        }, function (error, response, body) {
                            if (!error && response.statusCode === 200) {
                                embed = body.embed;
                            } 
                            else {
                                embed = "Error fetching MixCloud player";
                                eless.createLog('mixcloud', 'Error fetching MixCloud player', 'Error')
                                      .setProperty("stub", stub).submit();
                            }
                            
                            
                            
                            res.render("podcast", { podcast: pod, embed: embed });
                        });
                     
                  }
                  else {
                      eless.createNotFound("/episodes/" + stub).setProperty("referer", req.headers['referer']).submit();
                      //eless.submitNotFound('/episodes/' + stub);
                      res.redirect("/");
                  }
              }
           });
        });
    };
    
})(module.exports);