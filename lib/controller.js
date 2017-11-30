'use strict';

/**
 * Requiring core Events module
 */
var events = require('events');

/**
 * Async events execution
 */
var async = require('async');

/**
 * File systems module
 */
var fs = require('fs');

/**
 * Merge module
 */
const merge = require('merge');

/**
 * Path core module
 */
const path = require('path');

/**
 * Util NodeJS module
 */
const util = require('util');

let applicationFacade = require('./facade.js').ApplicationFacade.instance;

/**
 * Controller events
 * @type {{START: string, PRE_INIT: string, INIT: string, PRE_LOAD: string, LOAD: string, DATA_READY: string, PRE_RENDER: string, RENDER: string, POST_RENDER: string}}
 */
var ControllerEvent = {
    START: 'START',
    PRE_INIT: 'PRE_INIT',
    INIT: 'INIT',
    PRE_LOAD: 'PRE_LOAD',
    LOAD: 'LOAD',
    DATA_READY: 'DATA_READY',
    PRE_RENDER: 'PRE_RENDER',
    RENDER: 'RENDER',
    POST_RENDER: 'POST_RENDER',
    FINISH: 'FINISH'
};

var ExecutionState = {
    RUNNING: 'RUNNING',
    FAILED: 'FAILED',
    TERMINATED: 'TERMINATED'
};

/**
 *  Base controller. Implements HTML page lifecycle.
 */
class Controller extends events.EventEmitter {

    /**
     * Controller constructor
     */
    constructor(request, response, next) {
        // We must call super() in child class to have access to 'this' in a constructor
        super();

        /**
         * Flash Message system
         *
         * @private
         */
        this._flash = new (require('./flashmessages.js').FlashMessages)(request);

        /**
         * Requiring system logger
         *
         * @type {Logger|exports|module.exports}
         * @private
         */
        this._logger = require('./winstonlogger.js');

        /**
         * Request instance
         *
         * @type {*|req|*|req}
         * @private
         */
        this._request = request;

        /**
         * Response Instance
         *
         * @type {*|res|Object|*|res|Object}
         * @private
         */
        this._response = response;

        /**
         * ExpressJS next callback
         *
         * @type function
         * @private
         */
        this._next = next;

        /**
         * Response data
         *
         * @type {{}}
         */
        this.data = {};

        this._executionState = null;
        this._lifecicleError = null;

        // Map of allowed actions
        this._allowedActions = {};

        if (this.request && this.request.user) {
            this.data.loggedUser = this.request.user;
        }

        // Do not lose already assigned view data
        if (this.response.locals) {

            for (let property in this.response.locals) {

                //noinspection JSUnfilteredForInLoop
                this.data[property] = this.response.locals[property];
            }
        }

        /**
         * Item removed message
         *
         * @type {string}
         * @private
         */
        this._itemRemovedSuccessMessage = 'Item successfully removed from the database!';

        /**
         * Item can't be removed not found message
         *
         * @type {string}
         * @private
         */
        this._itemCanBeRemovedNotFoundMessage = 'Failed to delete Item. Item is not exists in the database!';

        /**
         * Item inserted success
         *
         * @type {string}
         * @private
         */
        this._itemInsertedSuccessMessage = 'Item successfully inserted to the database!';
    }

    /**
     * Flash Message
     *
     * @returns {*|FlashMessage}
     */
    get flash() {
        return this._flash;
    }

    /**
     * System logger
     *
     * @returns {*|Logger}
     */
    get logger() {
        return this._logger;
    }

    /**
     * HTTP Request instance
     *
     * @returns {*|req}
     */
    get request() {
        return this._request;
    }

    /**
     * HTTP Response instance
     *
     * @returns {*|res|Object}
     */
    get response() {
        return this._response;
    }

    /**
     * ExpressJS next callback
     *
     * @returns {Function}
     */
    get next() {
        return this._next;
    }

    /**
     * Return true if current HTTP request is POST
     *
     * @returns {boolean}
     */
    get isPostRequest() {

        return this.request.method.toLowerCase() === 'post';
    }

    /**
     * Return true if current HTTP request is GET
     *
     * @returns {boolean}
     */
    get isGetRequest() {

        return this.request.method.toLowerCase() === 'get';
    }

