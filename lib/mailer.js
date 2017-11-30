'use strict';

/**
 *  Mailer class that implements Mandrill API
 */
class Mailer {

    /**
     * Constructor
     *
     */
    constructor () {

        /**
         * Global config
         *
         * @private
         */
        this._config = require('./facade.js').ApplicationFacade.instance.config;

        /**
         * Mandrill driver
         *
         * @private
         */
        this._mandrill = new (require('mandrill-api/mandrill')).Mandrill(this._config.env.mandrill.apiKey);

        /**
         * Requiring system logger
         *
         * @type {Logger|exports|module.exports}
         * @private
         */
        this._logger = require('./logger.js');
    }

    /**
     * Sends email
     *
     * @param   recipient       Array with recipients of the email
     * @param   message         Object with HTML and text version of email
     * @param   opts            Additional options(subject = undefined, async = true, important = false, track_clicks = true, track_opens = true)
     * @param   callback        Callback function after emails are successfully sent
     * @param   callbackError   Callback function after there was an error during sending emails
     */
    send(recipient, message, opts, callback, callbackError){

        if( opts === undefined ) {
            opts = {};
        }

        var from = {
            'name' : this._config.env.mandrill.fromName,
            'email' : this._config.env.mandrill.fromEmail
        };

        if( opts.from_name !== undefined ){
            from.name = opts.from_name;
        }
        if( opts.from_email !== undefined ){
            from.email = opts.from_email;
        }

        var toPart = recipient.map(function(item){
            return {
                "email": item,
                "type": "to"
            }
        });

        var important = false;
        if( opts.important !== undefined ){
            important = opts.important;
        }
        var track_clicks = true;
        if( opts.track_clicks !== undefined ){
            track_clicks = opts.track_clicks;
        }
        var track_opens = true;
        if( opts.track_opens !== undefined ){
            track_opens = opts.track_opens;
        }

        var msg = {
            "html": message.html,
            "text": message.text,
            "subject": opts.subject,
            "from_email": from.email,
            "from_name": from.name,
            "to": toPart,
            "preserve_recipients" : false,
            "important" : important,
            "track_clicks" : track_clicks,
            "track_opens" : track_opens
        };

        var async = true;
        if( opts.async !== undefined ){
            async = opts.async;
        }

        var that = this;
        this._mandrill.messages.send({"message": msg, "async": async}, function(result) {
            if( callback !== undefined ){
                callback(result);
            }
        }, function(e) {
            that._logger.error('A mandrill error occurred: ' + e.name + ' - ' + e.message);
            if( callbackError !== undefined ){
                callbackError(e);
            }
        });
    }
};

/**
 * Exporting view classes
 */
module.exports = Mailer;
