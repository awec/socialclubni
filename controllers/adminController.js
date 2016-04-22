(function(adminController){
    
    adminController.init = function(app) {
        
        var data = require("../data");
        var azure = require("azure-storage");
        var moment = require("moment");
        var request = require("request");
        var eless = require('exceptionless').ExceptionlessClient.default;
        var Busboy = require("busboy");
        require("moment-duration-format");
        var nconf = require("nconf");
        
        nconf.env();
                
        var exless = nconf.get("EXLESS_API_KEY");
        eless.config.apiKey = exless;
        var blobStoreName = nconf.get("BLOB_STORAGE_NAME");
        var blobStoreKey = nconf.get("BLOB_STORAGE_KEY");
        
        function isLoggedIn(req, res, next) {
            if (req.isAuthenticated())
                return next();

            res.redirect('/login');
        }
        
        app.get("/admin/episode/upload", isLoggedIn, function(req, res){
            eless.submitFeatureUsage("/admin/episode/upload");
            res.render("admin/uploadepisode");
        });
        
        app.post("/admin/episode/upload", function(req, res) {
            eless.submitFeatureUsage("/admin/episode/upload/POST");
            var blobService = azure.createBlobService(blobStoreName, blobStoreKey);
            
            blobService.createContainerIfNotExists('podcasts', function (error, result, response) {
                if (!error) {
                    // Container exists and allows
                    // anonymous read access to blob
                    // content and metadata within this container
                    var podcast = {};
                    var busboy = new Busboy({ headers: req.headers });

                    busboy.on('file', function (fieldname, file, filename, encoding, mimetype) {
                        var stream = blobService.createWriteStreamToBlockBlob(
                            'podcasts', 
                            filename);
                        podcast["filename"] = filename;
                        //pipe req to Azure BLOB write stream
                        file.pipe(stream);
                    });
                    
                    busboy.on('field', function (fieldname, val) {
                        console.log(fieldname + " -- " + val);
                        podcast[fieldname] = val;
                    });
                                
                    busboy.on('error', function(err) {
                        console.log(err);
                    });

                    req.pipe(busboy);

                    req.on('error', function (error) {
                        //KO - handle piping errors
                        console.log('error: ' + error);
                    });
                    req.once('end', function () {
                        //OK
                        console.log('all ok');
                    });
                }
            });
        });
        
        function aggregateBlobs(err, result, blobs, cb) {
            if (err) {
                cb(er);
            } else {
                var tempResults = [];
                result.entries.forEach(function(episode){
                    tempResults.push({"title" : episode.name, "modified": episode.properties["last-modified"], "id" : episode.properties.etag});
                });
                blobs = blobs.concat(tempResults);
                if (result.continuationToken !== null) {
                    blobService.listBlobsSegmented(
                        containerName,
                        result.continuationToken,
                        aggregateBlobs);
                } else {
                    cb(null, blobs);
                }
            }
        }
        
        function getAllPodcasts(agg, next){
            var blobService = azure.createBlobService(blobStoreName, blobStoreKey);
            blobService.listBlobsSegmented("podcasts", null, function(err, result) {
                aggregateBlobs(err, result, agg, function(err, blobs) {
                    if (err) {
                        next(err, null);
                    } else {
                        next(null, blobs);
                    }
                });
            });
        }
        
        app.get("/admin/episode/create", isLoggedIn, function(req, res){
            eless.submitFeatureUsage("/admin/episode/create");
            if(req.query.mixId) {
                var stub = req.query.mixId;
            
                var url = "http://api.mixcloud.com/ardskeith/{0}/";
                url = url.replace("{0}", stub);
                console.log(url);
                var mixcloud = {};
                request({
                            url: url,
                            json: true
                            }, function (error, response, body) {
                                if (!error && response.statusCode === 200) {
                                    mixcloud.title = body.name;
                                    mixcloud.summary = body.description;
                                    mixcloud.duration = moment.duration(body.audio_length, 'seconds').format("h:m:s");
                                    mixcloud.published = body.created_time;
                                    mixcloud.stub = stub;
                                    console.log(mixcloud);
                                    var blobs = [];
                                    getAllPodcasts(blobs, function(error, blobs){
                                       res.render("admin/saveepisode", { mixcloud: mixcloud, episodes: blobs });
                                    });
                                    
                                } 
                                else {
                                    console.log(error);
                                    console.log(response.statusCode);
                                }
                                
                            });
                }
            else {
                res.render("admin/createepisode");
            }
        });
        
        app.post("/admin/episode/create", function(req, res){
            eless.submitFeatureUsage("/admin/episode/create/POST");
            var podcast = {};
            console.log(req.body.stub);
            podcast.title = req.body.title;
            podcast.subtitle = req.body.subtitle;
            podcast.summary = req.body.summary;
            podcast.published = req.body.published;
            podcast.duration = req.body.duration;
            podcast.stub = req.body.stub;
            podcast.filename = req.body.blob;
            podcast.season = getSeason(podcast.published);
            
            data.insertPodcast(podcast, function(err, next){
                if(err) {
                    console.log(err);
                } 
                else {
                    res.redirect("/episodes/" + podcast.stub);
                }
            });
        });
        
        function getSeason(date){
            if(date.isBefore("2012-07-01T10:15:20:12Z")){
                return "1112";
            }
            else if(date.isAfter("2012-07-01T10:15:20:12Z") && date.isBefore("2013-07-01T10:15:20:12Z")){
                return "1213";
            }
            else if(date.isAfter("2013-07-01T10:15:20:12Z") && date.isBefore("2014-07-01T10:15:20:12Z")){
                return "1314";
            }
            else if(date.isAfter("2014-07-01T10:15:20:12Z") && date.isBefore("2015-07-01T10:15:20:12Z")){
                return "1415";
            }
            else if(date.isAfter("2015-07-01T10:15:20:12Z") && date.isBefore("2016-07-01T10:15:20:12Z")){
                return "1516";
            }
        }
    }
    
})(module.exports);