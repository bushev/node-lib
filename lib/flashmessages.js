'use strict';

/**
 * Application Events
 *
 * @type {{SERVER_STARTED: string, MONGO_CONNECTED: string}}
 */
var FlashMessageType = {
    INFO: 'info',
    SUCCESS: 'success',
    ERROR: 'danger',
    WARNING: 'warning'
};


/**
 *  Class that handles all work with flash messages
 */
class FlashMessages {

    /**
     * Constructor
     */
    constructor(request) {
        /**
         * Link to request object
         *
         * @private
         */
        this._request = request;
    }

    /**
     * Add all messages in the list to the storage
     *
     * @param messagesList
     * @param messageType   Type of message (info, error, warning, success)
     */
    addMessages (messagesList, messageType) {
        if (messagesList != null && messagesList.length > 0) {
            for (var i = 0; i < messagesList.length; i++) {
                this.addMessage(messagesList[i], messageType);
            }
        }
    }

    /**
     *  Adds message
     *
     * @param message       Text of message
     * @param messageType   Type of message (info, error, warning, success)
     */
    addMessage(message, messageType) {
        if (this._request == null) {
            return;
        }

        var messageObject = new FlashMessage(message, messageType);

        // check, if common dsc namespace is set in session
        if (this._request.session.dsc === undefined) {
            this._request.session.dsc = {}
        }

        // check, if any message was already defined
        if (this._request.session.dsc.msgs === undefined) {
            this._request.session.dsc.msgs = [];
        }

        switch (messageObject.type) {
            case FlashMessageType.WARNING:
            case FlashMessageType.SUCCESS:
            case FlashMessageType.ERROR:
            {
                this._request.session.dsc.msgs.push(messageObject);
                break;
            }
            case FlashMessageType.INFO:
            default:
            {
                this._request.session.dsc.msgs.push(messageObject);
                break;
            }
        }
    }

    /**
     *  Returns all stored messages
     *
     *  @param flush    Erase messages afterwards
     *
     *  @return Object with all messages and their types (null, if there is no message)
     */
    getMessages(flush) {
        if (this._request == null) {
            return null;
        }

        if (flush === undefined) {
            flush = true;
        }

        // check, if common dsc namespace is set in session
        if (this._request.session.dsc === undefined || this._request.session.dsc.msgs === undefined) {
            return null;
        }

        var result = this._request.session.dsc.msgs;

        if (flush) { // should these messages be erased?
            this._request.session.dsc.msgs = [];
        }

        return result;
    }
}

/**
 * Base flash message struct
 */
class FlashMessage {
    /**
     * Constructor
     */
    constructor(message, type) {
        if (message instanceof Object && message.type != null) {
            this.type = message.type ? message.type : FlashMessageType.INFO;
            this.text = message.message != null ? message.message : message.text;
        } else {
            this.type = type != null ? type : FlashMessageType.INFO;
            this.text = message;
        }
    }
}

module.exports.FlashMessage = FlashMessage;
module.exports.FlashMessages = FlashMessages;
module.exports.FlashMessageType = FlashMessageType;
