'use strict';

const jwt      = require('jsonwebtoken');
const async    = require('async');
const merge    = require('merge');
const mongoose = require('mongoose');

const BaseController = require('../controller.js').Controller;

const APIError = require('../error/api');

const applicationFacade = require('../facade.js').ApplicationFacade.instance;

/**
 *  APIController controller
 */
class APIController extends BaseController {

    /**
     * Controller constructor
     */
    constructor(request, response, next) {
        // We must call super() in child class to have access to 'this' in a constructor
        super(request, response, next);

        /**
         * The default page size
         *
         * @type {number}
         * @private
         */
        this._defaultPageSize = 10;

        /**
         * The maximum page size
         *
         * @type {number}
         * @private
         */
        this._maxPageSize = 100;

        /**
         * Current API model instance
         *
         * @type {MongooseModel}
         * @private
         */
        this._model = null;

        /**
         * API User model
         *
         * @type {null}
         */
        this.userModel = null;

        /**
         * Mongoose Searchable fields
         *
         * @type {string}
         * @private
         */
        this._modelSearchableFields = [];

        /**
         * Mongoose Population fields
         * url: {@link http://mongoosejs.com/docs/populate.html|Mongoose Doc}
         *
         * @type {string}
         * @private
         */
        this._modelPopulateFields = '';

        /**
         * Allow users to write only these fields
         *
         * @type {Array}
         * @private
         */
        this._writableFields = [];

        /**
         * Allow users to read only these fields
         *
         * @type {Array}
         * @private
         */
        this._readableFields = [];

        /**
         * Remove any existing items from response
         * @type {{}}
         */
        this.data = {};

        /**
         * Default sorting field and order
         *
         * @type {{field: string, order: string}}
         * @private
         */
        this._defaultSorting = null;
    }

    /**
     * Current model for CRUD
     *
     * @returns {MongooseModel}
     */
    get model() {
        return this._model;
    }

    /**
     * Current model populate fields
     * @returns {string}
     */
    get modelSearchableFields() {
        return this._modelSearchableFields;
    }

    /**
     * Current model populate fields
     * @returns {string}
     */
    get modelPopulateFields() {
        return this._modelPopulateFields;
    }

    /**
     * Current default page size
     * @returns Number
     */
    get defaultPageSize() {
        return this._defaultPageSize;
    }

    /**
     * Current maximum page size
     * @returns Number
     */
    get maxPageSize() {
        return this._maxPageSize;
    }

    /**
     * Get request token
     * @returns {*}
     */
    get token() {

        let token;

        if (this.request.headers.authorization) {

            // Authorization: Bearer TOKEN_STRING
            if (/^Bearer\s[\d\w_\\.-]+$/.test(this.request.headers.authorization)) {

                token = this.request.headers.authorization.split(' ')[1];
            }
        }

        return token;
    }

    /**
     * Getter for current item ID from the request
     *
     * @returns {*}
     */
    get itemId() {

        return this.request.params.id;
    }

    /**
     * Get action name from request
     *
     * @returns {action|string|string|string}
     */
    get actionName() {

        return this.request.params.action;
    }

    /**
     * Returns view pagination
     *
     * @returns Number
     */
    getViewPageCurrent() {
        if (this.request.query && this.request.query.page) {
            return parseInt(this.request.query.page, 10);
        }
        return 1;
    }

    /**
     * Returns view page size
     *
     * @returns Number
     */
    getViewPageSize() {
        if (this.request.query && this.request.query.limit) {
            let limit = parseInt(this.request.query.limit, 10);

            if (limit > this.maxPageSize) {
                limit = this.maxPageSize;
            }

            if (limit === 0) {
                limit = 1;
            }

            return limit;
        }
        return this.defaultPageSize;
    }

    /**
     * Returns view pagination object
     *
     * @returns {{}}
     */
    getViewPagination() {
        return {
            currentPage: this.getViewPageCurrent(),
            pageSize: this.getViewPageSize()
        };
    }

