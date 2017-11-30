'use strict';

/**
 * Requiring Main HTTP Request/Response Handling logic
 *
 * @type {*|exports|module.exports}
 */
var Express = require('express');

/**
 * Module dependencies.
 */
var passport = require('passport');

/**
 * Requiring core Events module
 */
var events = require('events');

/**
 * File system module
 */
var fs = require('fs');
var path = require('path');

/**
 * Default session
 *
 * @type {session|exports|module.exports}
 */
var session = require('express-session');

/**
 * Requiring application Facade
 */
var applicationFacade = require('./facade.js').ApplicationFacade.instance;
var ApplicationEvent = require('./facade.js').ApplicationEvent;

/**
 * Controller class definition
 */
var Controller = require('./controller.js').Controller;

/**
 * HTTP Session
 */
var HTTPSession = require('./http/session.js');

/**
 *  HTTP Server Module.
 */
class HTTPServer extends events.EventEmitter {

    /**
     * HTTP Server constructor
     */
    constructor (params) {
        // We must call super() in child class to have access to 'this' in a constructor
        super();

        /**
         * Application config
         *
         * @type {Configuration|exports|module.exports}
         * @private
         */
        this._config = applicationFacade.config;

        /**
         * Requiring system logger
         *
         * @type {Logger|exports|module.exports}
         * @private
         */
        this._logger = require('./logger.js');

        /**
         * Express application
         *
         * @type {*|exports|module.exports}
         * @private
         */
        this._application = new Express();

        /**
         * Express server instance
         *
         * @type {*|exports|module.exports|*}
         * @private
         */
        this._server = null;

        /**
         * HTTP Server instance. Can be set externally (for Socket.io compatibility)
         */
        this.httpServer = null;

        /**
         * Init base Session handlers
         *
         * @type {Function}
         * @private
         */
        this._session = HTTPSession.createSession();
    }

    /**
     * Returns Express Application instance
     *
     * @returns {*|exports|module.exports|*}
     */
    get application () {
        return this._application;
    }

    /**
     * Returns Express Server instance
     *
     * @returns {*|exports|module.exports|*}
     */
    get server (){
        return this._server;
    }

    /**
     * Returns Application Configuration
     *
     * @returns {*|Configuration|module.exports|*}
     */
    get config (){
        return this._config;
    }

    /**
     * Returns An Access Control List module instance
     *
     * @returns {*|acl|module.exports|*}
     */
    get acl () {
        return this._acl;
    }

    /**
     * Set Session Handler for Express module
     *
     * @param sessionHandler
     */
    setSessionHandler(sessionHandler) {
        this._session = sessionHandler;
    }

    /**
     * Initialize configuration settings of HTTP server
     */
    init () {
        // Emit before init event for the HTTP server
        this.emit(HTTPServer.HTTPServerEvents.BEFORE_INIT, {target: this});

        // Emiting before init middleware event for Application facade
        applicationFacade.emit(HTTPServer.HTTPServerEvents.BEFORE_INIT_HTTP_MIDDLEWARE, {target: this});

        // Emiting before register static middleware event for Application facade
        applicationFacade.emit(HTTPServer.HTTPServerEvents.BEFORE_REGISTER_HTTP_STATIC, {target: this});

        // Set ROOT for static files
        this.application.use(Express.static('public'));

        // Emiting before register http body parser middleware event for Application facade
        applicationFacade.emit(HTTPServer.HTTPServerEvents.BEFORE_REGISTER_HTTP_BODY, {target: this});

        // Set body parsers for Express
        const bodyParser = require('body-parser');
        const bodySize   = this.config.env.BODY_SIZE || '1mb';
        this.application.use(bodyParser.json({limit: bodySize}));
        this.application.use(bodyParser.urlencoded({limit: bodySize, extended: true})); // We are using extended parsing to get array/object values in a proper way

        // Emiting before register http cookie parser middleware event for Application facade
        applicationFacade.emit(HTTPServer.HTTPServerEvents.BEFORE_REGISTER_HTTP_COOKIE, {target: this});

        // Cookie Parsing Middleware
        var cookieParser = require('cookie-parser');
        this.application.use(cookieParser());

        // Emiting before register http session storage middleware event for Application facade
        applicationFacade.emit(HTTPServer.HTTPServerEvents.BEFORE_REGISTER_HTTP_SESSION, {target: this});

        // Enable sessions
        if (this._session != null) {
            this.application.use(this._session);
        }

        // Emiting before register http passport middleware event for Application facade
        applicationFacade.emit(HTTPServer.HTTPServerEvents.BEFORE_REGISTER_PASSPORT, {target: this});

        // Passport authentication middleware
        this.application.use(passport.initialize());
        this.application.use(passport.session());

        // Emiting after register http passport middleware event for Application facade
        applicationFacade.emit(HTTPServer.HTTPServerEvents.AFTER_INIT_BASIC_MIDDLEWARE, {target: this});
    }

