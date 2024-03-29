'use strict';

const mailGunJs  = require('mailgun-js');
const os         = require('os');
const htmlToText = require('html-to-text');
const juice      = require('juice');

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

        this._mailGun = mailGunJs({
            apiKey: this._config._configuration.MAIL_GUN_API_KEY,
            domain: this._config._configuration.MAIL_GUN_DOMAIN
        });
    }

    /**
     * Sends email
     *
     * @param recipient       Array with recipients of the email {name: '', email: ''}
     * @param message         Object with HTML and text version of email
     * @param opts            Additional options(subject, fromName, fromEmail)
     * @param opts.subject
     * @param opts.fromName
     * @param opts.fromEmail
     * @param [opts.replyTo]
     * @param [opts.attachment]
     * @param [opts.attachment.data]
     * @param [opts.attachment.fileName]
     * @param [opts.sendAsText]
     * @param callback        Callback function
     */
    send(recipient, message, opts, callback) {

        if (typeof opts === 'undefined') {
            opts = {};
        }

        if (typeof callback !== 'function') {
            callback = function () {
            };
        }

        let fromName = this._config.env.sendPulse ? this._config.env.sendPulse.fromName : undefined;
        let fromEmail = this._config.env.sendPulse ? this._config.env.sendPulse.fromEmail : undefined;

        if (typeof opts.fromName !== 'undefined') {
            fromName = opts.fromName;
        }

        if (typeof opts.fromEmail !== 'undefined') {
            fromEmail = opts.fromEmail;
        }

        let email = {
            to: recipient.email,
            subject: opts.subject,
            text: opts.sendAsText ? message : htmlToText.fromString(message),
            html: opts.sendAsText ? '' : juice(message)
        };

        if (fromName) {
            email.from = `${fromName} <${fromEmail}>`;
        } else {
            email.from = `<${fromEmail}>`
        }

        if (opts.replyTo) {

            email['h:Reply-To'] = opts.replyTo;
        }

        if (opts.attachment) {

            email.attachment = new this._mailGun.Attachment({
                data: opts.attachment.data,
                filename: opts.attachment.fileName
            });
        }

        this._mailGun.messages().send(email, (err, body) => {
            if (err) {
                this._logger.error('Mailgun error occurred: ' + err.message);
                return callback(err);
            }

            callback(null, body);
        });
    }
}

/**
 * Exporting view classes
 */
module.exports = Mailer;