    /**
     * Returns view filters
     *
     * @returns {{}}
     */
    getViewFilters() {

        const result = {
            search: {
                searchFields: this.modelSearchableFields,
                searchValue: this.getViewSearchValue()
            },
            inField: [],
            customFilters: [],
            sorting: this.getViewSorting()
        };

        if (this.model.responseFields) {
            this.model.responseFields.forEach((field) => {
                if (this.request.query.filter && typeof this.request.query.filter[field] !== 'undefined' && this.request.query.filter[field] !== '') {
                    result.inField.push({fieldName: field, fieldValue: this.request.query.filter[field]});
                }
            });
        }

        if (this.model.customFilters) {
            this.model.customFilters.forEach(filterName => {
                if (this.request.query.filter && typeof this.request.query.filter[filterName] !== 'undefined' && this.request.query.filter[filterName] !== '') {
                    result.customFilters.push({
                        filterName: filterName,
                        filterValue: this.request.query.filter[filterName]
                    });
                }
            });
        }

        return result;
    }

    /**
     * Returns view sorting options
     *
     * @returns {string | null}
     */
    getViewSearchValue() {

        if (!this.request.query.filter) return null;

        return this.getSingleValue(this.request.query.filter.search);
    }

    /**
     * Returns single value from value of a query string parameter in case the parameter has been specified more then one time
     *
     * @param stringOrArrayValue
     * @returns {string}
     */
    getSingleValue(stringOrArrayValue) {

        let singleValue;

        if (!Array.isArray(stringOrArrayValue)) {

            singleValue = stringOrArrayValue;

        } else if (stringOrArrayValue.length > 0) {

            singleValue = stringOrArrayValue[0];
        }

        return singleValue;
    }

    /**
     * Returns view sorting options
     *
     * @returns {{}}
     */
    getViewSorting() {

        let sorting = {};
        let queryFilter;

        if (this.request.query &&
            this.request.query.filter &&
            this.request.query.filter.sortingField &&
            this.request.query.filter.sortingOrder) {

            queryFilter = {
                field: this.request.query.filter.sortingField,
                order: this.request.query.filter.sortingOrder
            };
        }

        if (queryFilter) {

            sorting = queryFilter;

        } else if (this._defaultSorting) {

            sorting = this._defaultSorting;
        }

        return sorting;
    }

    /**
     * Get fields to select from database
     *
     * @returns {Array}
     */
    getViewSelectFields() {

        let selectFields = [];

        if (this.request.query && Array.isArray(this.request.query.select)) {

            selectFields = this.request.query.select;
        }

        return selectFields;
    }

    /**
     * Get lean options
     *
     * @returns {boolean}
     */
    getViewLean() {

        return false;
    }

    /**
     * Extract item details from request
     *
     * @returns {{}}
     */
    getItemDetailsFromRequest() {

        let itemDetails = {};

        this._writableFields.forEach(writableField => {
            if (typeof this.request.body[writableField] !== 'undefined') {

                itemDetails[writableField] = this.request.body[writableField];
            }
        });

        return itemDetails;
    }

    /**
     * Refine item for response
     *
     * @param item
     * @returns {{}}
     */
    refineItemForResponse(item) {

        let refinedItem = {};

        this._readableFields.forEach(readableField => {
            if (typeof item[readableField] !== 'undefined') {

                refinedItem[readableField] = item[readableField];
            }
        });

        if (this._readableFields.indexOf('id') > -1 && typeof item.id === 'undefined' && item._id) {

            refinedItem.id = typeof item._id === 'string' ? item._id : item._id.toString();

            delete refinedItem._id;
        }

        return refinedItem;
    }

    /**
     * Pre load API controller
     *
     * @param callback
     */
    preLoad(callback) {
        super.preLoad(err => {
            if (err) return callback(err);

            this.authenticate(callback);
        });
    }

    /**
     * Initialize load
     *
     * 'put|/items'              Create item
     * 'get|/items'              Get items
     * 'get|/items/:action'      Get action
     * 'get|/items/:id'          Get item
     * 'get|/items/:id/:action'  Get action with item
     * 'post|/items/:id'         Update item
     * 'delete|/items/:id'       Remove item
     *
     * @param callback
     */
    load(callback) {

        if (this.isPutRequest) {

            this.createItem(callback);

        } else if (this.isGetRequest) {

            if (this.itemId) {

                this.loadItem(callback);

            } else {

                this.loadItems(callback);
            }

        } else if (this.isPostRequest) {

            if (this.itemId) {

                this.updateItem(callback);

            } else {

                this.createItem(callback);
            }

        } else if (this.isDeleteRequest) {

            this.removeItem(callback);

        } else {

            callback(new APIError('Bad Request', 400));
        }
    }