    /**
     * Initialize passport from the handlers
     * Apply passwordModel with the method registerPassportHandlers()
     *
     * @param passportModel
     */
    initPassport (passportModel) {
        this._logger.info('## Registering passport model and handlers.');
        passportModel.registerPassportHandlers(passport);
    }

    /**
     * Loading routes for some path
     *
     * @param routesPath
     * @param baseModulePath
     */
    loadRoutesFromFile (routesPath, baseModulePath) {

        var basePath = baseModulePath != null ? baseModulePath : applicationFacade.basePath;
        var routesPath = routesPath;
        if (!fs.existsSync(routesPath)) {
            // this._logger.info('## Routes file is not exists %s. Trying another one. %s', basePath + '/' + routesPath);
            if (fs.existsSync(basePath + '/' + routesPath)) {
                routesPath = basePath + '/' + routesPath;
            }
        }

        var routesList = require(routesPath).apply();

        this._logger.info('Loading routes: ' + routesPath);

        /**
         * Loading routes
         */
        for (var routePath in routesList) {
            var controllerPath = path.join(basePath, 'app', 'controllers', routesList[routePath]);
            if (!fs.existsSync(controllerPath)) {
                controllerPath = routesList[routePath];

                // Revalidate initial controller path according baseModulePath
                if (baseModulePath != null) {
                    controllerPath = path.join(baseModulePath, controllerPath);
                }
            }

            // console.log(controllerPath);
            var routeDetails = routePath.split('|', 2);
            if (routeDetails.length != 2) {
                this._logger.warn('Invalid route: ' + routePath);
            } else {
                this._logger.info('        Initializing route: ' + routePath);
                var httpMethodsString = routeDetails[0].toLowerCase();
                var routeUrl = routeDetails[1];
                var httpMethods = httpMethodsString.split(',');
                for (var i = 0; i < httpMethods.length; i++) {
                    if (httpMethods.length > 1) {
                        this._logger.info('            - Adding: %s|%s', httpMethods[i], routeUrl);
                    }

                    /**
                     * Initializing controller handler
                     */
                    var methodName = httpMethods[i];
                    var fullControllerPath = path.resolve(controllerPath);
                    var controller = require(fullControllerPath);
                    var controllerHandler = controller;
                    if (controller.controllerHandler != null && typeof(controller.controllerHandler) == "function") {
                        this._logger.debug('##-##. Controller implements controllerHandler() method. Registering handler.');
                        controllerHandler = controller.controllerHandler;
                    } else if (controller.isController === true) {
                        this._logger.debug('##-##. Controller is an instance of base Controller. Creating default run() handler.');
                        var controllerHolder = {ControllerClass: controller};
                        controllerHandler = function(request, response, next) {
                            // Get Controller Class Definition from Prototype
                            var ControllerClassDef = this.ControllerClass;

                            var controllerInstance = new ControllerClassDef(request, response, next);
                            controllerInstance.run();
                        }.bind(controllerHolder);

                    }

                    /*
                     var currentClass = controller;
                     var currentConstructor = currentClass.prototype.constructor;
                     while(currentConstructor != null && currentConstructor.name != null) {
                     console.log('Class name: ', currentConstructor.name, '\n');
                     currentConstructor = Object.getPrototypeOf(currentConstructor);
                     }
                     */

                    this.application[methodName](routeUrl, controllerHandler);
                }
            }
        }
    }

