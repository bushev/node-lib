'use strict';

/**
 * SendPulse library
 *
 * @type {exports|module.exports}
 */
const sendPulse = require('./api/sendpulse.js');

/**
 * OS module
 *
 * @type {exports|module.exports}
 */
const os = require('os');

/**
 * HTML -> Text conversion library
 *
 * @type {*|exports|module.exports}
 */
const htmlToText = require('html-to-text');

/**
 * Juice will inline our CSS properties into the style attribute
 *
 * @type {*}
 */
const juice = require('juice');

/**
 *  Mailer class that implements Mandrill API
 */
class Mailer {

    /**
     * Constructor
     *
     */
    constructor() {

        /**
         * Global config
         *
         * @private
         */
        this._config = require('./facade.js').ApplicationFacade.instance.config;

        /**
         * Configure mailer
         */
        this.configure();

        /**
         * Requiring system logger
         *
         * @type {Logger|exports|module.exports}
         * @private
         */
        this._logger = require('./logger.js');
    }

    /**
     * Configure mailer
     */
    configure() {

        var userId;
        var secret;

        if (this._config._configuration.SEND_PULSE_USER_ID) {
            userId = this._config._configuration.SEND_PULSE_USER_ID;
        } else if (this._config.env.sendPulse) {
            userId = this._config.env.sendPulse.userId;
        } else {
            throw new Error('SendPulse UserID is not defined');
        }

        if (this._config._configuration.SEND_PULSE_SECRET) {
            secret = this._config._configuration.SEND_PULSE_SECRET;
        } else if (this._config.env.sendPulse) {
            secret = this._config.env.sendPulse.secret;
        } else {
            throw new Error('SendPulse secret is not defined');
        }

        /**
         * SendPulse driver
         *
         * @private
         */
        sendPulse.init(userId, secret, os.tmpdir());
        this._sendPulse = sendPulse;
    }

    /**
     * Sends email
     *
     * @param recipients      Array with recipients of the email [{name: '', email: ''}]
     * @param message         Object with HTML and text version of email
     * @param opts            Additional options(subject, fromName, fromEmail, sendAsText)
     * @param callback        Callback function
     */
    send(recipients, message, opts, callback) {

        if (typeof opts === 'undefined') {
            opts = {};
        }

        if (typeof callback !== 'function') {
            callback = function () {
            };
        }

        var email = {
            html: opts.sendAsText ? undefined : juice(message),
            text: opts.sendAsText ? message : htmlToText.fromString(message),
            subject: opts.subject,
            from: {
                name: this._config.env.sendPulse ? this._config.env.sendPulse.fromName : 'Name is not cofigured',
                email: this._config.env.sendPulse ? this._config.env.sendPulse.fromEmail : 'notconfigured@site.com'
            },
            to: recipients
        };

        if (typeof opts.fromName !== 'undefined') {
            email.from.name = opts.fromName;
        }

        if (typeof opts.fromEmail !== 'undefined') {
            email.from.email = opts.fromEmail;
        }

        this._sendPulse.smtpSendMail(data => {

            if (data.result !== true) {
                this._logger.error('SendPulse error occurred: ' + JSON.stringify(data));
                return callback(new Error('SendPulse: ' + JSON.stringify(data)));
            }

            callback();
        }, email);
    }
}

/**
 * Exporting view classes
 */
module.exports = Mailer;
