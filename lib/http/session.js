'use strict';

/**
 * Requiring application Facade
 */
const applicationFacade = require('../facade.js').ApplicationFacade.instance;

/**
 * Requiring Session
 *
 * @type {session|exports|module.exports}
 */
const session = require('express-session');

/**
 * MomentJS
 */
const moment = require('moment');

/**
 *  Multi-Tenant handler
 */
class HttpSession {

    /**
     * Returns Session name
     *
     * @returns {string}
     * @constructor
     */
    static get SESSION_NAME() {
        if (applicationFacade.config.env.SESSION_NAME) {
            return applicationFacade.config.env.SESSION_NAME;
        }

        return 'application.sid';
    }

    /**
     * Is session secure or not
     *
     * @returns {boolean}
     */
    static get isSecure() {
        return false;
    }

    /**
     * Creates Session based on Config Values
     */
    static createSession() {
        var sessionType = null;
        var storageDetails = {};
        if (applicationFacade.config.env.SESSION_STORAGE) {
            storageDetails = require('url').parse(applicationFacade.config.env.SESSION_STORAGE, true);
            storageDetails.url = applicationFacade.config.env.SESSION_STORAGE;
            if (storageDetails.protocol != null) {
                sessionType = storageDetails.protocol.toLowerCase().replace(':', '');
            }

            // https://github.com/msanand/docker-workflow/blob/master/node/index.js

            // if (process.env.REDIS_PORT_6379_TCP_ADDR) {
            //     // Override with Docker Redis address
            //     storageDetails.hostname = process.env.REDIS_PORT_6379_TCP_ADDR;
            // }
        }

        if (sessionType == 'redis') {
            return HttpSession.createRedisSession(storageDetails);
        } else if (sessionType == 'mongodb') {
            return HttpSession.createMongoSession(storageDetails);
        } else {
            return HttpSession.createDefaultSession(storageDetails);
        }
    }

    /**
     * Creates Redis Session
     *
     * @returns {*}
     */
    static createRedisSession(storageDetails) {
        var redis = require("redis");
        var RedisStore = require('connect-redis')(session);

        var redisClient = redis.createClient(storageDetails.port, storageDetails.hostname);
        redisClient.on('error', function (err) {
            applicationFacade.logger.warn('ERROR. Redis error: ' + err);
        });
        redisClient.on('connect', function () {
            applicationFacade.logger.debug('Connected to Redis: ' + storageDetails.hostname + ":" + storageDetails.port);
        });

        var storeConfig = {
            client: redisClient,
            ttl: (storageDetails.query != null && storageDetails.query.ttl != null ? storageDetails.query.ttl : 14400)
        };
        var sessionStore = new RedisStore(storeConfig);
        var sessionConfig = {
            resave: true,
            saveUninitialized: true,
            store: sessionStore,
            name: HttpSession.SESSION_NAME,
            // maxAge: new Date(Date.now() + 1440000),
            secret: applicationFacade.config.env.SESSION_SECRET
        };

        if (applicationFacade.config.env.SESSION_DOMAIN) {
            sessionConfig.cookie = {
                domain: applicationFacade.config.env.SESSION_DOMAIN
            }
        }

        if (applicationFacade.config.env.SESSION_EXPIRES) { // 1,day or 7,days or 60,minutes

            if (!sessionConfig.cookie) sessionConfig.cookie = {};

            let tmpArr = applicationFacade.config.env.SESSION_EXPIRES.split(',');

            sessionConfig.cookie.expires = moment().add(tmpArr[0], tmpArr[1]).toDate();
        }

        applicationFacade.logger.debug('#### Initializing Redis session: ', storageDetails.hostname);
        var result = session(sessionConfig);

        return result;
    }

    /**
     * Creates Mongo Session
     *
     * @returns {*}
     */
    static createMongoSession(storageDetails) {
        var redis = require("redis");
        var MongoStore = require('connect-mongo')(session);

        var storeConfig = {
            url: storageDetails.url,
            ttl: (storageDetails.query != null && storageDetails.query.ttl != null ? storageDetails.query.ttl : 86400)
        };
        var sessionStore = new MongoStore(storeConfig);
        var sessionConfig = {
            resave: true,
            saveUninitialized: true,
            store: sessionStore,
            name: HttpSession.SESSION_NAME,
            // maxAge: new Date(Date.now() + 1440000),
            secret: applicationFacade.config.env.SESSION_SECRET
        };

        if (applicationFacade.config.env.SESSION_DOMAIN) {
            sessionConfig.cookie = {
                domain: applicationFacade.config.env.SESSION_DOMAIN
            }
        }

        if (applicationFacade.config.env.SESSION_EXPIRES) { // 1,day or 7,days or 60,minutes

            if (!sessionConfig.cookie) sessionConfig.cookie = {};

            let tmpArr = applicationFacade.config.env.SESSION_EXPIRES.split(',');

            sessionConfig.cookie.expires = moment().add(tmpArr[0], tmpArr[1]).toDate();
        }

        applicationFacade.logger.debug('#### Initializing MongoDB session: ', storageDetails.hostname);
        var result = session(sessionConfig);

        return result;
    }

    /**
     * Creates Default Session
     *
     * @returns {*}
     */
    static createDefaultSession(storageDetails) {
        var result = session({
            resave: true,
            saveUninitialized: true,
            // name: HttpSession.SESSION_NAME,
            secret: applicationFacade.config.env.SESSION_SECRET
        });

        return result;
    }

    /**
     * Set Domain Cookie
     *
     * @param url
     * @param request
     * @param response
     */
    static setDomainCookie(url, request, response) {
        var urlDetails = require('url').parse(url);
        var sessionId = request.sessionID;

        response.cookie(HttpSession.SESSION_NAME, sessionId, {
            domain: urlDetails.hostname,
            path: '/',
            secure: HttpSession.isSecure
        });
    }
}

/**
 * Exporting URL Utils
 *
 * @type {Function}
 */
module.exports = HttpSession;
