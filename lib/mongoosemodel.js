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
 * Lodash helper
 *
 * @type {_|exports|module.exports}
 * @private
 */
var _ = require('lodash');

/**
 * Stream library: https://github.com/dominictarr/event-stream
 *
 * @type {exports|module.exports}
 */
var eventStream = require('event-stream');

/**
 * Objects helper
 *
 * @type {*|exports|module.exports}
 */
var objectPath = require('object-path');

/**
 * Mongoose ODM
 *
 * @type {*|exports|module.exports}
 */
const mongoose = require('mongoose');
require('mongoose-type-email');

var deepPopulate = require('mongoose-deep-populate')(mongoose);

/**
 *  Base Model
 */
class MongooseModel extends Model {

    /**
     * Model constructor
     */
    constructor(listName) {
        // We must call super() in child class to have access to 'this' in a constructor
        super();

        /**
         * Mongoose Instance
         *
         * @type {*|mongoose|module.exports|*}
         * @private
         */
        this._mongoose = applicationFacade.mongoose;

        // Set base list name
        this._list = listName;

        // Schema definition
        this._schema = null;

        /**
         * Root directory for model
         *
         * @type {String}
         * @private
         */
        this._modelRoot = applicationFacade.basePath + '/app/models/common/';

        /**
         * Rules for mandatory fields validation
         *
         * @type {Array}
         * @private
         */
        this._validationMandatoryFields = [];

        /**
         * Custom validation rules
         *
         * @type {Array}
         * @private
         */
        this._customValidators = [];
    }

    /**
     * Get Mongoose instance
     *
     * @returns {*|mongoose|module.exports|*}
     */
    get mongoose() {
        return this._mongoose;
    }

    /**
     * Get Mongoose list (model) name
     *
     * @returns {String}
     */
    get listName() {
        return this._list;
    }

    /**
     * Get Mongoose model for current list
     *
     * @returns {*|mongoose|module.exports|*}
     */
    get model() {
        if (this._model == null) {
            this._model = this.mongoose.model(this._list);
        }

        return this._model;
    }

    /**
     * Get Mongoose model for current list
     *
     * @returns {*|mongoose|module.exports|*}
     */
    get schema() {
        if (this._schema == null && this.model != null) {
            this._schema = this.model.schema;
        }

        return this._schema;
    }

    get validationMandatoryFields() {
        return this._validationMandatoryFields;
    }

    get customValidators() {
        return this._customValidators;
    }

    /**
     * Loading DBO for model
     */
    initSchema(dboPath) {
        if (dboPath != null) {
            this._schema = require(this._modelRoot + dboPath);
        }

        this._model = this.mongoose.model(this._list, this._schema);
    }

    /**
     * Simple schema registration
     *
     * @param schemaObjectDef
     * @param options
     */
    createSchema(schemaObjectDef, options) {
        /**
         * Valid mongoose schema
         */
        this._schemaObjectDef = schemaObjectDef;

        /**
         * Creating Schema within mongoose
         *
         * @type {*|{mongo}}
         * @private
         */
        this._schema = this.mongoose.Schema(this._schemaObjectDef, options);

        /**
         * Deep populate plugin
         */
        this._schema.plugin(deepPopulate);

        return this._schema;
    }

    /**
     * Simple schema registration
     *
     * @param schemaObject Optional parameter
     * @param listName Optional parameter
     */
    registerSchema(schemaObject, listName) {
        if (listName != null) {
            this._list = listName;
        }

        /**
         * Valid mongoose schema
         */
        if (schemaObject != null) {
            this._schema = schemaObject;
        }

        this._schema.pre('save', true, function (next, done) {
            // calling next kicks off the next middleware in parallel
            next();

            this.validationStatus = 'pending';
            done();
        });

        this._schema.pre('save', function (next) {
            this.wasNew = this.isNew;
            next();
        });

        // Validation is disabled for now
        //this.schema.post('save', instance => {
        //    setTimeout(() => {
        //        // Use timeout for validation
        //        this.validateInstance(instance);
        //    }, 5000);
        //});

        /**
         * From mongoose v4.8.0 all hooks must be registered before model creation
         */
        this.registerHooks();

        /**
         * Registering Schema within mongoose
         *
         * @type {*|{mongo}}
         * @private
         */
        this._model = this.mongoose.model(this._list, this._schema);

        // Initializing schema from valid object
        this._schema = this._model.schema;
    }

