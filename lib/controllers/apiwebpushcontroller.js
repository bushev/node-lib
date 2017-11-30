'use strict';

const applicationFacade = require('../facade.js').ApplicationFacade.instance;
const BaseAPIController = require('./apicontroller');

class WebPushAPIController extends BaseAPIController {

    constructor(request, response, next) {
        super(request, response, next);

    }

    init(callback) {
        super.init(err => {
            if (err) return callback(err);

            this.registerAction('vapid-public-key', 'getVapidPublicKey');
            this.registerAction('add-subscription', 'addSubscription');

            callback();
        });
    }

    getVapidPublicKey(callback) {

        this.terminate();

        this.response.json({
            vapidPublicKey: applicationFacade.config.env.VAPID_PUBLIC_KEY
        });

        callback();
    }

    addSubscription(callback) {

        let found = false;

        this.request.user.webPushSubscriptions.forEach(webPushSubscription => {

            if (webPushSubscription.endpoint === this.request.body.pushSubscription.endpoint) {
                found = true;
            }
        });

        if (found) {

            this.terminate();
            this.response.end();
            return callback();
        }

        this.request.user.webPushSubscriptions.push(this.request.body.pushSubscription);

        this.request.user.save(err => {
            if (err) return callback(err);

            this.terminate();
            this.response.end();
            callback();
        });
    }
}

/**
 * Exporting Controller
 *
 * @type {Function}
 */
module.exports = WebPushAPIController;