    /**
     * Authenticate user by JWT token
     *
     * @param callback
     */
    authenticate(callback) {

        if (!this.token) {

            return callback(new APIError('Invalid API token', 400));
        }

        jwt.verify(this.token, applicationFacade.config.env.API_SESSION_SECRET, (err, decoded) => {
            if (err) {
                this.logger.info(err.message);

                return callback(new APIError('Unauthorized', 401));
            }

            this.userModel.findById(decoded.id, (err, user) => {
                if (err) return callback(err);

                if (!user) {
                    this.logger.warn(`APIController::preLoad: User not found by id "decoded.id"`);

                    return callback(new APIError('Unauthorized', 401));
                }

                this.request.user = user;

                callback();
            });
        });
    }

    /**
     * Check create permissions
     *
     * @abstract
     * @param callback
     */
    canCreate(callback) {

        callback();
    }

    /**
     * Create item
     *
     * @param callback
     */
    createItem(callback) {

        let itemDetails;

        async.series([callback => {

            if (this.isTerminated()) return callback();

            this.canCreate(callback);

        }, callback => {

            if (this.isTerminated()) return callback();

            itemDetails = this.getItemDetailsFromRequest();

            this.model.validate(itemDetails, err => {
                if (err) {
                    this.logger.warning(err);
                    return callback(new APIError('Bad Request', 400));
                }

                callback();
            });

        }, callback => {

            if (this.isTerminated()) return callback();

            this.model.insert(itemDetails, (err, item) => {
                if (err) return callback(err);

                this.item = item;

                callback();
            });

        }, callback => {

            if (this.isTerminated()) return callback();

            this.afterCreate(callback);

        }, callback => {

            if (this.isTerminated()) return callback();

            this.terminate();
            this.response.status(201).json(this.refineItemForResponse(this.item));
            callback();

        }], callback);
    }

    /**
     * After create hook
     *
     * @override
     * @param callback
     */
    afterCreate(callback) {

        callback();
    }

    /**
     * Check get permissions
     *
     * @abstract
     * @param callback
     */
    canGet(callback) {

        if (this.item.user && this.item.user.toString() !== this.request.user.id) {

            return callback(new APIError('Permission Denied', 550));
        }

        callback();
    }

    /**
     * Send one item
     *
     * @param callback
     */
    loadItem(callback) {

        if (!this.itemId) return callback(new APIError('Bad Request', 400));

        async.series([callback => {

            if (this.isTerminated()) return callback();

            this.fetchItem(callback);

        }, callback => {

            if (this.isTerminated()) return callback();

            this.canGet(callback);

        }, callback => {

            if (this.isTerminated()) return callback();

            this.loadAdditionalData(callback);

        }], err => {
            if (err) return callback(err);

            if (this.isTerminated()) return callback();

            this.terminate();
            this.response.status(200)
                .json(merge(this.refineItemForResponse(this.item), this.additionalDataForApiResponse));
            callback();
        });
    }

    fetchItem(callback) {

        this.model.model.findOne({_id: this.itemId}).deepPopulate(this.modelPopulateFields).exec((err, item) => {
            if (err) return callback(err);
            if (!item) return callback(new APIError('Not Found', 404));

            this.item = item;

            callback();
        });
    }

    /**
     * Load additional data for response
     *
     * @abstract
     * @param callback
     */
    loadAdditionalData(callback) {

        this.additionalDataForApiResponse = {};

        callback();
    }

    /**
     * Check list permissions
     *
     * @abstract
     * @param callback
     */
    canList(callback) {

        callback();
    }

