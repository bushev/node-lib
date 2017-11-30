'use strict';

var BaseError = require('./error.js');

/**
 *  HTTP error
 */
class HTTPError extends BaseError {

    /**
     * Error constructor
     */
    constructor (message, httpStatus) {
        // We must call super() in child class to have access to 'this' in a constructor
        super(message, httpStatus);

        this._name = 'Error.HTTP';
        this._httpStatus = httpStatus;
    }

    /**
     * HTTP Status of Error request
     *
     * @returns {*|HTTPError.httpStatus}
     */
    get httpStatus () {
        return this._httpStatus;
    }
}

/**
 * Exporting Module
 */
module.exports = HTTPError;
