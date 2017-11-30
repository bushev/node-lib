'use strict';

/**
 * Winston logger
 *
 * @type {exports|module.exports}
 */
const winston = require('winston');

/**
 * Util library
 */
const util = require('util');

const myCustomLevels = {
    levels: {
        error: 0,
        warning: 1,
        info: 2,
        debug: 3
    },
    colors: {
        error: 'red',
        warning: 'yellow',
        info: 'green',
        debug: 'blue'
    }
};

/**
 * Application winston logger
 */
class Logger {

    constructor() {

        this._logger = new (winston.Logger)({
            levels: myCustomLevels.levels
        });
    }

    /**
     * Winston logger getter
     *
     * @returns {*}
     */
    get logger() {

        return this._logger;
    }

    /**
     * Winston logger setter
     *
     * @param logger
     */
    set logger(logger) {

        this._logger = logger;
    }

    /**
     * Write a log
     *
     * @param level
     * @param format
     * @param data
     * @param extraStack
     */
    _doWrite(level, format, data, extraStack) {

        if (!this._logger) return console.log(level + format + data);

        if (typeof format !== 'string') {

            format = util.inspect(format, {depth: 6});
        }

        if (extraStack) {

            format += "\r\n\r\n" + extraStack;
        }

        if (data) {
            this._logger[level](format, data);
        } else {
            this._logger[level](format);
        }
    }

    /**
     * Log INFO message
     *
     * @param format
     * @param data
     */
    info(format, data) {
        this._doWrite('info', format, data);
    }

    /**
     * Log INFO message
     *
     * @param format
     * @param data
     */
    log(format, data) {
        this._doWrite('info', format, data);
    }

    /**
     * Log WARNING level message
     *
     * @param format
     * @param data
     */
    warning(format, data) {
        // @remove me
        // let e = new Error(`Extra stack`);

        this._doWrite('warning', format, data/*, e.stack*/);
    }

    /**
     * Log WARNING level message
     *
     * @deprecated
     * @alias
     *
     * @param format
     * @param data
     */
    warn(format, data) {

        this.warning(format, data);
    }

    /**
     * Log ERROR level message
     *
     * @param format
     * @param data
     */
    error(format, data) {
        // @remove me
        let e = new Error(`Extra stack`);

        this._doWrite('error', format, data, e.stack);
    }

    /**
     * Log DEBUG level message
     *
     * @param format
     * @param data
     */
    debug(format, data) {
        if (require('./facade.js').ApplicationFacade.instance.config.isDebug) {
            this._doWrite('debug', format, data);
        }
    }
}

let loggerInstance = new Logger();

module.exports = loggerInstance;
