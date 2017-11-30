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
class ElasticSearchModel extends Model {

    /**
     * Model constructor
     */
    constructor(typeName) {
        // We must call super() in child class to have access to 'this' in a constructor
        super();

        // ES client
        this._elasticsearch = require('../index').ElasticSearch;

        /**
         * ElasticSearch index
         * @type {string}
         * @private
         */
        this._index = null;

        // Set base type name
        this._list = typeName;

        /**
         * Response fields
         *
         * @type {Array}
         */
        this.responseFields = [];
    }

    get elasticsearch() {
        return this._elasticsearch;
    }

    /**
     * Get ElasticSearch index
     * @returns {string}
     */
    get index() {
        return this._index;
    }

    /**
     * Returns all items for list
     */
    getAll(callback) {
        this.elasticsearch.searchItems({type: this._list}, function (err, response) {
            if (err) return callback(err);

            var items = [];

            response.hits.hits.forEach(function (item) {
                items.push(item._source);
            });

            callback(err, items);
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
        if (startItem != 0 || pagination.totalItems != 0) {

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

    getListFiltered(filters, includes, pagination, sorting, callback) {
        var self = this;

        var locals = {
            filters: merge(filters.filter, {search: filters.search}, {inField: filters.inField}, {customFilter: filters.customFilter}),
            pagination: pagination,
            sorting: sorting
        };

        var listFilters = {};

        if (filters.search && filters.search.searchValue && filters.search.searchFields.length) {

            if (filters.search.searchFields.length > 1) {
                listFilters.$or = [];
                filters.search.searchFields.forEach(function (item) {
                    var q   = {};
                    q[item] = {$like: '%' + filters.search.searchValue.trim() + '%'};
                    listFilters.$or.push(q);
                });
            } else {
                listFilters[filters.search.searchFields[0]] = {$like: '%' + filters.search.searchValue.trim() + '%'};
            }
        }

        // Infield filter
        let inFieldFilter = {};

        if (filters.inField && filters.inField.length > 0) {
            inFieldFilter = {};

            filters.inField.forEach(function (item) {
                if (_.isArray(item.fieldValue)) {
                    inFieldFilter[item.fieldName] = {$in: item.fieldValue};
                } else {
                    inFieldFilter[item.fieldName] = item.fieldValue;
                }
            });
        }
        // Infield filter

        var customFilter = null;
        if (locals.filters.customFilter) {
            customFilter = locals.filters.customFilter;
        }

        // Prepare sorting object
        var listSort = [];
        if (locals.sorting.field && locals.sorting.order) {
            var order = ['asc', 'desc'].indexOf(locals.sorting.order) > -1 ? locals.sorting.order : 'asc';
            listSort  = [locals.sorting.field, order];
        }

        var query = this.buildConditions(filters, inFieldFilter, customFilter);
        var sort  = this.buildSorting(sorting);

        // Processing final actions
        this._logger.debug('Loading list of items according filters');
        async.series([asyncCallback => { // Get number of elements in the collection according the filters

            this.elasticsearch.count({index: this.index, type: this._list, body: {query: query}}, (err, itemsCount) => {
                if (err) return asyncCallback(err);

                locals.pagination.totalItems = itemsCount;
                self.preparePagination(locals.pagination);
                asyncCallback();
            });

        }, asyncCallback => {

            this.elasticsearch.searchItems({
                index: this.index,
                type: this._list,
                from: locals.pagination.pageSize * (locals.pagination.currentPage - 1),
                size: locals.pagination.pageSize,
                body: {query: query, sort: sort}
            }, (err, response) => {
                if (err) return asyncCallback(err);

                locals.items = [];

                response.hits.hits.forEach(function (item) {
                    locals.items.push(item._source);
                });

                asyncCallback();
            });

        }], error => {
            callback(error, (error == null ? locals : null));
        });
    }

    /**
     * Returns one item for specified criteria
     * TODO:
     */
    findOne(criteria, callback) {
        this.model.findOne({where: criteria}).then(function (item) {
            callback(null, item);
        }).catch(callback);
    }

    /**
     * ES search
     *
     * @param options
     * @param callback
     */
    searchItems(options, callback) {
        this.elasticsearch.searchItems(options, (err, response) => {
            if (err) return callback(err);

            var items = [];

            response.hits.hits.forEach(function (item) {
                items.push(item._source);
            });

            callback(err, items);
        });
    }

    /**
     * Returns one document for specified ID
     */
    findById(id, callback) {

        if (id.indexOf('-') > -1) {
            return this.findBySlug(id, callback);
        }

        this.elasticsearch.get({
            index: this.index,
            type: this._list,
            id: id
        }, function (err, item) {
            callback(err, item);
        });
    }

    /**
     * Returns one document for specified ID
     * @alias of findById
     */
    findByIdAndPopulate(id, dummy, callback) {
        this.findById(id, callback);
    }

    /**
     * Returns one document for specified slug
     *
     * @param slug {string}
     * @param callback {function}
     */
    findBySlug(slug, callback) {
        this.searchItems({
            index: this._index,
            type: this._list,
            body: {
                query: {
                    constant_score: {
                        filter: {
                            term: {
                                slug: slug
                            }
                        }
                    }
                }
            }
        }, function (err, items) {
            if (err) return callback(err);

            if (items.length == 0) return callback(err, null);
            if (items.length > 1) return callback(new Error('Too many found'));

            callback(err, items[0]);
        });
    }

    /**
     * Returns one document for specified slug
     * @alias of findBySlug
     */
    findBySlugAndPopulate(slug, dummy, callback) {
        this.findBySlug(slug, callback);
    }
}

/**
 * Exporting Model Classes
 */
module.exports.ElasticSearchModel = ElasticSearchModel;
