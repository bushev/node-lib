'use strict';

const _ = require('lodash');

const BaseAPIController = require('./apicontroller');
const APIError          = require('../error/api');

/**
 * PUSH Device controller
 */
class APIPushDeviceController extends BaseAPIController {

    /**
     * Add new device token for user if token is not exists yet
     *
     * @param callback
     * @returns {*}
     */
    load(callback) {

        let platform    = this.request.body.platform;
        let deviceToken = this.request.body.deviceToken;

        if (!platform || ['ios', 'android'].indexOf(platform) === -1) {

            return callback(new APIError('Bad Request', 400));
        }

        if (!deviceToken || typeof deviceToken !== 'string') {

            return callback(new APIError('Bad Request', 400));
        }

        let knownDeviceToken = _.find(this.request.user.pushDevices, {deviceToken: deviceToken});

        if (knownDeviceToken) { // device token already known

            this.terminate();
            this.response.status(200).end();
            return callback();
        }

        this.request.user.pushDevices.push({
            platform: platform,
            deviceToken: deviceToken
        });

        this.request.user.save(err => {
            if (err) return callback(err);

            this.terminate();
            this.response.status(201).end();
            callback();
        });
    }
}

/**
 * Exporting Controller
 *
 * @type {Function}
 */
module.exports = APIPushDeviceController;