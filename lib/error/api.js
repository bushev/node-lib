'use strict';

/**
 * HTTPError Class
 *
 * @type {HTTPError}
 */
const HTTPError = require('./httperror');

/**
 * API error
 */
class APIError extends HTTPError {

    /**
     * Rewrite basic error string representation
     *
     * @returns {string}
     */
    toString() {

        return `${this.httpStatus} - ${this.message}`;
    }
}

/**
 *
 * @type {APIError}
 */
module.exports = APIError;
