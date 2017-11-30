'use strict';

/**
 * Requiring core Events module
 */
var events = require('events');

/**
 *  Base Model
 */
class Model extends events.EventEmitter {

    /**
     * Model constructor
     */
    constructor () {
        // We must call super() in child class to have access to 'this' in a constructor
        super();

        /**
         * Requiring system logger
         *
         * @type {Logger|exports|module.exports}
         * @private
         */
        this._logger = require('./winstonlogger.js');
    }

    /**
     * Get application logger
     *
     * @returns {Logger|exports|module.exports}
     */
    get logger() {
        return this._logger;
    }
}

/**
 * Exporting Model Classes and Events
 */
module.exports.Model = Model;
