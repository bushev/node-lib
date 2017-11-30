'use strict';

/**
 *  Base system error
 */
class BaseError extends Error {

    /**
     * Error constructor
     */
    constructor (message, id) {
        // We must call super() in child class to have access to 'this' in a constructor
        super(message, id);

        this._name = 'Error.Base';
    }

    /**
     * Returns name of error type
     */
    get name () {
        return this._name;
    }

    /**
     * Rewrite basic error string representation
     *
     * @returns {string}
     */
    toString () {
        var result = 'ERROR[' + this.name + '] ' + this.message;

        return result;
    }
}

/**
 * Exporting Module
 */
module.exports = BaseError;
