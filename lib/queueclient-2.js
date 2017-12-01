const applicationFacade = require('./facade.js').ApplicationFacade.instance;

const util   = require('util');
const kue    = require('kue');
const logger = require('./winstonlogger');

class QueueClient2 {

    constructor() {

        /**
         * Application config
         *
         * @type {Configuration|exports|module.exports}
         * @private
         */
        this._config = applicationFacade.config;

        /**
         * Kue instance
         */
        this._client = kue.createQueue({
            redis: this._config.env.REDIS_QUEUE_URL
        });
    }

    get logger() {

        return logger;
    }

    /**
     * Enqueue Job
     *
     * @param jobData
     * @returns {number|Object}
     */
    enqueue(jobData) {

        // TODO: Check for duplicate

        const job = this._client.create(jobData.workerName, {
            commandName: jobData.commandName,
            params: jobData.params
        }).priority(jobData.priority || 'normal').save(err => {
            if (!err) console.log(job.id);
        });

        job.on('complete', result => {
            this.logger.debug(`Job completed with data: ${JSON.stringify(result)}`);
        }).on('failed attempt', (errorMessage, doneAttempts) => {
            this.logger.debug(`Job failed. errorMessage: ${errorMessage}, doneAttempts: ${doneAttempts}`);
        }).on('failed', errorMessage => {
            this.logger.error(`Job failed. errorMessage: ${errorMessage}`);
        }).on('progress', (progress, data) => {
            this.logger.debug(`Job #${job.id} (${progress}%) complete with data ${JSON.stringify(data)}`);
        });
    }

    /**
     * Run queue
     */
    run() {
    }
}

module.exports = QueueClient2;