    /**
     * Register mongoose hooks
     *
     * @abstract
     */
    registerHooks() {

    }

    /**
     * Returns all items for list
     */
    getAll(callback) {
        this.model.find({}, function (err, items) {
            if (err != null) {
                callback(err);
            } else {
                callback(null, items);
            }
        });
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
        if ((startItem != 0 || pagination.totalItems != 0) && pagination.counterStringTemplate) {

            let replacements = {
                '%startItem%': startItem,
                '%listCount%': listCount,
                '%totalItems%': pagination.totalItems
            };

            pagination.counterString = pagination.counterStringTemplate;

            for (let replacement in replacements) {

                pagination.counterString = pagination.counterString.replace(replacement, replacements[replacement]);
            }
        }
    }

    /**
     * Returns filtered list of items
     *
     * @param {Object} filters - Filters set
     *
     * @param {Object} [filters.search] - Search filter
     * @param {String} filters.search.searchValue - Search filter value to search
     * @param {Array} filters.search.searchFields - Search fields
     *
     * @param {Array} [filters.relation] - Relations filter
     * @param {String} filters.relation.fieldName - Relations filter item name
     * @param {String|Array} filters.relation.fieldValue - Relations filter item value
     *
     * @param {Array} [filters.inField] - In Field filter
     * @param {String} filters.inField.fieldName - In Field filter item name
     * @param {String|Array} filters.inField.fieldValue - In Field filter item value
     *
     * @param {Object} populations
     * @param {Object} pagination
     * @param {Object} sorting
     * @param {Function} callback
     *
     * @deprecated
     */
    getListFiltered(filters, populations, pagination, sorting, callback) {

        const locals = {
            filters: filters,
            pagination: pagination,
            sorting: sorting
        };

        // Mongoose filter object
        let mongoFilters;

        // Mongoose sorting object
        let mongoSort;

        // Processing final actions
        this._logger.debug('Loading list of items according filters');

        async.series([
            (asyncCallback) => {
                this.prepareMongoFilters(locals, (err, filters) => {
                    if (err) return asyncCallback(err);

                    mongoFilters = filters;

                    asyncCallback();
                });
            },
            (asyncCallback) => {
                this.prepareMongoSort(locals, (err, sort) => {
                    if (err) return asyncCallback(err);

                    mongoSort = sort;

                    asyncCallback();
                });
            },
            // Get number of elements in the collection according the filters
            (asyncCallback) => {
                this.countListFiltered(mongoFilters, (err, itemsCount) => {
                    if (err) return asyncCallback(err);

                    locals.pagination.totalItems = itemsCount;

                    this.preparePagination(locals.pagination);

                    asyncCallback();
                });
            },
            // Get items from the collection according the filters
            (asyncCallback) => {
                this.fetchListFiltered(locals, populations, mongoFilters, mongoSort, function (err, items) {
                    if (err) return asyncCallback(err);

                    locals.items = items;

                    asyncCallback();
                });
            }
        ], (err) => {
            callback(err, (err == null ? locals : null));
        });
    }

    /**
     * Returns filtered list of items
     *
     * @param {Object} options
     *
     * @param {Object} options.filters - Filters set
     *
     * @param {Object} [options.filters.search] - Search filter
     * @param {String} options.filters.search.searchValue - Search filter value to search
     * @param {Array} options.filters.search.searchFields - Search fields
     *
     * @param {Array} [options.filters.relation] - Relations filter
     * @param {String} options.filters.relation.fieldName - Relations filter item name
     * @param {String|Array} options.filters.relation.fieldValue - Relations filter item value
     *
     * @param {Array} [options.filters.inField] - In Field filter
     * @param {String} options.filters.inField.fieldName - In Field filter item name
     * @param {String|Array} options.filters.inField.fieldValue - In Field filter item value
     *
     * @param {Object} options.populations
     * @param {Object} options.pagination
     * @param {Object} options.sorting
     * @param {Object} options.selectFields
     * @param {Object} [options.lean] {boolean}
     * @param {Function} callback
     */
    getListFilteredV2(options, callback) {

        const locals = {
            filters: options.filters,
            pagination: options.pagination,
            sorting: options.sorting
        };

        // Mongoose filter object
        let mongoFilters;

        // Mongoose sorting object
        let mongoSort;

        // Processing final actions
        this._logger.debug('Loading list of items according filters');

        async.series([
            (asyncCallback) => {
                this.prepareMongoFilters(locals, (err, filters) => {
                    if (err) return asyncCallback(err);

                    mongoFilters = filters;

                    asyncCallback();
                });
            },
            (asyncCallback) => {
                this.prepareMongoSort(locals, (err, sort) => {
                    if (err) return asyncCallback(err);

                    mongoSort = sort;

                    asyncCallback();
                });
            },
            // Get number of elements in the collection according the filters
            (asyncCallback) => {
                this.countListFiltered(mongoFilters, (err, itemsCount) => {
                    if (err) return asyncCallback(err);

                    locals.pagination.totalItems = itemsCount;

                    this.preparePagination(locals.pagination);

                    asyncCallback();
                });
            },
            // Get items from the collection according the filters
            (asyncCallback) => {
                this.fetchListFilteredV2({
                    locals,
                    populations: options.populations,
                    mongoFilters,
                    mongoSort,
                    selectFields: options.selectFields,
                    lean: options.lean
                }, function (err, items) {
                    if (err) return asyncCallback(err);

                    locals.items = items;

                    asyncCallback();
                });
            }
        ], (err) => {
            callback(err, (err == null ? locals : null));
        });
    }

