const applicationFacade = require('./facade.js').ApplicationFacade.instance;

const kue    = require('kue');
const logger = require('./winstonlogger');
const md5    = require('md5');

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
            redis: this._config.env.REDIS_QUEUE_URL,
            disableSearch: false
        });
    }

    get logger() {

        return logger;
    }

    get client() {

        return this._client;
    }

    /**
     * Enqueue Job
     *
     * @param jobData
     * @returns {number|Object}
     */
    enqueue(jobData) {

        const uniqueKey = md5(JSON.stringify(Object.assign({}, {
            params: jobData.params,
            workerName: jobData.workerName,
            commandName: jobData.commandName
        })));

        // TODO: Check for duplicate jobs
        // if (body.length > 0) {
        //
        //     return this.logger.warning(`QueueClient2::enqueue: Duplicated queue job (${uniqueKey}) "${jobData.workerName}:${jobData.commandName}" was skipped. ${JSON.stringify(body)}`);
        // }

        const job = this._client.create(jobData.workerName, {
            commandName: jobData.commandName,
            params: jobData.params,
            uniqueKey
        }).priority(jobData.priority || 'normal').searchKeys(['uniqueKey']).ttl(jobData.ttl || 60 * 1000).save(err => {
            if (err) this.logger.error(`QueueClient2::enqueue Unable to enqueue a job. "${jobData.workerName}:${jobData.commandName}". ${err.message}`);
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
