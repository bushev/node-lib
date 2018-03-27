'use strict';

const _     = require('lodash');
const async = require('async');

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

        const platform       = this.request.body.platform;
        const deviceToken    = this.request.body.deviceToken;
        const uniqueDeviceID = this.request.body.uniqueDeviceID;

        if (!platform || ['ios', 'android'].indexOf(platform) === -1) {

            return callback(new APIError('Bad Request', 400));
        }

        if (!deviceToken || typeof deviceToken !== 'string') {

            return callback(new APIError('Bad Request', 400));
        }

        if (!uniqueDeviceID || typeof uniqueDeviceID !== 'string') {

            this.logger.error(`APIPushDeviceController::load: uniqueDeviceID is unknown: "${uniqueDeviceID}"`);

            return callback(new APIError('Bad Request', 400));
        }

        const knownDeviceToken = _.find(this.request.user.pushDevices, {deviceToken});

        if (knownDeviceToken) { // device token is already known

            this.terminate();
            this.response.status(200).end();
            return callback();
        }

        // Remove old tokens for this device
        this.request.user.pushDevices = this.request.user.pushDevices.filter(pushDevice => {
            if (!pushDevice.uniqueDeviceID) return true; // TODO: Remove this check in a future

            return pushDevice.uniqueDeviceID !== uniqueDeviceID;
        });

        this.request.user.pushDevices.push({
            platform,
            deviceToken,
            uniqueDeviceID
        });

        this.request.user.save(err => {
            if (err) return callback(err);

            this.terminate();
            this.response.status(201).end();
            callback();
        });

        // Unbind all push devices with the same `uniqueDeviceID` from other accounts
        this.userModel.model.find({
            'pushDevices.uniqueDeviceID': uniqueDeviceID,
            _id: {$ne: this.request.user.id}
        }, (err, users) => {
            if (err) return this.logger.error(`APIPushDeviceController::load: ${err.message}`);

            async.eachSeries(users, (user, callback) => {

                user.pushDevices = user.pushDevices.filter(pushDevice => {
                    if (!pushDevice.uniqueDeviceID) return true; // TODO: Remove this check in a future

                    return pushDevice.uniqueDeviceID !== uniqueDeviceID;
                });

                user.save(callback);

            }, err => {
                if (err) return this.logger.error(`APIPushDeviceController::load: ${err.message}`);
            });
        });
    }
}

/**
 * Exporting Controller
 *
 * @type {Function}
 */
module.exports = APIPushDeviceController;