    /**
     * Returns filtered items stream
     *
     * @param {Object} filters - Filters set
     *
     * @param {Object} [filters.search] - Search filter
     * @param {String} filters.search.searchValue - Search filter value to search
     * @param {Array} filters.search.searchFields - Search fields
     *
     * @param {Array} [filters.relation] - Relations filter
     * @param {String} filters.relation.fieldName - Relations filter item name
     * @param {String|Array} filters.relation.fieldValue - Relations filter item value
     *
     * @param {Array} [filters.inField] - In Field filter
     * @param {String} filters.inField.fieldName - In Field filter item name
     * @param {String|Array} filters.inField.fieldValue - In Field filter item value
     *
     * @param {Object} populations
     * @param {Object} sorting
     *
     * @param {Function} callback
     */
    getStreamFiltered(filters, populations, sorting, callback) {

        this.logger.debug(`MongooseModel::getStreamFiltered: Get items stream according filters`);

        const locals = {
            filters: filters,
            sorting: sorting
        };

        // Mongoose filter object
        let mongoFilters;

        // Mongoose sorting object
        let mongoSort;

        async.series([(callback) => {
            this.prepareMongoFilters(locals, (err, filters) => {
                if (err) return callback(err);

                mongoFilters = filters;

                callback();
            });
        }, (callback) => {
            this.prepareMongoSort(locals, (err, sort) => {
                if (err) return callback(err);

                mongoSort = sort;

                callback();
            });
        }], (err) => {
            if (err) return callback(err);

            callback(null, this.fetchStreamFiltered(populations, mongoFilters, mongoSort));
        });
    }

    /**
     * Returns filtered items list count
     *
     * @param {Object} filters - Filters set
     *
     * @param {Object} [filters.search] - Search filter
     * @param {String} filters.search.searchValue - Search filter value to search
     * @param {Array} filters.search.searchFields - Search fields
     *
     * @param {Array} [filters.relation] - Relations filter
     * @param {String} filters.relation.fieldName - Relations filter item name
     * @param {String|Array} filters.relation.fieldValue - Relations filter item value
     *
     * @param {Array} [filters.inField] - In Field filter
     * @param {String} filters.inField.fieldName - In Field filter item name
     * @param {String|Array} filters.inField.fieldValue - In Field filter item value
     *
     * @param {Function} callback
     */
    getListCountFiltered(filters, callback) {

        const locals = {
            filters: filters
        };

        // Mongoose filter object
        let mongoFilters;

        async.series([(callback) => {
            this.prepareMongoFilters(locals, (err, filters) => {
                if (err) return callback(err);

                mongoFilters = filters;

                callback();
            });
        }], (err) => {
            if (err) return callback(err);

            this.countListFiltered(mongoFilters, callback);
        });
    }

