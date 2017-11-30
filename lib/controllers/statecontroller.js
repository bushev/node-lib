'use strict';

/**
 * Base Controller
 *
 * @type {*|exports|module.exports}
 */
var BaseController = require('../controller.js').Controller;

/**
 * Controller Event definitions
 *
 * @type {*|{START: string, PRE_INIT: string, INIT: string, PRE_LOAD: string, LOAD: string, DATA_READY: string, PRE_RENDER: string, RENDER: string, POST_RENDER: string, FINISH: string}}
 */
var ControllerEvent = require('../controller.js').ControllerEvent;

/**
 *  AdminIndex controller
 */
class StateController extends BaseController {

    /**
     * Controller constructor
     */
    constructor(request, response, next) {
        // We must call super() in child class to have access to 'this' in a constructor
        super(request, response, next);

        /**
         * Set State Storage UID to save/load state information from the session
         *
         * @type {string}
         */
        this.stateStorageUID = '__DEFAULT__';

        /**
         * Information about current controller state
         *
         * @type {{}}
         */
        this.currentState = {};

        // Binding to Event Handlers
        this.once(ControllerEvent.START, this.onStateControllerStart.bind(this));

        // As after RENDER Stage any session changes will not be saved - we should bind to PRE_RENDER event to save data
        this.once(ControllerEvent.PRE_RENDER, this.onStateControllerEnd.bind(this));
    }

    /**
     * Event handler on Controller Start event
     *
     * @param event
     */
    onStateControllerStart(event) {
        if (this.request.session != null && this.request.session.controllerState != null && this.request.session.controllerState[this.stateStorageUID] != null) {
            this.currentState = this.request.session.controllerState[this.stateStorageUID];
        }
    }

    /**
     * Event handler on Controller End event
     *
     * @param event
     */
    onStateControllerEnd(event) {
        if (this.request.session.controllerState == null) {
            this.request.session.controllerState = {};
        }

        // Saving current state to the session
        this.request.session.controllerState[this.stateStorageUID] = this.currentState || {};
    }
}

/**
 * Exporting Controller
 *
 * @type {Function}
 */
module.exports = StateController;
