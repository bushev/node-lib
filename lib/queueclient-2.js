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
            console.log('Job completed with data ', result);
        }).on('failed attempt', (errorMessage, doneAttempts) => {
            console.log('Job failed', errorMessage, doneAttempts);
        }).on('failed', errorMessage => {
            console.log('Job failed', errorMessage);
        }).on('progress', (progress, data) => {
            console.log('\r  job #' + job.id + ' ' + progress + '% complete with data ', data);
        });
    }

    /**
     * Run queue
     */
    run() {
    }
}

module.exports = QueueClient2;