    /**
     * Prepare Filters for MongoDB
     *
     * @param locals
     * @param callback
     */
    prepareMongoFilters(locals, callback) {

        if (typeof callback !== 'function') {

            callback = (err) => {
                if (err) this.logger.error(err);
            }
        }

        var mongoFilters   = {};
        var relationFilter = null;
        var inFieldFilter  = null;

        // If only one relation filter set we should create it as array
        if (locals.filters.relation != null && locals.filters.relation.length == null && locals.filters.relation.fieldName != null) {
            relationFilter = locals.filters.relation;

            locals.filters.relation = [];
            locals.filters.relation.push(relationFilter);
        }

        if (locals.filters.relation && locals.filters.relation.length > 0) {
            relationFilter = {};

            locals.filters.relation.forEach(function (item) {
                if (_.isArray(item.fieldValue)) {
                    relationFilter[item.fieldName] = {$in: item.fieldValue};
                } else {
                    relationFilter[item.fieldName] = item.fieldValue;
                }
            });
        }

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

        const searchFilters = this.prepareSearchFilters(locals);

        mongoFilters.$and = [];

        if (searchFilters) {
            mongoFilters.$and.push(searchFilters);
        }

        if (relationFilter) {
            mongoFilters.$and.push(relationFilter);
        }

        if (inFieldFilter) {
            mongoFilters.$and.push(inFieldFilter);
        }

        async.series([(callback) => {

            if (typeof this.addCustomFilters !== 'function') {

                return callback();
            }

            // Add possibility to add custom filter to mongoose query
            this.addCustomFilters(mongoFilters, locals.filters.customFilters, (err, updatedMongoFilters) => {
                if (err) return callback(err);

                mongoFilters = updatedMongoFilters;

                callback();
            });

        }], (err) => {
            if (err) return callback(err);

            if (mongoFilters.$and.length === 1) {
                mongoFilters = mongoFilters.$and[0];
            } else if (mongoFilters.$and.length === 0) {
                mongoFilters = {};
            }

            callback(null, mongoFilters);
        });
    }

    prepareSearchFilters(locals) {

        let searchFilters = null;

        // Prepare users search input if any
        if (locals.filters.search && locals.filters.search.searchValue && locals.filters.search.searchFields.length) {

            const re = new RegExp('.*' + locals.filters.search.searchValue.trim() + '.*', 'gi');

            searchFilters = {};

            if (locals.filters.search.searchFields.length > 1) {

                searchFilters.$or = [];

                locals.filters.search.searchFields.forEach(item => {

                    const q = {};

                    q[item] = {$regex: re};

                    searchFilters.$or.push(q);
                });

            } else {

                searchFilters[locals.filters.search.searchFields[0]] = {$regex: re};
            }
        }

        return searchFilters;
    }

    /**
     * Prepare Sorting object for MongoDB
     *
     * @param locals
     * @param callback
     */
    prepareMongoSort(locals, callback) {

        const mongoSort = {};

        if (locals.sorting.field && locals.sorting.order) {

            mongoSort[locals.sorting.field] =
                ['asc', 'desc'].indexOf(locals.sorting.order) > -1 ? locals.sorting.order : 'asc';
        }

        callback(null, mongoSort);
    }

    /**
     * Count list items according a filter
     *
     * @param mongoFilters
     * @param callback
     */
    countListFiltered(mongoFilters, callback) {

        this.model.count(mongoFilters, function (error, itemsCount) {
            callback(error, itemsCount);
        });
    }

    /**
     * Fetch list items according a filter
     *
     * @param locals
     * @param populations
     * @param mongoSort
     * @param mongoFilters
     * @param callback
     *
     * @deprecated
     */
    fetchListFiltered(locals, populations, mongoFilters, mongoSort, callback) {

        this
            .model
            .find(mongoFilters)
            .sort(mongoSort)
            .populate(populations || '')
            .limit(locals.pagination.pageSize)
            .skip(locals.pagination.pageSize * (locals.pagination.currentPage - 1))
            .exec(callback);
    }

    /**
     * Fetch list items according a filter
     *
     * @param options
     * @param options.locals
     * @param [options.populations]
     * @param options.mongoSort
     * @param options.mongoFilters
     * @param [options.selectFields]
     * @param [options.lean] {boolean}
     * @param callback
     */
    fetchListFilteredV2(options, callback) {

        const query = this
            .model
            .find(options.mongoFilters)
            .sort(options.mongoSort)
            .limit(options.locals.pagination.pageSize)
            .skip(options.locals.pagination.pageSize * (options.locals.pagination.currentPage - 1));

        if (options.selectFields && options.selectFields.length > 0) {

            query.select(options.selectFields.join(' '));
        }

        if (options.populations) {

            query.populate(options.populations);
        }

        if (options.lean) {

            query.lean();
        }

        query.exec(callback);
    }