    /**
     * Return true if current HTTP request is HEAD
     *
     * @returns {boolean}
     */
    get isHeadRequest() {

        return this.request.method.toLowerCase() === 'head';
    }

    /**
     * Return true if current HTTP request is PUT
     *
     * @returns {boolean}
     */
    get isPutRequest() {

        return this.request.method.toLowerCase() === 'put';
    }

    /**
     * Return true if current HTTP request is DELETE
     *
     * @returns {boolean}
     */
    get isDeleteRequest() {

        return this.request.method.toLowerCase() === 'delete';
    }

    /**
     * Get execution state
     *
     * @returns {null|string|*}
     */
    get executionState() {
        return this._executionState;
    }

    /**
     * Get name of current action
     *
     * @returns {null|string|*}
     */
    get actionName() {
        return this.request.params.action;
    }

    /**
     * Get current user ID
     *
     * @returns {String}
     */
    get userId() {
        if (!this.request.user) return null;

        return this.request.user.id;
    }

    get itemRemovedSuccessMessage() {
        return this._itemRemovedSuccessMessage;
    }

    get itemCanBeRemovedNotFoundMessage() {
        return this._itemCanBeRemovedNotFoundMessage;
    }

    get itemInsertedSuccessMessage() {
        return this._itemInsertedSuccessMessage;
    }

    /**
     * Terminate controller lifecycle and go to the termination action
     */
    terminate() {
        this._executionState = ExecutionState.TERMINATED;
    }

    /**
     * Check is controller terminated during lifecycle
     */
    isTerminated() {
        return this._executionState == ExecutionState.TERMINATED;
    }

    /**
     * Check is controller failed during lifecycle
     */
    isFailed() {
        return this._executionState == ExecutionState.FAILED;
    }

    /**
     * Start application
     */
    start(callback) {
        callback();
    }

    /**
     * Pre-initialize data and event handlers
     */
    preInit(callback) {
        callback();
    }

    /**
     * Initialize data and event handlers
     */
    init(callback) {
        callback();
    }

    /**
     * Load view file
     *
     * @param callback
     */
    preLoad(callback) {
        callback(null);
    }

    /**
     * Load view file
     *
     * @param dataReadyCallback
     */
    load(dataReadyCallback) {
        dataReadyCallback(null);
    }

    /**
     * Set view for controller
     */
    view(viewDetails) {
        this._view = viewDetails;
    }

    /**
     * Check propagation error for controller and set callback if needed
     * @param callback
     */
    checkControllerPropagationError(callback) {
        var result = true;

        if (this._executionState == ExecutionState.TERMINATED) {
            callback(new Error('Controller terminated'));

            result = false;
        } else if (this._executionState == ExecutionState.FAILED) {
            callback(new Error('Controller failed'));

            result = false;
        }

        return result;
    }

    /**
     * Load view file
     *
     * @param callback
     */
    preRender(callback) {
        callback(null);
    }

    /**
     * Render controller output
     */
    render(callback) {
        this.emit(ControllerEvent.RENDER);

        if (this._view != null) {

            // Reset data to view
            if (this.data != null && Object.keys(this.data).length > 0) {
                this._view.data = this.data;
            }

            // Set lifecycle error if any
            if (this._lifecicleError != null) {
                this._view.error = this._lifecicleError;
            }

            // Load helpers
            this._view.data.moment = require('moment');

            // Current URL
            this._view.data.currentUrl = this.request.originalUrl;

            // load all flash messages
            var messages = this._flash.getMessages();
            if (messages != null && messages.length > 0) {
                this._view.data.flashMessages = messages;
            }

            // Rendering view to the response object
            this._view.render(this.response, this.request);
            this.response.end();
        } else {
            this.response.status(501).send("Not Implemented");
        }

        // Loading render callback
        callback();
    }

    /**
     * Render error
     */
    renderError(error) {

        this.logger.error(`## Controller Execution Error (action: ${this.actionName}).`, error);
        this.logger.error(error.stack);

        if (this._view != null) {
            this._view.error = error;
            this._view.render(this.response, this.request);
        } else {
            var httpStatus = error.httpStatus != null && error.httpStatus > 0 ? error.httpStatus : 500;
            this.response.status(httpStatus).send(error.message);
        }
    }

