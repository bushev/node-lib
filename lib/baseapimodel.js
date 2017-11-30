'use strict';

/**
 * Requiring core Events module
 */
const MongooseModel = require('./mongoosemodel.js').MongooseModel;

/**
 * Async module
 * @type {async|exports|module.exports}
 */
const async = require('async');

/**
 *  Base API Model
 */
class BaseAPIModel extends MongooseModel {

    /**
     * Model constructor
     */
    constructor(listName) {
        // We must call super() in child class to have access to 'this' in a constructor
        super(listName);

        /**
         * Model items for API reply
         * @type {Array}
         * @private
         */
        this._responseFields = [];
    }

    /**
     * Add refineForApi method to all BaseAPIModels
     *
     * @param schemaObjectDef
     */
    createSchema(schemaObjectDef) {
        super.createSchema(schemaObjectDef);

        let that = this;

        this._schema.methods.refineForApi = function (cb) {
            that.refineForApi(
                this,
                function (err, item) {
                    if (err) {
                        return cb(err);
                    }
                    cb(null, item);
                }
            );
        };
        return this._schema;
    }

    /**
     * Get model items for API reply
     */
    get responseFields() {

        return this._responseFields;
    }

    /**
     * Refile Model items for API reply
     * @param item
     * @param callback
     * @abstract
     */
    refineForApi(item, callback) {

        let responseItem = {};

        this.responseFields.forEach(responseFiled => {
            responseItem[responseFiled] = item[responseFiled];
        });

        callback(null, responseItem);
    }

    /**
     * Returns one document for specified ID
     */
    findByIdForApi(id, callback) {
        this.model.findById(id, this.responseFields.join(' '), function (err, item) {
            if (err) {
                return callback(err);
            }
            if (!item) {
                return callback(new Error('Not found'));
            }

            this.refineForApi(
                item,
                function (err, item) {
                    if (err) {
                        return callback(err);
                    }
                    callback(null, item);
                }.bind(this)
            );
        }.bind(this));
    }

    /**
     * TODO: Not used, invalid
     *
     * @param options
     * @param callback
     */
    getListFilteredForApi(options, callback) {
        super.getListFilteredV2(options, (err, data) => {
            if (err) return callback(err);

            let responseObject = {
                total_items: data.pagination.totalItems,
                total_pages: data.pagination.totalPages,
                items_per_page: data.pagination.pageSize,
                current_page: data.pagination.currentPage,
                next_page: 0,
                prev_page: false,
                items: []
            };

            if (data.pagination.currentPage === 1) {
                responseObject.prev_page = false;
            } else {
                responseObject.prev_page = data.pagination.currentPage - 1;
            }

            if (data.pagination.currentPage < data.pagination.totalPages) {
                responseObject.next_page = data.pagination.currentPage + 1;
            } else {
                responseObject.next_page = false;
            }

            async.eachLimit(data.items, 10, (item, callback) => {
                this.refineForApi(item, (err, item) => {
                    if (err) {
                        return callback(err);
                    }
                    responseObject.items.push(item);
                    callback();
                });
            }, (err) => {
                callback(err, responseObject);
            });
        });
    }
}

/**
 * Exporting Model Classes and Events
 */
module.exports.BaseAPIModel = BaseAPIModel;
