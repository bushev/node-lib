const applicationFacade = require('./facade').ApplicationFacade.instance;

const fs     = require('fs');
const path   = require('path');
const kue    = require('kue');
const logger = require('./winstonlogger');

class QueueServer2 {

    constructor() {

        /**
         * Application config
         *
         * @type {Configuration|exports|module.exports}
         * @private
         */
        this._config = applicationFacade.config;

        /**
         * Folder with all workers
         * @type {*|string}
         * @private
         */
        this._workersDir = this._config.env.WORKERS_DIR;

        /**
         * Existing worker files in _workerDir
         */
        this._workers = [];

        this.mongoClient = require('mongodb').MongoClient;

        this.mongoClient.connect(this._config.env.MONGODB_URL, (err, db) => {
            if (err) return this.logger.error(`QueueServer2: Unable to connect to MongoDB`);

            console.log(`QueueServer2: Connected successfully to MongoDB server`);

            this.mongodb = db;

            this.initKueClient();
        });
    }

    get logger() {

        return logger;
    }

    initKueClient() {

        /**
         * Kue instance
         */
        this._client = kue.createQueue({
            redis: this._config.env.REDIS_QUEUE_URL
        }).on('error', err => {
            this.logger.error(`QueueServer2: ${err}`);
        }).on('job enqueue', (id, type) => {

            this.logger.debug(`QueueServer2:[job enqueue]: Job ${id} got queued of type ${type}`);

        }).on('job complete', (id, result) => {

            kue.Job.get(id, (err, job) => {
                if (err) return this.logger.error(`QueueServer2:[job complete]: ${err}`);

                const jobJSON = job.toJSON();

                this.logger.debug(`QueueServer2:[job complete]: ${JSON.stringify({
                    type: jobJSON.type,
                    data: jobJSON.data
                })}, ${JSON.stringify(result)}`);

                this.archive(job, result);
            });

        }).on('job failed', id => {

            kue.Job.get(id, (err, job) => {
                if (err) return this.logger.error(`QueueServer2:[job failed]: ${err}`);

                const jobJSON = job.toJSON();

                this.logger.debug(`QueueServer2:[job failed]: ${JSON.stringify({
                    type: jobJSON.type,
                    data: jobJSON.data
                })}, ${JSON.stringify(jobJSON.error)}`);

                this.archive(job);
            });
        });
    }

    /**
     * Set worker files directory
     *
     * @param workersDir
     */
    setWorkersDir(workersDir) {

        this._workersDir = workersDir;
    }

    /**
     * Checking worker command
     * @param workerName
     * @param commandName
     */
    checkWorkerCommand(workerName, commandName) {

        if (this._workers.indexOf(workerName + '.js') < 0) {

            throw new Error('Unable to find worker "' + workerName + '" (' + this._workersDir + '/' + workerName + '.js)');
        }

        const worker = require(applicationFacade.basePath + '/' + this._workersDir + '/' + workerName + '.js');

        if (!worker.hasOwnProperty(commandName)) {

            throw new Error('Command "' + commandName + '" not implemented in "' + workerName + '" worker');
        }
    }

    loadWorkers() {

        this._workers = fs.readdirSync(this._workersDir);
    }

    /**
     * Initialize workers
     *
     * @returns {number|Object}
     */
    initWorkers() {

        this._workers.filter(file => {
            return (file.indexOf('.') !== 0);
        }).forEach(file => {

            const workerName = path.basename(file, '.js');

            let workerCommands;

            try {

                workerCommands = require(applicationFacade.basePath + '/' + this._workersDir + '/' + file);

            } catch (err) {

                throw new Error(`QueueServer2::initWorkers: Unable to load file "${file}". ${err.message}`);
            }

            this.logger.info('## Loading worker: %s', workerName);

            this._client.process(workerName, (job, done) => {

                try {
                    this.checkWorkerCommand(workerName, job.data.commandName);
                } catch (err) {
                    throw new Error(`QueueServer2::initWorkers: Unexpected worker command "${workerName}:${job.data.commandName}". ${err.message}`);
                }

                workerCommands[job.data.commandName](job, done);
            });
        });
    }

    archive(job, result) {

        const jobJSON = job.toJSON();

        // console.log(jobJSON);

        this.mongodb.collection('queue_tasks_archives').insert({
            queue: job.type,
            name: job.data.commandName,
            params: job.data.params,
            priority: jobJSON.priority,
            enqueued: new Date(parseInt(jobJSON.created_at)),
            dequeued: new Date(parseInt(jobJSON.started_at)),
            ended: new Date(),
            // delay: new Date(jobJSON.delay),
            attempts: jobJSON.attempts,
            status: jobJSON.state, // complete, failed
            error: jobJSON.error,
            result
        }, err => {
            if (err) return this.logger.error(err);

            job.remove(err => {
                if (err) return this.logger.error(`QueueServer2::archive: ${err}`);

                this.logger.debug(`Removed completed job #${job.id}`);
            });
        });
    }

    /**
     * Run server
     */
    run() {

        // Loading workers from files
        this.loadWorkers();

        // Initializing workers
        this.initWorkers();
    }
}

module.exports = QueueServer2;