    /**
     * Callback on Controller terminated action
     *
     * @param callback
     */
    onTerminated(callback) {
        callback();
    }

    /**
     * Callback on Controller done action
     *
     * @param callback
     */
    onDone(callback) {
        callback();
    }

    /**
     * Analyzing controller lifecycle error
     *
     * @param error
     */
    analyzeLifecycleError(error) {
        if (error != null) {
            this._executionState = ExecutionState.TERMINATED;
            this._lifecicleError = error;
        }
    }

    /**
     * Run controller Life Cycle
     */
    run() {
        // Create closure
        var $this = this;

        // Starting asynch execution of controller Lifecycle
        async.series([
            // Starting Controller
            function (asyncCallback) {
                if (!this.checkControllerPropagationError(asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Starting Controller %s', this.request.route.path);
                this.start(asyncCallback);
                this.emit(ControllerEvent.START);
            }.bind(this),

            // Pre-Initializing Controller
            function (asyncCallback) {
                if (!this.checkControllerPropagationError(asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Pre-Initializing Controller %s', this.request.route.path);
                this.preInit(asyncCallback);
                this.emit(ControllerEvent.PRE_INIT);
            }.bind(this),

            // Initializing Controller
            function (asyncCallback) {
                if (!this.checkControllerPropagationError(asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Initializing Controller %s', this.request.route.path);
                this.init(asyncCallback);
                this.emit(ControllerEvent.INIT);
            }.bind(this),

            // Pre Loading Controller
            function (asyncCallback) {
                if (!this.checkControllerPropagationError(asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Pre-loading Controller %s', this.request.route.path);
                this.preLoad(asyncCallback);
                this.emit(ControllerEvent.PRE_LOAD);
            }.bind(this),

            // Loading Controller
            function (asyncCallback) {
                if (!this.checkControllerPropagationError(asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Loading Controller %s', this.request.route.path);
                this.applyLoad(asyncCallback);

                // Set data ready status
                this.emit(ControllerEvent.LOAD);
                this.emit(ControllerEvent.DATA_READY);
            }.bind(this),

            // Pre rendering Controller
            function (asyncCallback) {
                if (!this.checkControllerPropagationError(asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Pre-rendering Controller %s', this.request.route.path);
                this.preRender(asyncCallback);

                // Set pre-render status
                this.emit(ControllerEvent.PRE_RENDER);
            }.bind(this),

            // Rendering Controller
            function (asyncCallback) {
                if (!this.checkControllerPropagationError(asyncCallback)) {
                    return;
                }

                this._logger.debug('@@ Rendering Controller %s', this.request.route.path);
                this.render(asyncCallback);

                // Set render status
                this.emit(ControllerEvent.RENDER);
            }.bind(this),
            // Rendering Controller
            function (asyncCallback) {
                if (!this.checkControllerPropagationError(asyncCallback)) {
                    return;
                }

                // Set post render status
                this.emit(ControllerEvent.POST_RENDER);
                asyncCallback();
            }.bind(this)
        ], function (error) {

            // Set view error
            if (error != null) {
                // Set error
                if (!this.isTerminated()) {

                    this.renderError(error);
                }
            }

            // Processing final actions
            async.series([
                function (asyncCallback) {
                    if (this.isTerminated()) {
                        this.onTerminated(function (error) {
                            this._logger.debug('@@@@ Controller Termination Handler');
                            asyncCallback(error);
                        }.bind(this));
                    } else {
                        asyncCallback(null);
                    }
                }.bind(this),
                function (asyncCallback) {
                    this.onDone(function (error) {
                        this._logger.debug('@@@@ Controller Finished');
                        asyncCallback(error);
                    }.bind(this));

                    this.emit(ControllerEvent.FINISH);
                }.bind(this)
            ], function (error) {
                ;
            });


        }.bind(this));
    }

    /**
     *
     * @returns default action of controller
     */
    getDefaultControllerAction() {
        return null;
    }

    /**
     * Applying Load stage. Loading action.
     *
     * @param callback
     */
    applyLoad(callback) {
        /**
         * Loading data
         */
            // Trying to run action
        var $actionName             = this.actionName;
        var defaultControllerAction = this.getDefaultControllerAction();
        if ($actionName == null) {
            var $tmpActionName = this.validateActionName(this.request.url);
            if (this._allowedActions[$tmpActionName] != null) {
                $actionName = $tmpActionName;
            } else if (defaultControllerAction != null && this._allowedActions[defaultControllerAction] != null) {
                $actionName = defaultControllerAction;
            }
        }

        if ($actionName != null) {
            this._logger.debug('@@ Trying to load requested action: %s', $actionName);
            if (this._allowedActions[$actionName] != null) {
                this.executeTargetAction($actionName, callback);
            } else {
                this._logger.debug('Specified action is not allowed: %s', $actionName);
                this.next();
                this.terminate();
                callback();
            }
        } else {
            this.load(callback);
        }
    }

    /**
     * Method executes a target action
     * @param $actionName - target action
     * @param callback
     */
    executeTargetAction($actionName, callback) {
        var methodName = this._allowedActions[$actionName].method;
        if (this[methodName] instanceof Function) {
            this[methodName](function (error) {
                if (error != null) {
                    this._logger.warn('Failed to execute action %s. [%s]', $actionName, error.message);
                    this._logger.warn(require('util').inspect(error));
                }
                callback(error);
            }.bind(this));
        } else {
            this._logger.warn('Specified action is not exists: %s', methodName);
            this.response.status(500).send("Specified action is not exists");
            this.terminate();
            callback(new Error("Specified action is not exists"));
        }

    }

    /**
     * Register Action handler method
     *
     * @param {string} actionName Name of the Action or full path path
     * @param {string} [methodName] if not set actionName used instead
     */
    registerAction(actionName, methodName) {
        var $actionName      = this.validateActionName(actionName);
        var actionDetails    = {};
        actionDetails.method = (methodName != null ? methodName : $actionName);

        this._allowedActions[$actionName] = actionDetails;
    }

    /**
     * Validates action name
     *
     * @param actionName
     * @returns {*}
     */
    validateActionName(actionName) {
        if (actionName == null || actionName.length <= 1) {
            return actionName;
        }

        var result = actionName;

        if (result.charAt(0) == '/') {
            result = result.substring(1);
        }

        if (result.charAt(result.length - 1) == '/') {
            result = result.substring(0, -1);
        }

        return result;
    }

    /**
     * Removes Action handler method
     *
     * @param {string} actionName
     */
    removeAction(actionName) {
        var $actionName = this.validateActionName(actionName);
        if (this._allowedActions[$actionName] != null) {
            delete this._allowedActions[$actionName];
        }
    }

    /**
     * Make internal redirect
     *
     * @param controllerPath
     * @param params
     * @param callback
     */
    internalRedirect(controllerPath, params, callback) {

        this.logger.debug(`IndexController::internalRedirect: redirect to controller "${controllerPath}" ` +
            `with params: ${util.inspect(params)}`);

        this.terminate();

        this.request.params = merge(this.request.params, params);

        require(path.join(
            applicationFacade._basePath,
            'app',
            'controllers',
            controllerPath
        ))(this.request, this.response, this.next);

        callback();
    }

    /**
     * Check is user authentificated
     *
     * @returns {*}
     */
    isAuthenticated() {
        return this.request.isAuthenticated()
    }

    /**
     * Check is current user has Admin right
     *
     * @returns {boolean}
     */
    isAdminUser() {
        if (this.isAuthenticated() && this.request.user.isAdmin) {
            return true;
        }
        return false;
    }

    /**
     * Check is current user has Partner right
     *
     * @returns {boolean}
     */
    isPartnerUser() {
        if (this.isAuthenticated() && this.request.user.isPartner) {
            return true;
        }
        return false;
    }

    /**
     * Detects that current class is controller
     *
     * @returns {boolean}
     */
    static get isController() {
        return true;
    }
}

/**
 * Exporting Controller Classes and Events
 */
module.exports.ControllerEvent = ControllerEvent;
module.exports.ExecutionState = ExecutionState;
module.exports.Controller     = Controller;