    /**
     * Get items stream according a filter
     *
     * @param populations
     * @param mongoSort
     * @param mongoFilters
     */
    fetchStreamFiltered(populations, mongoFilters, mongoSort) {

        return this
            .model
            .find(mongoFilters)
            .sort(mongoSort)
            .populate(populations || '')
            .cursor();
    }

    /**
     * Returns one item for specified criteria
     */
    findOne(criteria, callback) {
        this.model.findOne(criteria, function (err, item) {
            if (err != null) {
                callback(err);
            } else {
                callback(null, item);
            }
        });
    }

    /**
     * Returns items for specified criteria
     */
    findAll(criteria, callback) {
        this.model.find(criteria, function (err, items) {
            if (err != null) {
                callback(err);
            } else {
                callback(null, items);
            }
        });
    }

    /**
     * Returns one document for specified ID
     */
    findById(id, callback) {
        this.model.findById(id, function (err, item) {
            callback(err, item);
        });
    }

    /**
     * Returns one document for specified ID
     */
    findByIdAndPopulate(id, populations, callback) {
        this.model.findOne({_id: id}).deepPopulate(populations || '').exec((err, item) => {
            callback(err, item);
        });
    }

    /**
     * Returns one document for specified slug
     */
    findBySlugAndPopulate(id, populations, callback) {
        this.model.findOne({slug: id}).populate(populations || '').exec((err, item) => {
            callback(err, item);
        });
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

        this.model.findById(id, function (error, item) {
            if (error != null) {
                return callback(error);
            }

            // Removing item from the collection
            if (item != null) {
                item.lastModifiedBy = lastModifiedBy;
                item.remove(function (error) {
                    callback(error, item);
                });
            } else {
                callback();
            }
        });
    }

    /**
     * Insert item to the list
     */
    insert(details, callback) {
        let itemObject = new this.model(details);
        itemObject.save(details, err => {
            if (err != null) {
                //this.logger.error(err.stack);
                if (callback != null) callback(err);
            } else {
                if (callback != null) callback(null, itemObject);
            }
        });
    }

    /**
     * Save item
     *
     * @param details
     * @param callback
     */
    save(details, callback) {
        details.save(callback);
    }

    /**
     * Validate item
     *
     * @param item
     * @param callback
     */
    validate(item, callback) {
        callback();
    };

    /**
     * Validate all model instances
     *
     * @param [callback] - Callback function
     */
    validateAll(callback) {

        if (typeof callback !== 'function') callback = function () {
        };

        async.series([callback => {

            // Remove all notifications for this resource
            this.clearAllNotifications(callback);

        }, callback => {

            // Do validate all resource instances
            this.doValidate(callback);

        }], callback);
    }

    /**
     * Validate all resource instances
     *
     * @param callback - Callback function
     */
    doValidate(callback) {

        var completed = false;
        var stream    = this.model.find().stream();
        var $this     = this;

        stream.pipe(eventStream.through(function (instance) {

            var _flow = this;

            _flow.pause();

            $this.validateInstance(instance, () => {
                // Stream pause/resume can't be used in sync mode
                setTimeout(() => {
                    _flow.resume();
                    if (completed) {
                        return callback();
                    }
                });
            });

        }, () => {
            completed = true;
        }));
    }

    /**
     * Clear notifications for instance and validate one instance
     *
     * @param instance
     * @param [callback] - Callback function
     */
    validateInstance(instance, callback) {

        if (typeof callback !== 'function') callback = function () {
        };

        async.series([callback => {

            // Remove notifications for this resource instance
            this.clearNotifications(instance, callback);

        }, callback => {

            // Do validate resource instance
            this.doValidateInstance(instance, callback);

        }], callback);
    }

    /**
     * Validate one resource instance
     *
     * @param instance
     * @param callback - Callback function
     */
    doValidateInstance(instance, callback) {

        async.eachSeries(this.validationMandatoryFields, (mandatoryField, callback) => {

            if (objectPath.get(instance, mandatoryField.patch)) {
                callback();
            } else if (typeof mandatoryField.fix === 'function') {
                // Try to fix
                mandatoryField.fix(instance, (error, fixed) => {
                    if (error || !fixed) {
                        // Fix fails
                        if (error) {
                            console.log(error);
                        }
                        if (mandatoryField.notification) {
                            this.notifyAboutInvalidResource(instance, mandatoryField.notification, callback);
                        } else {
                            callback();
                        }
                    } else {
                        callback();
                    }
                });
            } else {
                // Notify if the fix method not provided
                if (mandatoryField.notification) {
                    this.notifyAboutInvalidResource(instance, mandatoryField.notification, callback);
                } else {
                    callback();
                }
            }

        }, () => {
            var validationNotifications = [];

            async.series([callback => {
                async.applyEachSeries(this.customValidators, instance, validationNotifications, err => {
                    // @err is always undefined here

                    async.eachSeries(validationNotifications, (validationNotification, callback) => {

                        // Notify
                        this.notifyAboutInvalidResource(instance, validationNotification, callback);

                    }, callback);
                });
            }, callback => {

                this.validateReferences(instance, callback);

            }], callback);
        });
    }

