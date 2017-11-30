'use strict';

/**
 * Requiring application Facade
 */
var applicationFacade = require('./facade.js').ApplicationFacade.instance;

/**
 * Requiring core Events module
 */
var Model = require('./model.js').Model;

/**
 * Requiring Async library
 *
 * @type {async|exports|module.exports}
 */
var async = require('async');

/**
 * Underscore library
 *
 * @type {_|exports|module.exports}
 */
var _ = require('underscore');

/**
 * Change case library
 *
 * @type {exports|module.exports}
 */
var changeCase = require('change-case');

/**
 * Merge library
 * @type {*|exports|module.exports}
 */
var merge = require('merge');

/**
 *  Base Model
 */
class SequelizeModel extends Model {

    /**
     * Model constructor
     */
    constructor(listName) {
        // We must call super() in child class to have access to 'this' in a constructor
        super();

        /**
         * Sequelize instance
         */
        this._sequelize = applicationFacade.sequelize;

        /**
         * Response fields
         *
         * @type {Array}
         */
        this.responseFields = [];

        // Set base list name
        this._list = listName;
    }

    /**
     * Get Sequelize model for current list
     */
    get model() {
        return this._model;
    }

    /**
     * Simple model registration
     *
     * @param schemaObjectDef
     * @param schemaOptionsDef
     */
    createSequelizeModel(schemaObjectDef, schemaOptionsDef) {
        /**
         * Valid sequelize schema
         */
        this._schemaObjectDef = schemaObjectDef;

        /**
         * Valid sequelize options
         */
        this._schemaOptionsDef = schemaOptionsDef || {};

        /**
         * Overwrite with default values
         */
        this._schemaOptionsDef.underscored = true;
        this._schemaOptionsDef.tableName   = changeCase.snakeCase(this._list);

        /**
         * Creating Schema within sequelize
         */
        this._model = this._sequelize.define(this._list, this._schemaObjectDef, this._schemaOptionsDef);

        return this._model;
    }

    /**
     * Returns all items for list
     */
    getAll(callback) {
        this.model.findAll().then(function (items) {
            callback(null, items);
        }).catch(callback);
    }

    /**
     * Prepare pagination details
     *
     * @param pagination
     */
    preparePagination(pagination) {
        pagination.totalPages = Math.ceil(pagination.totalItems / pagination.pageSize);

        if (pagination.currentPage > 3) {
            pagination.firstPage = 1;
        }

        // Page range setup
        var range           = 2;
        pagination.lastPage = false;
        if (pagination.currentPage < pagination.totalPages - range) {
            pagination.lastPage = pagination.totalPages;
        }
        var lowRange = pagination.currentPage - range;
        if (pagination.currentPage - range < 1) {
            lowRange = 1;
        }
        var highRange = pagination.currentPage + range;
        if (pagination.currentPage + range > pagination.totalPages) {
            highRange = pagination.totalPages;
        }
        pagination.pageRange = [];
        for (var x = lowRange; x <= highRange; x++) {
            pagination.pageRange.push(x);
        }

        // Pagination summary string
        var current   = pagination.currentPage - 1;
        var listCount = parseInt(pagination.pageSize + (pagination.pageSize * current));
        if (listCount > pagination.totalItems) {
            listCount = pagination.totalItems;
        }
        var startItem = pagination.pageSize * current + 1;
        if (startItem < 0) {
            startItem = 0;
        }
        if (startItem != 0 || pagination.totalItems != 0) {
            pagination.counterString = "Showing " + startItem + " to " + listCount + " of " + pagination.totalItems + " entries";
        }
    }

    /**
     * Ged filtered list items
     *
     * @param filters
     * @param includes
     * @param pagination
     * @param sorting
     * @param callback
     */
    getListFiltered(filters, includes, pagination, sorting, callback) {

        var locals = {
            filters: filters,
            pagination: pagination,
            sorting: sorting
        };

        // Sequelize filter object
        var listFilters = this.prepareSequelizeFilters(locals);

        // Sequelize sorting object
        var listOrder = this.prepareSequelizeSort(locals);

        console.log(listFilters);
        console.log(listOrder);

        // Processing final actions
        this._logger.debug('Loading list of items according filters');

        async.series([
            // Get number of elements in the collection according the filters
            (asyncCallback) => {
                this.model.count({where: listFilters}).then((itemsCount) => {

                    locals.pagination.totalItems = itemsCount;

                    this.preparePagination(locals.pagination);

                    asyncCallback();

                }).catch(asyncCallback);
            },
            (asyncCallback) => {

                this.model.findAll({
                    where: listFilters,
                    include: includes,
                    offset: locals.pagination.pageSize * (locals.pagination.currentPage - 1),
                    limit: locals.pagination.pageSize,
                    order: listOrder
                }).then((items) => {

                    locals.items = items;

                    asyncCallback();

                }).catch(asyncCallback);

            }
        ], (error) => {
            callback(error, (error == null ? locals : null));
        });
    }

