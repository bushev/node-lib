'use strict';

/**
 * Requiring DotEnv and get configuration for the project
 */
const defaultConfig = {
    silent: true
};

if (global.DEFAULT_CONFIG_PATH) {

    defaultConfig['path'] = global.DEFAULT_CONFIG_PATH;
}

if (process.env.APP_CONFIG_PATH) {
    require('dotenv').config({
        path: process.env.APP_CONFIG_PATH
    });
}

require('dotenv').config(defaultConfig);
require('dotenv').config({
    path: './config/env/' + process.env.APPLICATION_ENV
});

/**
 *  Base Application configuration
 */
class Configuration {
    constructor() {
        this._configuration = process.env;
    }

    /**
     * Get configuration values
     *
     * @returns {*}
     */
    get env() {
        return this._configuration;
    }

    /**
     * Merge config values
     *
     * @param config
     */
    mergeConfig(config) {
        this._configuration = require('merge').recursive(true, this._configuration, JSON.parse(JSON.stringify(config)));
    }

    /**
     * Check prod mode
     *
     * @returns {Boolean}
     */
    get isProd() {
        return this._configuration.ENV_TYPE === 'production';
    }

    /**
     * Check debug flag
     *
     * @returns {Boolean}
     */
    get isDebug() {
        return this._configuration.ENV_TYPE === 'dev' || this._configuration.ENV_TYPE === 'qa';
    }

    /**
     * Check is curren Environment is Dev
     *
     * @returns {Boolean}
     */
    get isDev() {
        return this._configuration.ENV_TYPE === 'dev';
    }

    /**
     * Check is curren Environment is QA
     *
     * @returns {Boolean}
     */
    get isQA() {
        return this._configuration.ENV_TYPE === 'qa';
    }
}

module.exports.Configuration = Configuration;