    /**
     * Validate instance references
     *
     * @param instance
     * @param [callback] - Callback function
     */
    validateReferences(instance, callback) {

        if (typeof callback !== 'function') callback = function () {
        };

        async.eachSeries(Object.keys(this.model.schema.paths), (path, callback) => {

            var field = this.model.schema.paths[path];

            if (field.instance === 'ObjectID' && field.options && field.options.ref && instance[path]) {

                var Model = this.mongoose.model(field.options.ref);

                Model.findById(instance[path]).exec((err, result) => {
                    if (err) {
                        console.log(err);
                        return callback();
                    }

                    if (!result) {
                        var notification = {
                            message: Model.modelName + ' has a broken reference to the ' + path,
                            notification_type: 'BROKEN_REFERENCE',
                            priority: 'danger'
                        };
                        return this.notifyAboutInvalidResource(instance, notification, callback);
                    }

                    callback();
                });
            } else {
                callback();
            }
        }, callback);
    }

    /**
     * Remove all notifications for all resource instances
     *
     * @param callback
     */
    clearAllNotifications(callback) {

        this.mongoose.model('notifications').find({
            resourceType: this.listName
        }, (err, items) => {
            if (err) return callback(err);

            async.eachLimit(items, 5, (item, callback) => {
                item.remove(callback);
            }, callback);
        });
    }

    /**
     * Remove all notifications for resource instance
     *
     * @param instance
     * @param callback
     */
    clearNotifications(instance, callback) {

        this.mongoose.model('notifications').find({
            resourceType: this.listName,
            resourceId: instance._id
        }, (err, items) => {
            if (err) return callback(err);

            async.eachLimit(items, 5, (item, callback) => {
                item.remove(callback);
            }, callback);
        });
    }

    /**
     * Notify about invalid resource
     *
     * @override
     * @param instance - resource instance
     * @param notification
     * @param callback
     */
    notifyAboutInvalidResource(instance, notification, callback) {
        callback();
    }

    /**
     * Refine item for API response
     *
     * @param item
     * @param callback
     */
    refineForApi(item, callback) {

        callback(null, item);
    }

    /**
     * Iterate through MongoDB collection
     *
     * @param query
     * @param [population]
     * @param onItem
     * @param onEnd
     * @param onError
     */
    iterate(query, population, onItem, onEnd, onError) {

        if (typeof population === 'function') {

            onError = onEnd;
            onEnd   = onItem;
            onItem  = population;

            population = '';
        }

        let cursor = this.model.find(query, {}, {timeout: true}).populate(population).cursor();

        let errorCallbackCalled = false;

        const promise = cursor.eachAsync(item => {

            return new Promise((resolve, reject) => {

                onItem(item, err => {
                    if (err) return reject(err);

                    resolve();
                });
            });

        }, err => {

            cursor.close(err => {
                if (err) {
                    this.logger.warning(`MongooseModel::iterate: (${this.listName}) close cursor error: ${err.message}`);
                }
            });

            if (err) {
                if (errorCallbackCalled) {

                    return this.logger.error(`MongooseModel::iterate: (${this.listName}) ${err.message}`);
                }

                errorCallbackCalled = true;

                return onError(err);
            }

            onEnd();

        });

        if (promise) {

            promise.catch(err => {

                cursor.close(err => {
                    if (err) {
                        this.logger.warning(`MongooseModel::iterate: (${this.listName}) close cursor error: ${err.message}`);
                    }
                });

                if (errorCallbackCalled) {

                    return this.logger.error(`MongooseModel::iterate: (${this.listName}) ${err.message}`);
                }

                errorCallbackCalled = true;

                onError(err);
            });
        }
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
module.exports.MongooseModel = MongooseModel;
module.exports.ValidationError = ValidationError;