    /**
     * Send items
     *
     * @param callback
     */
    loadItems(callback) {

        if (this.isTerminated()) return callback();

        this.canList(err => {
            if (err) return callback(err);

            const populations  = this.modelPopulateFields;
            const pagination   = this.getViewPagination();
            const filters      = this.getViewFilters();
            const sorting      = this.getViewSorting();
            const selectFields = this.getViewSelectFields();
            const lean         = this.getViewLean();

            this.model.getListFilteredForApi({
                filters, populations, pagination, sorting, selectFields, lean
            }, (err, data) => {
                if (err) return callback(err);

                data.items = data.items.map(item => this.refineItemForResponse(item));

                this.terminate();
                this.response.status(200).json(data);

                callback();
            });
        });
    }

    /**
     * Check update permissions
     *
     * @abstract
     * @param callback
     */
    canUpdate(callback) {

        if (this.item.user && this.item.user.toString() !== this.request.user.id) {

            return callback(new APIError('Permission Denied', 550));
        }

        callback();
    }

    /**
     * Update item
     *
     * @param callback
     */
    updateItem(callback) {

        if (!this.itemId) return callback(new APIError('Bad Request', 400));

        let itemDetails = this.getItemDetailsFromRequest();

        this.model.validate(itemDetails, err => {
            if (err) {
                this.logger.warning(err);
                return callback(new APIError('Bad Request', 400));
            }

            this.model.findByIdAndPopulate(this.itemId, this.modelPopulateFields, (err, item) => {
                if (err) return callback(err);
                if (!item) return callback(new APIError('Not Found', 404));

                this.item = item;

                this.canUpdate(err => {
                    if (err) return callback(err);

                    for (let itemDetailField in itemDetails) {
                        if (itemDetails.hasOwnProperty(itemDetailField)) {

                            item[itemDetailField] = itemDetails[itemDetailField];
                        }
                    }

                    item.save(err => {
                        if (err) return callback(err);

                        this.terminate();
                        this.response.status(200).json(this.refineItemForResponse(item));
                        callback();
                    });
                });
            });
        });
    }

    /**
     * Check remove permissions
     *
     * @abstract
     * @param callback
     */
    canRemove(callback) {

        if (this.item.user && this.item.user.toString() !== this.request.user.id) {

            return callback(new APIError('Permission Denied', 550));
        }

        callback();
    }

    /**
     * Delete item
     *
     * @param callback
     */
    removeItem(callback) {

        if (!this.itemId) return callback(new APIError('Bad Request', 400));

        this.model.findById(this.itemId, (err, item) => {
            if (err) return callback(err);
            if (!item) return callback(new APIError('Not Found', 404));

            this.item = item;

            this.canRemove(err => {
                if (err) return callback(err);

                item.remove(err => {
                    if (err) return callback(err);

                    this.terminate();
                    this.response.status(200).json({id: item.id});
                    callback();
                });
            });
        });
    }

    /**
     * Render error
     *
     * @override
     */
    renderError(error) {

        if (error instanceof mongoose.Error.ValidationError) {

            let validationErrors = [];

            for (let validationErrorPath in error.errors) {
                if (error.errors.hasOwnProperty(validationErrorPath)) {

                    let validationError = error.errors[validationErrorPath];

                    validationErrors.push({
                        name: validationError.name,
                        message: validationError.message,
                        path: validationError.path,
                        value: validationError.value,
                        reason: validationError.reason
                    })
                }
            }

            this.logger.warning(`## Mongoose validation error. (action: ${this.actionName}).`, validationErrors);

            error = new APIError('Bad Request', 400);

            this.response.status(error.httpStatus).json({error: error.message});

        } else if (error instanceof APIError) {

            this.logger.warning(`## API Error (action: ${this.actionName}, error: ${error.message}).`, error);

            this.response.status(error.httpStatus).json({error: error.message});

        } else {

            this.logger.error(`## Controller Execution Error (action: ${this.actionName}).`, error);
            this.logger.error(error.stack);

            let httpStatus = error.httpStatus != null && error.httpStatus > 0 ? error.httpStatus : 500;
            this.response.status(httpStatus).json({error: 'Internal Error'});
        }
    }
}

/**
 * Exporting Controller
 *
 * @type {Function}
 */
module.exports = APIController;