    /**
     * Prepare Filters for Sequelize
     *
     * @param locals
     */
    prepareSequelizeFilters (locals) {

        var searchFilters = null;
        if (locals.filters.search && locals.filters.search.searchValue && locals.filters.search.searchFields.length) {

            searchFilters = {};

            if (locals.filters.search.searchFields.length > 1) {
                searchFilters.$or = [];
                locals.filters.search.searchFields.forEach((item) => {
                    var q   = {};
                    q[item] = {$like: '%' + locals.filters.search.searchValue.trim() + '%'};
                    searchFilters.$or.push(q);
                });
            } else {
                searchFilters[locals.filters.search.searchFields[0]] = {$like: '%' + locals.filters.search.searchValue.trim() + '%'};
            }
        }

        var inFieldFilter = null;

        if (locals.filters.inField && locals.filters.inField.length > 0) {
            inFieldFilter = {};

            locals.filters.inField.forEach(function (item) {
                if (_.isArray(item.fieldValue)) {
                    inFieldFilter[item.fieldName] = {$in: item.fieldValue};
                } else {
                    inFieldFilter[item.fieldName] = item.fieldValue;
                }
            });
        }

        var customFilter = null;

        if (locals.filters.customFilter) {
            customFilter = locals.filters.customFilter;
        }

        // Build $and array
        var listFilters = {};

        listFilters.$and = [];

        if (searchFilters) {
            listFilters.$and.push(searchFilters);
        }

        if (inFieldFilter) {
            listFilters.$and.push(inFieldFilter);
        }

        if (customFilter) {
            listFilters.$and.push(customFilter);
        }

        if (listFilters.$and.length === 1) {
            listFilters = listFilters.$and[0];
        } else if (listFilters.$and.length === 0) {
            listFilters = {};
        }

        return listFilters;
    }

    /**
     * Prepare Sorting object for Sequelize
     *
     * @param locals
     */
    prepareSequelizeSort (locals) {
        // Prepare sorting object for MySQL
        var listOrder = [];
        if (locals.sorting.field && locals.sorting.order) {
            var order = ['asc', 'desc'].indexOf(locals.sorting.order) > -1 ? locals.sorting.order : 'asc';
            listOrder = [locals.sorting.field, order];
        }

        return listOrder.length === 0 ? [['id', 'desc']] : [listOrder];
    }

    /**
     * Returns one item for specified criteria
     */
    findAll(query, callback) {
        this.model.findAll(query).then(function (items) {
            callback(null, items);
        }).catch(callback);
    }

    /**
     * Returns one item for specified criteria
     */
    findOne(criteria, callback) {
        this.model.findOne({where: criteria}).then(function (item) {
            callback(null, item);
        }).catch(callback);
    }

    /**
     * Returns one document for specified ID
     */
    findById(id, callback) {
        this.model.findById(id).then(function (item) {
            callback(null, item);
        }).catch(callback);
    }

    /**
     * Returns one document for specified ID
     */
    findByIdAndPopulate(id, include, callback) {
        this.model.findOne({
            where: {id: id},
            include: include
        }).then((item) => {
            callback(null, item);
        }).catch(callback);
    }

    /**
     * Returns one document for specified slug
     */
    findBySlug(slug, callback) {
        this.model.findOne({where: {slug: slug}}).then(function (item) {
            callback(null, item);
        }).catch(callback);
    }

    /**
     * Remove item for specified ID
     * @param {String} id - ID of item.
     * @param {String|Function} [lastModifiedBy] - Current user
     * @param {Function} [callback] - Callback function.
     */
    removeById(id, lastModifiedBy, callback) {

        if (typeof callback === 'undefined') {
            callback = lastModifiedBy;
        }

        this.findById(id, function (error, item) {
            if (error != null) {
                return callback(error);
            }

            if (item != null) {
                item.destroy().then(function () {
                    callback(null, item);
                }).catch(callback);
            } else {
                callback();
            }
        });
    }

    /**
     * Insert item to the list
     */
    insert(details, callback) {
        this.model.create(details).then(function (item) {
            callback(null, item);
        }).catch(function (err) {
            console.log(err.stack);
            if (err.name === 'SequelizeValidationError') {
                callback(new Error(err.message.replace('Validation error: ', '')));
            } else {
                callback(err);
            }
        }.bind(this));
    }

    /**
     * Update item
     *
     * @param details
     * @param callback
     */
    save(details, callback) {
        details.save().then(() => {
            console.log(details);
            callback(null, details);
        }).catch((err) => {
            console.log(err.stack);
            if (err.name === 'SequelizeValidationError') {
                callback(new Error(err.message.replace('Validation error: ', '')));
            } else {
                callback(err);
            }
        });
    }

    /**
     * Validate item
     *
     * @param item
     * @param callback
     */
    validate(item, callback) {
        callback();
    }

}

/**
 *  Validation Error
 */
class ValidationError extends Error {

    /**
     * Error constructor
     */
    constructor(message, id) {
        // We must call super() in child class to have access to 'this' in a constructor
        super(message, id)

        // Initializing messages list
        this._messages = [];

        // Add message to list of messages
        this.addMessage(message);
    }

    /**
     * Get list of validation messages
     *
     * @returns {Array}
     */
    get messages() {
        return this._messages;
    }

    /**
     * Add message to the list of messages
     *
     * @param message
     */
    addMessage(message) {
        if (message != null) {
            this._messages.push(message);
        }
    }

    /**
     * Attach error to list of validation errors
     *
     * @param error
     * @param message
     * @param id
     * @returns {ValidationError}
     */
    static attachError(error, message, id) {
        var result = error;

        if (error == null) {
            result = new ValidationError(message, id);
        } else {
            result.addMessage(message);
        }

        return result;
    }

    /**
     * Create validation error based on messages list
     *
     * @param messages
     * @returns {ValidationError}
     */
    static create(messages) {
        var result = null;
        if (messages != null && messages.length > 0) {
            for (var i = 0; i < messages.length; i++) {
                result = ValidationError.attachError(result, messages[i])
            }
        }

        return result;
    }
}

/**
 * Exporting Model Classes and Events
 */
module.exports.SequelizeModel  = SequelizeModel;
module.exports.ValidationError = ValidationError;