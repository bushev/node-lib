'use strict';

/**
 *  System logger. By default implements console logging.
 */
class Logger {

    /**
     * Base logging method
     *
     * @param data
     */
    static log (data) {
        console.log.apply(console, arguments);
    }

    /**
     * Log INFO level message
     *
     * @param data
     */
    static info (data) {
        console.info.apply(console, arguments);
    }

    /**
     * Log WARN level message
     *
     * @deprecated
     * @param data
     */
    static warn (data) {
        console.warn.apply(console, arguments);
    }

    /**
     * Log WARN level message
     *
     * @param data
     */
    static warning (data) {
        console.warn.apply(console, arguments);
    }

    /**
     * Log ERROR level message
     *
     * @param data
     */
    static error (data) {
        console.error.apply(console, arguments);
    }

    /**
     * Log DEBUG level message
     *
     * @param data
     */
    static debug (data) {
        if (require('./facade.js').ApplicationFacade.instance.config.isDebug) {
            console.info.apply(console, arguments);
        }
    }
}

module.exports = Logger;
