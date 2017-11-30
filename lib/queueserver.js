'use strict';

/**
 * Requiring application Facade
 */
var applicationFacade = require('./facade.js').ApplicationFacade.instance;
var ApplicationEvent = require('./facade.js').ApplicationEvent;
var QueueClient = require('./queueclient.js');

var fs = require('fs');
var path = require('path');

/**
 *  Job Queue based on MongoDB
 */
class QueueServer extends QueueClient {

    /**
     * Queue server constructor
     */
    constructor() {
        super();

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

        // Default worker events
        this._workerEvents = {
            // COMPLETE handler
            complete: function (job) {
                var jobResult = job.result;
                try {
                    jobResult = JSON.stringify(job.result);
                } catch (error) {
                    // SKIPPING;
                }
                this._logger.debug('job completed: %s - %s (%s) = %s', job.queue, job.name, job._id, jobResult);
                this.archive(job);
            }.bind(this),

            // DEQUEUED handler
            dequeued: function (job) {
                this._logger.debug('**** Dequeued job: %s', job._id);
            }.bind(this),

            // FAILED handler
            failed: function (job) {
                this._logger.warn('Failed to run job: %s, %s: %s', job._id, job.queue, job.name);

                //// Archive job after all attempts (default set to 3)
                //if (job.attempts.remaining === 0) {
                this.archive(job);
                //}
            }.bind(this),

            // ERROR handler
            error: function (error) {
                this._logger.error(error);
            }.bind(this)
        };
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

        var worker = require('.' + this._workersDir + '/' + workerName + '.js');

        if (!worker.hasOwnProperty(commandName)) {
            throw new Error('Command "' + commandName + '" not implemented in "' + workerName + '" worker');
        }
    }

    /**
     * Set worker events
     *
     * @param workerEvents
     */
    setWorkerEvents(workerEvents) {
        this._workerEvents = workerEvents;
    }

    /**
     * Initialize workers
     *
     * @param events
     * @returns {number|Object}
     */
    loadWorkers() {
        /**
         * Existing worker files in _workerDir
         */
        this._workers = fs.readdirSync(this._workersDir);
    }

    /**
     * Initialize workers
     *
     * @param events
     * @returns {number|Object}
     */
    initWorkers(events) {
        var self = this;

        if (!self._clientInitialized) {
            return setTimeout(function () {
                self.initWorkers(events);
            }, 10);
        }

        this._workers.filter(function (file) {
            return (file.indexOf(".") !== 0);
        }).forEach(function (file) {
            var workerName = path.basename(file, '.js');
            let workerCommands;

            try {

                workerCommands = require(applicationFacade.basePath + '/' + self._workersDir + '/' + file);

            } catch (err) {

                // TODO: Remove job as well
                console.log(err);
            }

            var worker = self._client.worker([workerName], {collection: self._workersCollection, interval: 1000});

            worker.register(workerCommands);
            self._logger.log('## Loading worker: %s', workerName);

            if (events) {
                if (events.complete && typeof events.complete === "function") {
                    self._logger.debug('  ## Registered \'complete\' handler for worker: %s', workerName);
                    worker.on('complete', events.complete);
                }

                if (events.failed && typeof events.failed === "function") {
                    self._logger.debug('  ## Registered \'failed\' handler for worker: %s', workerName);
                    worker.on('failed', events.failed);
                }

                if (events.error && typeof events.error === "function") {
                    self._logger.debug('  ## Registered \'error\' handler for worker: %s', workerName);
                    worker.on('error', events.error);
                }

                if (events.dequeued && typeof events.dequeued === "function") {
                    self._logger.debug('  ## Registered \'dequeued\' handler for worker: %s', workerName);
                    worker.on('dequeued', events.dequeued);
                }
            }

            worker.start();
        });
    }

    /**
     * Run server
     */
    run() {
        super.run();

        // Loading workers from files
        this.loadWorkers();

        // Initializing workers
        this.initWorkers(this._workerEvents);
    }
}

module.exports = QueueServer;
