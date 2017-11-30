'use strict';

/**
 * Elastic search library
 *
 * @type {es}
 */
const elasticsearch = require('elasticsearch');

/**
 *  Class that implements ElasticSearch API
 */
class ElasticSearch {

    /**
     * Constructor
     *
     */
    constructor() {

        /**
         * Elastic Search host
         * @type {null}
         * @private
         */
        this._host = process.env.ELASTICSEARCH_PORT_9200_TCP_ADDR || 'localhost';

        /**
         * Elastic Search port
         * @type {null}
         * @private
         */
        this._port = process.env.ELASTICSEARCH_PORT_9200_TCP_PORT || '9200';

        /**
         * ElasticSearch client
         *
         * @private
         */
        this._client = new elasticsearch.Client({
            host: this._host + ':' + this._port,
            minSockets: 10,
            maxSockets: 100
        });

        /**
         * Requiring system logger
         *
         * @type {Logger|exports|module.exports}
         * @private
         */
        this._logger = require('./logger.js');
    }

    /**
     * Return a client
     *
     */
    get client() {
        return this._client;
    }

    /**
     * Create or update new document
     * @param params
     * @param callback
     */
    indexItem(params, callback) {

        this.client.index(params, function (err) {
            if (err) {
                this._logger.error(err);
            }

            callback(); // Suppress error
        }.bind(this));
    }

    /**
     * Delete document
     * @param params
     * @param callback
     */
    deleteItem(params, callback) {

        this.client.delete(params, function (err) {
            if (err) {
                this._logger.error(err);
            }

            callback(); // Suppress error
        }.bind(this));
    }

    /**
     * @param params
     * @param callback
     */
    searchItems(params, callback) {

        this.client.search(params, function (err, response) {
            if (err) {
                this._logger.error(err);
            }

            callback(err, response);
        }.bind(this));
    }

    scrollItems(params, callback) {

        this.client.scroll(params, function (err, response) {
            if (err) {
                this._logger.error(err);
            }

            callback(err, response);
        }.bind(this));
    }

    /**
     * Get mapping type from ES
     *
     * @param params
     * @param callback
     */
    getMapping(params, callback) {

        this.client.indices.getMapping(params, function (err, response) {
            if (err) {
                this._logger.error(err);
            }

            callback(err, response);
        }.bind(this));
    }

    /**
     * Define mapping type from ES
     *
     * @param params
     * @param callback
     */
    putMapping(params, callback) {

        this.client.indices.putMapping(params, function (err, response) {
            if (err) {
                this._logger.error(err);
                return callback(err);
            }

            callback(null, response);
        }.bind(this));
    }

    /**
     * Delete type from ES
     *
     * @param params
     * @param callback
     */
    deleteMapping(params, callback) {

        return callback(); // TODO

        this.client.indices.deleteMapping(params, function (err, response) {
            if (err) {
                this._logger.error(err);
            }

            callback(err, response);
        }.bind(this));
    }

    /**
     * Count items in ES type/query
     *
     * @param params
     * @param callback
     */
    count(params, callback) {

        this.client.count(params, function (err, response) {
            if (err) {
                this._logger.error(err);
                return callback(err);
            }

            callback(null, response.count);
        }.bind(this));
    }

    /**
     * Get item from ES
     *
     * @param params
     * @param callback
     */
    get(params, callback) {

        this.client.get(params, function (err, response) {
            if (err) {
                this._logger.error(err);
                return callback(err);
            }

            if (!response._source) {
                return callback(new Error('404 - error')); // TODO
            }

            callback(err, response._source);
        }.bind(this));
    }
}

var Instance = new ElasticSearch();

/**
 * Exporting class Instance
 */
module.exports = Instance;
