'use strict';

const jwt    = require('jsonwebtoken');
const async  = require('async');
const bcrypt = require('bcrypt-nodejs');

const applicationFacade = require('../facade.js').ApplicationFacade.instance;

const BaseController = require('../controller.js').Controller;
const APIError       = require('../error/api');

/**
 * API Session Controller
 */
class APISessionController extends BaseController {

    /**
     * Controller constructor
     */
    constructor(request, response, next) {
        // We must call super() in child class to have access to 'this' in a constructor
        super(request, response, next);

        /**
         * User API model instance
         *
         * @type {MongooseModel}
         * @private
         */
        this.model = null;

        /**
         * User from DB
         *
         * @type {null}
         */
        this.user = null;
    }

    /**
     * Initialize load
     *
     * 'put|/sessions' Create session
     *
     * @param callback
     */
    load(callback) {

        if (this.isPutRequest) {

            this.createSession(callback);

        } else if (this.isDeleteRequest) {

            this.destroySession(callback);

        } else {

            callback(new APIError('Bad Request', 400));
        }
    }

    /**
     * Create API Session
     *
     * @param callback
     */
    createSession(callback) {

        async.series([callback => {

            this.getUser((err, user) => {
                if (err) return callback(err);

                if (!user) return callback(new APIError('The username or password don\'t match', 401));

                this.user = user;

                callback();
            });

        }, callback => {

            this.canCreate(callback);

        }, callback => {

            this.comparePasswordUser((err, isMatch) => {
                if (err) return callback(err);

                if (!isMatch) return callback(new APIError('The username or password don\'t match', 401));

                callback();
            });

        }, callback => {

            this.terminate();

            this.response.status(201).json({
                token: this.createToken()
            });

            callback();

        }], callback);
    }

    destroySession(callback) {

        // TODO: Destroy token on Backend side

        this.terminate();

        this.response.status(200).end();

        callback();
    }

    /**
     * Get user from request
     *
     * @param callback
     * @returns {*}
     */
    getUser(callback) {

        if (!this.request.body.username) return callback(new APIError('The username or password don\'t match', 401));

        this.model.findOne({
            email: this.request.body.username
        }, (err, user) => {
            if (err) return callback(err);

            if (!user) {

                this.logger.warning(`APISessionController::getUser: user not found for: ${this.request.body.username}`);
            }

            callback(null, user);
        });
    }

    /**
     * Can user create session? Default: yes
     *
     * @param callback
     */
    canCreate(callback) {

        callback();
    }

    /**
     * Compare user password
     *
     * @param callback
     * @returns {*}
     */
    comparePasswordUser(callback) {

        if (!this.request.body.password) return callback(new APIError('The username or password don\'t match', 401));

        bcrypt.compare(this.request.body.password, this.user.password, (err, passwordIsMatch) => {
            if (err) return callback(err);

            callback(null, passwordIsMatch);
        });
    }

    /**
     * Create JWT token
     *
     * @returns {*}
     */
    createToken() {

        let userData = this.obtainUserData(this.user);

        return jwt.sign(userData, applicationFacade.config.env.API_SESSION_SECRET, {
            expiresIn: applicationFacade.config.env.API_SESSION_EXPIRES
        });
    }

    /**
     * Obtain user data
     *
     * @param user
     * @returns {{id}}
     */
    obtainUserData(user) {

        return {
            id: user.id
        }
    }

    /**
     * Render error
     *
     * @override
     */
    renderError(error) {

        if (error instanceof APIError) {

            this.logger.warning(`## API Error (action: ${this.actionName}, error: ${error.message}).`, error);

            this.response.status(error.httpStatus).json({error: error.message});

        } else {

            this.logger.error(`## Controller Execution Error (action: ${this.actionName}).`, error);
            this.logger.error(error.stack);

            let httpStatus = error.httpStatus !== null && error.httpStatus > 0 ? error.httpStatus : 500;
            this.response.status(httpStatus).json({error: 'Internal Error'});
        }
    }
}

/**
 * Exporting Controller
 *
 * @type {Function}
 */
module.exports = APISessionController;
