'use strict';

/**
 * Requiring core Events module
 */
var events = require('events');

/**
 * Load error class
 */
var LoaderError = require('./error/loadererror.js');

/**
 *  Global Objects Registry
 */
class Registry extends events.EventEmitter {

    /**
     * Registry constructor
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
        this._logger = require('./logger.js');

        /**
         * Global Objects Map
         * @type {{}}
         * @private
         */
        this._map = {};
    }

    /**
     * Push item to the Registry
     *
     * @param key
     * @param item
     */
    push (key, item) {
        if (this._map[key] != null) {
            this._logger.warn('WARNING. Object with key %s already exists in the Registry', key);
        }

        this._map[key] = item;
    }

    /**
     * Load object to the Registry
     *
     * @param key
     * @returns {*}
     */
    load (key) {
        if (this._map[key] == null) {
            this._logger.error('WARNING. Object with key %s is not exists in the Registry', key);
            throw new LoaderError('Object with key %s is not exists in the Registry');
        }

        return this._map[key];
    }
}

/**
 * Exporting Module Class
 */
module.exports = Registry;