    /**
     * Loading routes for some path
     *
     * @param routesPath
     * @param baseModulePath
     */
    loadRoutes (routesPath, baseModulePath) {
        // var normalizedPath = require("path").join(__dirname, '..', routesPath);
        var basePath = baseModulePath != null ? baseModulePath : applicationFacade.basePath;
        var normalizedPath = routesPath;
        if (!fs.existsSync(normalizedPath)) {
            this._logger.info('## Routes file is not exists %s. Trying another one.', normalizedPath);
            if (fs.existsSync(basePath + '/' + normalizedPath)) {
                normalizedPath = basePath + '/' + normalizedPath;
            }
        }

        this._logger.info('---------- ---------- ---------- ---------- ---------- ---------- ---------- ----------');

        // Loading models
        require("fs").readdirSync(normalizedPath).forEach(function(file) {
            if (file.indexOf('.js') != -1) {
                this.loadRoutesFromFile(normalizedPath + '/' + file, baseModulePath);
            } else {
                this._logger.debug('    @@@@ File %s is not js file. Ignoring.', file);
            }

        }.bind(this));
    }

    /**
     * Initialize An Access Control List
     */
    initAcl(permissionsModel) {
        permissionsModel.initAcl(function (err, acl) {
            if (err) {
                return this._logger.error('#### Failed to initialise ACL system');
            }
            this._acl = acl;
        }.bind(this));
    }

    /**
     * Run HTTP Server based on configuration settings
     */
    run () {

        let server;

        if (this.httpServer) {

            server = this.httpServer;

        } else {

            server = this.application;
        }

        this._server = server.listen(this.config.env.SERVER_PORT, this.config.env.SERVER_HOST, () => {

            this.emit(ApplicationEvent.SERVER_STARTED);

            const host = this.server.address().address;
            const port = this.server.address().port;

            this._logger.debug('Server is UP and Running. Listening at http://%s:%s', host, port);
        });
    };
}

/**
 * HTTP Server Events
 *
 * @type {{BEFORE_INIT: string, BEFORE_INIT_HTTP_MIDDLEWARE: string, BEFORE_REGISTER_HTTP_STATIC: string, BEFORE_REGISTER_HTTP_BODY: string, BEFORE_REGISTER_HTTP_COOKIE: string, BEFORE_REGISTER_HTTP_SESSION: string, BEFORE_REGISTER_PASSPORT: string, AFTER_INIT_BASIC_MIDDLEWARE: string }}
 */
HTTPServer.HTTPServerEvents = {
    BEFORE_INIT: 'BEFORE_INIT',
    BEFORE_INIT_HTTP_MIDDLEWARE: 'BEFORE_INIT_HTTP_MIDDLEWARE',
    BEFORE_REGISTER_HTTP_STATIC: 'BEFORE_REGISTER_HTTP_STATIC',
    BEFORE_REGISTER_HTTP_BODY: 'BEFORE_REGISTER_HTTP_BODY',
    BEFORE_REGISTER_HTTP_COOKIE: 'BEFORE_REGISTER_HTTP_COOKIE',
    BEFORE_REGISTER_HTTP_SESSION: 'BEFORE_REGISTER_HTTP_SESSION',
    BEFORE_REGISTER_PASSPORT: 'BEFORE_REGISTER_PASSPORT',
    AFTER_INIT_BASIC_MIDDLEWARE: 'AFTER_INIT_BASIC_MIDDLEWARE'
};

/**
 * Exporting HTTP Server
 */
module.exports = HTTPServer;
