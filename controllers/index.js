(function (controllers) {
    
    var homeController = require("./homeController");
    var adminController = require("./adminController");

    controllers.init = function (app){
        homeController.init(app);
        adminController.init(app);
    }
})(module.exports);