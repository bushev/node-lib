'use strict';

/**
 * Requiring application Facade
 */
var applicationFacade = require('./facade.js').ApplicationFacade.instance;
var ApplicationEvent = require('./facade.js').ApplicationEvent;

var monq = require('nodejs-monq');

/**
 * Core url module
 *
 * @type {exports|module.exports}
 */
const url = require('url');

/**
 * Core util model
 *
 * @type {exports|module.exports}
 */
const util = require('util');

/**
 *  Job Queue based on MongoDB
 */
class QueueClient {

    /**
     * Queue client constructor
     */
    constructor () {

        var self = this;

        /**
         * Application config
         *
         * @type {Configuration|exports|module.exports}
         * @private
         */
        this._config = applicationFacade.config;

        /**
         * Requiring system logger
         *
         * @type {Logger|exports|module.exports}
         * @private
         */
        this._logger = require('./logger.js');

        /**
         * MongoDB collection name for workers
         * @type {*|string}
         * @private
         */
        this._workersCollection = this._config.env.WORKERS_COLLECTION || 'queue_tasks';

        let mongoUrl = this._config.env.MONGODB_URL;

        // Override with Docker Mongo address
        if (process.env.MONGO_PORT_27017_TCP_ADDR) {
            let mongoUrlObj = url.parse(this._config.env.MONGODB_URL);

            mongoUrlObj.hostname = process.env.MONGO_PORT_27017_TCP_ADDR;
            delete mongoUrlObj.host;

            mongoUrl = url.format(mongoUrlObj);
        }

        /**
         * Monq Client instance
         * @type {Connection|*}
         * @private
         */
        this._client = monq(mongoUrl, { collection : this._workersCollection });

        /**
         * Flag for finished monq init
         *
         * @type {boolean}
         * @private
         */
        this._clientInitialized = false;

        /**
         * Init connection for monq enqueue
         */
        this._client.init(function() {
            this._clientInitialized = true;
        }.bind(this));
    }

    /**
     * Enqueue Job
     *
     * @param job
     * @returns {number|Object}
     */
    enqueue (job) {
        var self = this;

        if (!this._clientInitialized) {
            return setTimeout(function() {
                self.enqueue(job);
            }, 10);
        }

        if (!job) {
            throw new Error('Job can\'t be undefined');
        }

        if (typeof job !== 'object') {
            throw new Error('Job must be an object');
        }

        var workerName = job.workerName,      // Name of file: test.js -> test
            commandName = job.commandName,
            params = job.params,
            options = {
                delay: job.delay,
                priority: job.priority,
                //attempts: {count: 3, delay: 1000 * 60} // 3 attempts with 1 min delay
            };

        // Not sure we need it in the client
        // this.checkWorkerCommand(workerName, commandName);

        var queue = this._client.queue(workerName, { collection: self._workersCollection });
        queue.enqueue(commandName, params, options, function (err, queuedJob) {
            if (err) {
                return this._logger.error(err);
            } else if (queuedJob) {
                this._logger.debug('-- Started job: %s', queuedJob.data.queue);
            } else {
                this._logger.debug('-- Job was not queued (duplication?): ' + util.inspect(job));
            }
        }.bind(this));
    }

    /**
     * Archive job
     *
     * @param job
     */
    archive (job) {
        this._client.archive(job);
    }

    /**
     * Run queue
     */
    run () {
    }
}

module.exports = QueueClient;
