'use strict';

/**
 * Requiring underscope lib
 */
const _ = require('lodash');

/**
 * Requiring core Path module
 */
const path = require('path');

/**
 * Excel parse library
 *
 * @type {excelParser|exports|module.exports}
 */
const excelParser = require('excel-parser');

/**
 * Library for parse file uploads
 *
 * @type {exports|module.exports}
 */
const multiparty = require('multiparty');

/**
 * Async library
 *
 * @type {async|exports|module.exports}
 */
const async = require('async');

/**
 * MomentJS
 */
const moment = require('moment');

/**
 * Object managing library
 * @type {*|exports|module.exports}
 */
const objectPath = require('object-path');

/**
 * Excel library
 *
 * @type {CFB|exports|module.exports}
 */
const XLSX = require('xlsx');

/**
 * Excel Workbook Manager
 *
 * @type {*|exports|module.exports}
 */
const Excel = require('exceljs');

/**
 * Base State Controller
 *
 * @type {*|exports|module.exports}
 */
const StateController = require('./statecontroller.js');

/**
 * Requiring Flash messages type definition
 *
 * @type {*|{SERVER_STARTED: string, MONGO_CONNECTED: string}}
 */
var FlashMessageType = require('../flashmessages.js').FlashMessageType;

/**
 *  Admin base CRUD controller
 */
class BaseCRUDController extends StateController {

    /**
     * Controller constructor
     */
    constructor(request, response, next) {
        // We must call super() in child class to have access to 'this' in a constructor
        super(request, response, next);

        /**
         * Current CRUD model instance
         *
         * @type {MongooseModel}
         * @private
         */
        this._model = null;

        /**
         * Mongoose Population fields
         * url: {@link http://mongoosejs.com/docs/populate.html|Mongoose Doc}
         *
         * @type {string}
         * @private
         */
        this._modelPopulateFields = '';

        /**
         * Mongoose Searchable fields
         *
         * @type {string}
         * @private
         */
        this._modelSearchableFields = [];

        /**
         * Field used for autocomplete suggestions
         *
         * @type {string}
         * @private
         */
        this._autocompleteSuggestionsField = 'coname';

        /**
         * Mongoose default fields. Used in getItemFromRequest().
         *
         * @type {Array}
         * @private
         */
        this._modelEditableFields = [];

        /**
         * Notification model
         *
         * @type {null}
         * @private
         */
        this._notificationModel = null;

        /**
         * Current Item from the Database
         *
         * @type {}
         * @private
         */
        this._item = null;

        /**
         * Context of the controller
         *
         * @type {string}
         * @private
         */
        this._baseUrl = '/admin/index';

        /**
         * Path to basic views
         *
         * @type {string}
         * @private
         */
        this._viewsPath = 'index';

        /**
         * Path to UI templates
         *
         * @type {string}
         * @private
         */
        this._baseViewsDir = path.join(__dirname, '..', 'views', 'admin', '');

        /**
         * Template string for counter visualization
         *
         * @type {string}
         */
        this.counterStringTemplate = 'Showing %startItem% - %listCount% of %totalItems% items';

        /**
         * Default page size
         *
         * @type {number}
         * @private
         */
        this._defaultPageSize = 10;

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
    get modelPopulateFields() {
        return this._modelPopulateFields;
    }

    /**
     * Current model populate fields
     * @returns {string}
     */
    get modelSearchableFields() {
        return this._modelSearchableFields;
    }

    /**
     * Getter for current item ID from the request
     *
     * @returns {*}
     */
    get itemId() {
        var itemId = this.request.params.id ? this.request.params.id : this.request.params.action;

        return itemId;
    }

    /**
     * Current item for CRUD
     *
     * @returns {{}}
     */
    get item() {
        return this._item;
    }

    /**
     * Get name of current action
     *
     * @returns {null|string|*}
     */
    get actionName() {
        var result = super.actionName;

        /**
         * Set default action name to view
         */
        if (this._allowedActions[result] == null && this.request.params.action != null) {
            result = 'view';
        }

        return result;
    }

    /**
     * List of fields for Bulk Edit Action
     *
     * @returns {[]}
     */
    get bulkEditFields() {
        var result = this.model.bulkEditFields != null ? this.model.bulkEditFields : [];

        return result;
    }

    /**
     * Notification model getter
     *
     * @returns {null}
     */
    get notificationModel() {
        return this._notificationModel;
    }

    /**
     * Event handler on Controller Start event
     *
     * @param event
     */
    onStateControllerStart(event) {
        /**
         * Set State Storage UID to save/load state information from the session
         *
         * @type {string}
         */
        this.stateStorageUID = 'CRUD_' + this._baseUrl;

        super.onStateControllerStart(event);
    }

    /**
     * Pre-initialize data and event handlers
     *
     * @abstract
     */
    preInit(callback) {
        // Abstract method
        callback();
    }

    /**
     * Initialize data and event handlers
     */
    init(callback) {
        this.registerAction('list', 'load');
        this.registerAction('new', 'create');
        this.registerAction('create', 'create');
        this.registerAction('doCreate', 'doCreate');
        this.registerAction('view', 'doView');
        this.registerAction('edit', 'edit');
        this.registerAction('doEdit', 'doEdit');
        this.registerAction('delete', 'doDelete');
        this.registerAction('doDelete', 'doDelete');
        this.registerAction('import', 'xlsImport');
        this.registerAction('export', 'xlsExport');
        this.registerAction('bulkEdit', 'bulkEdit');
        this.registerAction('bulkEditPreview', 'bulkEditPreview');
        this.registerAction('doBulkEdit', 'doBulkEdit');
        this.registerAction('bulkDelete', 'bulkDelete');
        this.registerAction('autocomplete', 'doAutocomplete');
        this.registerAction('validateAll', 'doValidateAll');

        // Adding listeners for CRUD Events
        this.addListener(BaseCRUDController.CRUDEvents.ITEM_CREATE, this.onItemHasBeenInserted.bind(this));
        this.addListener(BaseCRUDController.CRUDEvents.ITEM_UPDATE, this.onItemHasBeenSaved.bind(this));
        // this.addListener(BaseCRUDController.CRUDEvents.ITEM_DELETE, this.onItemDelete.bind(this));

        callback();
    }

    /**
     * Returns view filters
     *
     * @returns {{}}
     */
    getViewFilters() {
        var result = {
            search: {
                searchFields: this.modelSearchableFields,
                searchValue: this.getViewSearchValue(),
                basePath: this.getActionUrl('list')
            },
            inField: [],
            customFilters: [],
            relation: [],
            sorting: this.getViewSorting()
        };

        if (this.model.responseFields != null) {
            this.model.responseFields.forEach((field) => {
                if (this.request.query.filter && typeof this.request.query.filter[field] !== 'undefined' && this.request.query.filter[field] !== '') {
                    result.inField.push({fieldName: field, fieldValue: this.request.query.filter[field]});
                }
            });
        }

        if (this.model.customFilters != null) {
            this.model.customFilters.forEach(filterName => {
                if (this.request.query.filter && typeof this.request.query.filter[filterName] !== 'undefined' && this.request.query.filter[filterName] !== '') {
                    result.customFilters.push({
                        filterName: filterName,
                        filterValue: this.request.query.filter[filterName]
                    });
                }
            });
        }

        if (this.model.inFieldFilterFields != null) {
            this.model.inFieldFilterFields.forEach(filterField => {

                let filterData = objectPath.get(this.request.query, 'filter.' + filterField.name);

                if (filterData) {

                    const DELIMITER = ','; // TODO: Hm..

                    if (filterData.indexOf(DELIMITER) > -1) {
                        filterData = filterData.split(DELIMITER);
                    }

                    result.inField.push({
                        filterName: filterField.name,
                        fieldName: filterField.field,
                        fieldValue: filterData
                    });
                }
            });
        }

        return result;
    }

    /**
     * Returns view pagination
     *
     * @returns {Number}
     */
    getViewPageCurrent() {
        if (this.request.params && this.request.params.page) {
            return parseInt(this.request.params.page, 10);
        }
        return 1;
    }

    /**
     * Returns view page size
     *
     * @returns {Number}
     */
    getViewPageSize() {
        var filter = this.getCachedRequestFilter();

        if (filter.pageSize) {
            return parseInt(filter.pageSize);
        } else {
            return this._defaultPageSize;
        }
    }

    /**
     * Returns view pagination object
     *
     * @returns {{}}
     */
    getViewPagination() {
        return {
            currentPage: this.getViewPageCurrent(),
            pageSize: this.getViewPageSize(),
            basePath: this.getActionUrl('list'),
            counterStringTemplate: this.counterStringTemplate
        };
    }

    /**
     * Returns view sorting options
     *
     * @returns {{}}
     */
    getViewSorting() {

        const filter = this.getCachedRequestFilter();

        let sorting = {};

        if (filter.sorting) {

            sorting = filter.sorting;

        } else if (this._defaultSorting) {

            sorting = this._defaultSorting;
        }

        return sorting;
    }

    /**
     * Returns view sorting options
     *
     * @returns {{}}
     */
    getViewSearchValue() {
        var cacheObj = this.currentState.filter;
        if (cacheObj && cacheObj.search) {
            return cacheObj.search;
        } else {
            return null;
        }
    }

    /**
     * Returns file name for view
     *
     * @param viewType types: list, edit, create
     * @returns {{}}
     */
    getViewFilename(viewType) {
        var result = path.join(this._baseViewsDir || '', this._viewsPath || '', viewType + '.swig');

        return result;
    }

    /**
     * Returns definition of View Class used to create Views
     *
     * By default used ModuleView class
     *
     * @returns {exports|module.exports}
     */
    getViewClassDefinition() {
        var ModuleView = require('../view/moduleview.js').ModuleView;

        return ModuleView;
    }

    /**
     * Returns url for action
     *
     * @param action
     * @param item
     */
    getActionUrl(action, item) {
        var result = this._baseUrl;

        switch (action) {
            case 'create':
            case 'import':
            case 'export':
            case 'bulkEdit':
            case 'bulkEditPreview':
            case 'doBulkEdit':
            case 'bulkDelete':
            case 'validateAll':
                result += '/' + action;
                break;
            case 'edit':
            case 'doEdit':
            case 'delete':
                result += '/' + item.id.toString() + '/' + action;
                break;
            case 'view':
                result += '/' + item.id.toString();
                break;
            case 'list':
            default:
                result += '';
                break;
        }

        return result;
    }

    /**
     * Returns query string parameters respectively to filter parameters
     * @returns {string}
     */
    getQueryStringFilterPart() {
        //?filter[search]=s1&filter[pageSize]=1&filter[sortingField]=status&filter[sortingOrder]=desc
        let filterParts = [];
        let filter      = this.getViewFilters();
        let filter2     = this.getCachedRequestFilter();

        if (filter.search && filter.search.searchValue) {
            filterParts.push("filter[search]=" + encodeURIComponent(filter.search.searchValue));
        }

        if (filter.inField) {

            filter.inField.forEach(inFieldFilterItem => {

                filterParts.push(`filter[${inFieldFilterItem.filterName}]=${encodeURIComponent(inFieldFilterItem.fieldValue)}`);
            });
        }

        if (filter2.pageSize) {
            filterParts.push("filter[pageSize]=" + filter2.pageSize);
        }

        if (filter.sorting && filter.sorting.field && filter.sorting.order) {
            filterParts.push("filter[sortingField]=" + encodeURIComponent(filter.sorting.field));
            filterParts.push("filter[sortingOrder]=" + encodeURIComponent(filter.sorting.order));
        }

        let filterString = filterParts.join('&');

        if (filterString.length > 0) {
            filterString = "?" + filterString;
        }

        return filterString;
    }

    /**
     * Reset filters
     */
    resetFilters() {
        this.currentState.filter = {};
    }

    /**
     * Persists filter parameters for current base URL into the session
     */
    cacheRequestFilter() {
        var query = this.request.query;

        /**
         * Handle GET request with query sortingField and sortingOrder
         */
        if (this.request.method == 'GET' && (this.request.params.action == 'list' || this.request.url.startsWith(this.getActionUrl('list')))) {
            var filter = this.currentState.filter || {};

            if (this.request.params && this.request.params.page) {
                filter.page = this.request.params.page;
            }

            if (query.filter != null) {
                var search = this.getSingleValue(query.filter.search);
                if (typeof (search) != "undefined") {
                    filter.search = search;
                }

                if (query.filter.pageSize) {
                    filter.pageSize = parseInt(this.getSingleValue(query.filter.pageSize), 10);
                }

                if (query.filter.sortingField && query.filter.sortingOrder) {
                    filter.sorting = {
                        field: this.getSingleValue(query.filter.sortingField),
                        order: this.getSingleValue(query.filter.sortingOrder),
                        basePath: this.getActionUrl('list')
                    };
                }
            }
            this.currentState.filter = filter;
            // this.currentState.filter[this._baseUrl] = filter;
        }
    }

    /**
     * Returns single value from value of a query string parameter in case the parameter has been specified more then one time
     * @param stringOrArrayValue
     * @returns {string}
     */
    getSingleValue(stringOrArrayValue) {
        var singleValue = "";
        if (!Array.isArray(stringOrArrayValue)) {
            singleValue = stringOrArrayValue;
        } else if (stringOrArrayValue.length > 0) {
            singleValue = stringOrArrayValue[0];
        }

        return singleValue;
    }

    /**
     * Returns cached filter parameters for current base URL
     *
     * @returns {*|{}}
     */
    getCachedRequestFilter() {
        var filter = this.currentState.filter || {};

        return filter;
    }

    /**
     * Returns url for the "list" action with filter arguments in query string
     *
     * @returns {*}
     */
    getFilteredListUrl() {
        var filter          = this.getCachedRequestFilter();
        var filteredListUrl = this.getActionUrl('list');
        if (filter.page) {
            filteredListUrl += "/page/" + filter.page;
        }
        filteredListUrl += this.getQueryStringFilterPart();

        return filteredListUrl;
    }

    /**
     * Loading item for edit actions
     *
     * @param readyCallback
     */
    preLoad(readyCallback) {

        this.cacheRequestFilter();

        /**
         * Loading item
         */
        if (this.actionName == 'edit' || this.actionName == 'doEdit' || this.actionName == 'view' || this.actionName == 'delete') {

            async.series([callback => {

                this.loadItem(callback);

            }, callback => {

                if (['edit', 'view'].indexOf(this.actionName) !== -1) {

                    this.loadItemNotifications(this._item, callback);

                } else {
                    callback();
                }

            }], readyCallback);

        } else {
            readyCallback();
        }
    }

    /**
     * Loading item from the db
     *
     * @param readyCallback
     */
    loadItem(readyCallback) {
        this.model.findByIdAndPopulate(this.itemId, this.modelPopulateFields, function (error, item) {
            if (error != null) {
                this.flash.addMessage("Failed to load item from database! " + error.message, FlashMessageType.ERROR);
                this.terminate();
                this.response.redirect(this.getActionUrl('list'));

                return readyCallback(error);
            }

            // Send remove item statuses
            if (item != null) {
                this._item = item;

                // Send DATA_READY event
                readyCallback();
            } else {
                this.onItemNotFound(readyCallback);
            }
        }.bind(this));
    }

    /**
     * Loading item notifications from db
     *
     * @override
     * @param item
     * @param readyCallback
     */
    loadItemNotifications(item, readyCallback) {

        if (this.notificationModel == null) return readyCallback();

        this.notificationModel.findAll({
            resourceType: this.model.listName,
            resourceId: item._id
        }, (err, notifications) => {
            if (err) return readyCallback(err);

            item.notifications = notifications;
        });

        readyCallback();
    }

    /**
     * Loading items notifications from db
     *
     * @param readyCallback
     */
    loadItemsNotifications(readyCallback) {
        async.eachLimit(this.data.items, 5, (item, callback) => {
            this.loadItemNotifications(item, callback);
        }, readyCallback);
    }

    /**
     * Apply onBeforeLoadList action
     *
     * @param readyCallback
     */
    onBeforeLoadList(readyCallback) {
        readyCallback();
    }

    /**
     * Apply onAfterLoadList action
     *
     * @param readyCallback
     */
    onAfterLoadList(readyCallback) {
        readyCallback();
    }

    /**
     * Get filtered list of items for current list
     *
     * @param dataCallback
     */
    getListFiltered(dataCallback) {
        var filters     = this.getViewFilters();
        var populations = this.modelPopulateFields;
        var pagination  = this.getViewPagination();
        var sorting     = this.getViewSorting();

        this.model.getListFiltered(filters, populations, pagination, sorting, dataCallback);
    }

    /**
     * Load items list based on sorting/filtering options
     *
     * @param readyCallback
     */
    load(readyCallback) {
        var locals = {};
        async.series([
                asyncCallback => {
                    this.onBeforeLoadList(asyncCallback);
                },
                asyncCallback => {
                    this.getListFiltered(function (error, data) {
                        locals.data = data;

                        asyncCallback(error);
                    });
                },
                asyncCallback => {
                    // Initializing load list view and set page data
                    if (locals.data != null) {
                        for (var key in locals.data) {
                            if (locals.data.hasOwnProperty(key)) {
                                this.data[key] = locals.data[key];
                            }
                        }
                    }

                    /**
                     * Used in sorting() macro in SWIG
                     */
                    this.data.filter = this.getCachedRequestFilter();
                    this.data.filter.sorting = this.getViewSorting();

                    this.data.createActionUrl      = this.getActionUrl('create');
                    this.data.importActionUrl      = this.getActionUrl('import');
                    this.data.exportActionUrl      = this.getActionUrl('export') + this.getQueryStringFilterPart();
                    this.data.bulkEditActionUrl    = this.getActionUrl('bulkEdit') + this.getQueryStringFilterPart();
                    this.data.bulkDeleteActionUrl  = this.getActionUrl('bulkDelete');
                    this.data.validateAllActionUrl = this.getActionUrl('validateAll');
                    this.data.baseUrl              = this._baseUrl;

                    // Send DATA_READY event
                    asyncCallback();
                },
                asyncCallback => {
                    this.loadItemsNotifications(asyncCallback);
                },
                asyncCallback => {
                    // Run after load items list
                    this.onAfterLoadList(asyncCallback);
                }
            ], (error) => {
                /**
                 * Set output view object
                 */
                this.view(this.getViewClassDefinition().htmlView(this.getViewFilename('list'), this.data, error));

                readyCallback(error);
            }
        );
    }

    /**
     * Extract item from request
     *
     * @param item
     * @returns {{}}
     */
    getItemFromRequest(item) {
        var result = item != null ? item : {};

        // Define keys which we can update for our model
        var itemKeys = this._modelEditableFields;
        if (itemKeys == null || itemKeys.length < 1) {
            itemKeys = Object.keys(this.request.body);
        }

        for (var key in itemKeys) {
            var fieldName     = itemKeys[key];
            result[fieldName] = this.request.body[fieldName];
        }

        return result;
    }

    /**
     * Initialize create view
     *
     * @param readyCallback
     */
    create(readyCallback) {
        this.canCreate(err => {
            if (err) return readyCallback(err);

            this.data.actionUrl       = this.getActionUrl('create');
            this.data.cancelActionUrl = this.getFilteredListUrl();
            if (this.request.method == 'GET') {
                this.view(this.getViewClassDefinition().htmlView(this.getViewFilename('create')));
                readyCallback();
            } else {
                // Proceed with create action
                this.doCreate(readyCallback);
            }
        });
    }

    /**
     * Apply onBeforeCreate action
     *
     * @param readyCallback
     */
    onBeforeCreate(readyCallback) {
        readyCallback();
    }

    /**
     * Apply onAfterCreate action
     *
     * @param readyCallback
     */
    onAfterCreate(readyCallback) {
        readyCallback();
    }

    /**
     * Proceed Create action
     *
     * @param readyCallback
     */
    doCreate(readyCallback) {
        this.data.actionUrl = this.getActionUrl('create');
        this.itemDetails    = this.getItemFromRequest({});

        async.series([
                asyncCallback => {
                    // validate item
                    this.validate(this.itemDetails, 'create', asyncCallback);
                },
                asyncCallback => {
                    // Run before Create item
                    this.onBeforeCreate(asyncCallback);
                },
                asyncCallback => {
                    // Run main create code
                    this._logger.debug('Inserting new item to the database');
                    this.itemDetails.lastModifiedBy = this.userId;
                    // Emitting ITEM_BEFORE_INSERT event
                    this.emit(BaseCRUDController.CRUDEvents.ITEM_BEFORE_INSERT, {item: this.itemDetails});
                    this.model.insert(this.itemDetails, function (error, item) {
                        if (error != null) {

                            return this.onCreateItemFailed(error, asyncCallback);
                        }

                        // Set item
                        this.data.item = item;

                        // Emit ITEM_CREATE event
                        this.emit(BaseCRUDController.CRUDEvents.ITEM_CREATE, item);

                        // Send DATA_READY event
                        asyncCallback();
                    }.bind(this));
                },
                asyncCallback => {
                    // Run after Create item
                    this.onAfterCreate(asyncCallback);
                }
            ], (error) => {
                if (error != null && error.isValidationFailed) {
                    readyCallback();
                } else {
                    readyCallback(error);
                }
            }
        );
    }

    /**
     * Handler for ITEM_CREATE event
     *
     * @param {} item
     */
    onItemHasBeenInserted(item) {

        this.flash.addMessage(this.itemInsertedSuccessMessage, FlashMessageType.SUCCESS);

        this.terminate();

        switch (this.request.body.saveAction) {
            case 'save&CreateAnother':
                this.response.redirect(this.getActionUrl('create'));
                break;
            case 'save':
                this.response.redirect(this.getActionUrl('edit', item));
                break;
            case 'save&Close':
            default:
                this.response.redirect(this.getActionUrl('list'));
                break;
        }
    }

    /**
     * Initialize edit view
     *
     * @param readyCallback
     */
    edit(readyCallback) {
        this.canEdit(err => {
            if (err) return readyCallback(err);

            this.data.isEditMode      = true;
            this.data.actionUrl       = this.getActionUrl('edit', this.item);
            this.data.item            = this.item;
            this.data.cancelActionUrl = this.getActionUrl('view', this.item);
            if (this.request.method == 'GET') {
                this.view(this.getViewClassDefinition().htmlView(this.getViewFilename('edit')));
                readyCallback();
            } else {
                this.doEdit(readyCallback);
            }
        });
    }

    /**
     * Validate item
     *
     * @param itemDetails
     * @param currentAction
     * @param callback
     */
    validate(itemDetails, currentAction, callback) {

        this.model.validate(itemDetails, (error, validationMessages) => {
            if (error != null) {
                let validationErrors = (error.messages != null) ? error.messages : validationMessages;
                this.flash.addMessages(validationErrors, FlashMessageType.ERROR);
                this.data.item = itemDetails;
                this.view(this.getViewClassDefinition().htmlView(this.getViewFilename(currentAction)));

                error.isValidationFailed = true;
            }

            callback(error);
        });
    }

    /**
     * Check view permissions
     *
     * @param readyCallback
     */
    canView(readyCallback) {
        readyCallback();
    }

    /**
     * Check create permissions
     *
     * @param readyCallback
     */
    canCreate(readyCallback) {
        readyCallback();
    }

    /**
     * Check edit permissions
     *
     * @param readyCallback
     */
    canEdit(readyCallback) {
        readyCallback();
    }

    /**
     * Check delete permissions
     *
     * @param readyCallback
     */
    canDelete(readyCallback) {
        readyCallback();
    }

    /**
     * Apply onBeforeEdit action
     *
     * @param readyCallback
     */
    onBeforeEdit(readyCallback) {
        readyCallback();
    }

    /**
     * Apply onAfterEdit action
     *
     * @param readyCallback
     */
    onAfterEdit(readyCallback) {
        readyCallback();
    }

    /**
     * Apply edit action
     *
     * @param readyCallback
     */
    doEdit(readyCallback) {

        let itemDetails;

        try {
            itemDetails      = this.getItemFromRequest(this.item);
            this.itemDetails = itemDetails;
        } catch (e) {
            return readyCallback(e);
        }

        async.series([
                asyncCallback => {
                    // Validate item
                    this.validate(itemDetails, 'edit', asyncCallback);
                },
                asyncCallback => {
                    // Run before Edit item
                    this.onBeforeEdit(asyncCallback);
                },
                asyncCallback => {
                    // Run main edit code
                    itemDetails.lastModifiedBy = this.userId;
                    itemDetails                = this.beforeSave(itemDetails);
                    this.emit(BaseCRUDController.CRUDEvents.ITEM_BEFORE_UPDATE, {item: itemDetails});
                    itemDetails.save(function (error, item) {
                        if (error != null) {

                            return this.onUpdateItemFailed(error, asyncCallback);
                        }

                        this.emit(BaseCRUDController.CRUDEvents.ITEM_UPDATE, itemDetails);

                        // Send DATA_READY event
                        asyncCallback();
                    }.bind(this));
                },
                asyncCallback => {
                    // Run after edit item
                    this.onAfterEdit(asyncCallback);
                }
            ], (error) => {
                if (error != null && error.isValidationFailed) {
                    readyCallback();
                } else {
                    readyCallback(error);
                }
            }
        );
    }

    /**
     * Before Save Handler
     *
     * @param item
     * @returns {*}
     */
    beforeSave(item) {
        return item;
    }

    /**
     * On item not found
     *
     * @param callback
     */
    onItemNotFound(callback) {
        // Terminating page
        this.terminate();
        this.response.redirect(this.getActionUrl('list'));
        this.flash.addMessages('Failed to load Item. Item is not exists in the database!', FlashMessageType.ERROR);

        callback();
    }

    /**
     * On create failed
     *
     * @param error
     * @param callback
     */
    onCreateItemFailed(error, callback) {

        this.flash.addMessage("Failed to create item! " + error.message, FlashMessageType.ERROR);
        this.terminate();
        this.response.redirect(this.getActionUrl('list'));

        callback(error);
    }

    /**
     * On update failed
     *
     * @param error
     * @param callback
     */
    onUpdateItemFailed(error, callback) {

        this.flash.addMessage("Failed to update item! " + error.message, FlashMessageType.ERROR);
        this.terminate();
        this.response.redirect(this.getActionUrl('list'));

        callback(error);
    }

    /**
     * Handler when item already saved
     */
    onItemHasBeenSaved(item) {
        this.flash.addMessage("Item successfully updated in the database!", FlashMessageType.SUCCESS);
        this.terminate();

        switch (this.request.body.saveAction) {
            case 'save&CreateAnother':
                this.response.redirect(this.getActionUrl('create'));
                break;
            case 'save':
                this.response.redirect(this.getActionUrl('edit', item));
                break;
            case 'save&Close':
            default:
                this.response.redirect(this.getActionUrl('list'));
                break;
        }
    }

    /**
     * Import from Excel file
     *
     * @param readyCallback
     */
    xlsImport(readyCallback) {

        if (this.request.method == 'GET') {
            this.data.actionUrl = this.getActionUrl('import', this.item);
            this.view(this.getViewClassDefinition().htmlView(this.getViewFilename('import')));
            readyCallback();
        } else {

            async.waterfall([function (callback) {
                var form = new multiparty.Form();

                form.parse(this.request, function (err, fields, files) {
                    if (err) return callback(err);

                    callback(null, files.file[0].path);
                });

            }.bind(this), function (filePath, callback) {

                excelParser.parse({
                    inFile: filePath,
                    worksheet: 1
                }, function (err, records) {
                    if (err) return callback(err);
                    callback(null, records);
                });

            }.bind(this), function (records, callback) {

                var fields = records.shift();
                var items  = [];

                for (var i = 0; i < records.length; i++) {
                    var item = {};

                    for (var j = 0; j < fields.length; j++) {
                        if (fields[j]) {
                            item[fields[j].replace('\n', ' ').trim()] = records[i][j]
                        }
                    }

                    items.push(item);
                }

                async.eachLimit(items, 5, function (item, callback) {

                    async.waterfall([function (callback) {
                        if (item.id) {
                            this.model.findById(item.id, function (err, item) {
                                callback(err, item);
                            });
                        } else {
                            callback(null, null);
                        }
                    }.bind(this), function (existingItem, callback) {
                        if (existingItem) {
                            /** Update existing item */
                            for (var key in item) {
                                if (item.hasOwnProperty(key)) {
                                    existingItem[key] = item[key];
                                }
                            }
                            callback(null, existingItem, false);
                        } else {
                            /** Create new item */
                            delete item.id;
                            callback(null, item, true);
                        }
                    }, function (item, isNew, callback) {

                        this.model.validate(item, function (error, validationMessages) {
                            if (error == null) {
                                if (isNew) {

                                    this.model.insert(item, function (error, item) {
                                        if (error != null) {
                                            this.flash.addMessage("Failed to save item! " + error.message, FlashMessageType.ERROR);
                                            this.terminate();
                                            this.response.redirect(this.getActionUrl('list'));

                                            return callback(error);
                                        }
                                        callback();
                                    }.bind(this));
                                } else {
                                    item.save(function (error) {
                                        if (error != null) {
                                            this.flash.addMessage("Failed to save item! " + error.message, FlashMessageType.ERROR);
                                            this.terminate();
                                            this.response.redirect(this.getActionUrl('list'));

                                            return callback(error);
                                        }
                                        callback();
                                    }.bind(this));
                                }
                            } else {
                                var validationErrors = (error.messages != null) ? error.messages : validationMessages;
                                this.flash.addMessages(validationErrors, FlashMessageType.ERROR);
                                callback();
                            }
                        }.bind(this));

                    }.bind(this)], callback);

                }.bind(this), callback);

            }.bind(this)], function (err) {
                this.flash.addMessage("Items successfully imported to the database!", FlashMessageType.SUCCESS);
                this.terminate();
                this.response.redirect(this.getActionUrl('list'));

                readyCallback(err);
            }.bind(this));
        }
    }

    /**
     * Export items to Excel file
     *
     * @param readyCallback
     */
    xlsExport(readyCallback) {

        const USE_FILE_BUFFER = true;

        if (!this._xlsExportFields || this._xlsExportFields.length === 0) {

            return readyCallback(new Error(`Export is not configured for this resource`));
        }

        let tmpFilePath;

        let stream = this.model.getStreamFiltered(this.getViewFilters(), null, this.getViewSorting());

        let options = {};

        if (USE_FILE_BUFFER) {

            tmpFilePath = path.resolve(require('os').tmpdir(), `export_${(new Date()).getTime()}.xlsx`);

            options.filename = tmpFilePath;

        } else {

            options.stream = this.response;

            this.response.writeHead(200, {
                'Content-Disposition': `attachment; filename="${this.model._list}_${moment().format('DD-MM-YYYY')}_export.xlsx"`,
                'Transfer-Encoding': 'chunked',
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
        }

        let workbook = new Excel.stream.xlsx.WorkbookWriter(options);

        let worksheet = workbook.addWorksheet('work-sheet');

        worksheet.columns = this._xlsExportFields.map(field => {

            return {header: field.column, key: field.field, width: field.width ? field.width : undefined};
        });

        stream.on('data', data => {

            let rowData = {};

            this._xlsExportFields.forEach(field => {

                //rowData[field.field] = objectPath.get(data, field.field); // fails to get idNumber / id / etc
                rowData[field.field] = data[field.field];
            });

            worksheet.addRow(rowData);
        });

        stream.on('error', err => {

            this.logger.error(err);
        });

        stream.on('end', () => {

            worksheet.commit();

            workbook.commit().then(() => {

                this.terminate();

                if (USE_FILE_BUFFER) {

                    this.response.sendFile(tmpFilePath, {
                        headers: {
                            'Content-Disposition': `attachment; filename="${this.model._list}_${moment().format('DD-MM-YYYY')}_export.xlsx"`
                        }
                    }, function (err) {
                        if (err) console.log(err);

                        require('fs').unlink(tmpFilePath, function (err) {
                            if (err) console.log(err);

                            readyCallback();
                        });
                    });

                } else {

                    readyCallback();
                }
            });
        });
    }

    /**
     * Convert array to worksheet.
     *
     * Usage:
     *
     * data = [['First column', 'Second column'], ['Val of first', 'Val of second'], ['Val of first', 'Val of second']]
     *
     *
     * @param data
     * @param [opts]
     * @returns {{}}
     */
    getSheetFromArrayOfArrays(data, opts) {
        var ws    = {};
        var range = {s: {c: 10000000, r: 10000000}, e: {c: 0, r: 0}};
        for (var R = 0; R != data.length; ++R) {
            for (var C = 0; C != data[R].length; ++C) {
                if (range.s.r > R) range.s.r = R;
                if (range.s.c > C) range.s.c = C;
                if (range.e.r < R) range.e.r = R;
                if (range.e.c < C) range.e.c = C;
                var cell = {v: data[R][C]};
                if (cell.v == null) continue;
                var cell_ref = XLSX.utils.encode_cell({c: C, r: R});

                if (typeof cell.v === 'number') cell.t = 'n';
                else if (typeof cell.v === 'boolean') cell.t = 'b';
                else cell.t = 's';

                ws[cell_ref] = cell;
            }
        }
        if (range.s.c < 10000000) ws['!ref'] = XLSX.utils.encode_range(range);

        return ws;
    }

    /**
     * Initialize view view
     *
     * @param readyCallback
     */
    doView(readyCallback) {
        this.canView(err => {
            if (err) return readyCallback(err);

            this.data.isViewMode      = true;
            this.data.item            = this.item;
            this.data.cancelActionUrl = this.getFilteredListUrl();
            this.data.editActionUrl   = this.getActionUrl('edit', this.item);
            if (this.isGetRequest || this.isHeadRequest) {
                this.view(this.getViewClassDefinition().htmlView(this.getViewFilename('view')));
                // TODO: Do we need this in nodejs-admin?
                // this.setActionDeniedFlags(this.data, function(err){ readyCallback(err);});
                readyCallback();
            } else {
                readyCallback(new Error("Action isn't supported"));
            }
        });
    }

    /**
     * Prepare data for bulk edit
     *
     * @param callback
     */
    prepareBulkEditData(callback) {
        var fields = [];

        /**
         * Async model will be useful for associations in a future
         */
        async.eachLimit(this.bulkEditFields, 2, function (field, callback) {

            if (this.request.body[field.path + '_checkbox'] === 'on') {

                fields.push({
                    type: field.type,
                    name: field.name,
                    path: field.path,
                    value: this.request.body[field.path]
                });

                callback();

            } else {
                callback();
            }

        }.bind(this), function (err) {
            callback(err, fields);
        });

    }

    /**
     * Prepare Bulk fields
     * @param readyCallback
     */
    bulkEdit(readyCallback) {

        this.data.baseUrl                  = this._baseUrl;
        this.data.bulkEditPreviewActionUrl = this.getActionUrl('bulkEditPreview');
        this.data.bulkEditFields           = this.bulkEditFields;
        this.data.modelName                = this.model.model.modelName;

        this.model.getListCountFiltered(this.getViewFilters(), (err, count) => {
            if (err) return readyCallback(error);

            this.data.itemsTotal = count;

            this.view(this.getViewClassDefinition().htmlView(this.getViewFilename('bulk_edit')));
            readyCallback();
        });
    }

    /**
     * Prepare Bulk Edit preview screen
     * @param readyCallback
     */
    bulkEditPreview(readyCallback) {

        this.data.baseUrl             = this._baseUrl;
        this.data.bulkEditActionUrl   = this.getActionUrl('bulkEdit');
        this.data.doBulkEditActionUrl = this.getActionUrl('doBulkEdit');
        this.data.modelName           = this.model.model.modelName;

        async.parallel([(callback) => {

            this.model.getListCountFiltered(this.getViewFilters(), (err, count) => {
                if (err) return callback(err);

                this.data.itemsTotal = count;
                callback();
            });

        }, (callback) => {

            this.prepareBulkEditData((err, fields) => {
                if (err) return callback(err);

                this.data.bulk_edit_preview = fields;

                this.view(this.getViewClassDefinition().htmlView(this.getViewFilename('bulk_edit')));
                callback();
            });

        }], readyCallback);
    }

    /**
     * Apply Bulk Edit operation
     * @param readyCallback
     */
    doBulkEdit(readyCallback) {

        var fields = [];

        this.bulkEditFields.forEach(function (field) {
            if (typeof this.request.body[field.name] !== 'undefined') {

                if (this.request.body[field.name] === 'true') {
                    this.request.body[field.name] = true;
                } else if (this.request.body[field.name] === 'false') {
                    this.request.body[field.name] = false;
                }

                fields.push({
                    path: field.path,
                    value: this.request.body[field.name]
                })
            }
        }.bind(this));

        var pagination = {
            currentPage: 1,
            pageSize: 10000
        };

        this.model.getListFiltered(this.getViewFilters(), null, pagination, {}, function (error, locals) {
            if (error != null) {
                return readyCallback(error);
            }

            async.eachSeries(locals.items, function (item, callback) {

                fields.forEach(function (field) {
                    objectPath.set(item, field.path, field.value);
                });

                item.save(function (err) {
                    if (err) this._logger.error(err);
                    callback();
                });

            }.bind(this), function () {

                this.flash.addMessage("Items successfully updated in the database!", FlashMessageType.SUCCESS);
                this.terminate();
                this.response.redirect(this.getActionUrl('list'));

                readyCallback();

            }.bind(this));

        }.bind(this));
    }

    /**
     * Proceed with Delete operation
     *
     * @param readyCallback
     */
    doDelete(readyCallback) {

        this.canDelete(err => {
            if (err) return readyCallback(err);

            this.model.removeById(this.itemId, this.userId, (error, item) => {

                // Emitting event
                this.emit(BaseCRUDController.CRUDEvents.ITEM_DELETE, {item: item});

                if (error != null) {
                    this.flash.addMessage("Failed to delete item! " + error.message, FlashMessageType.ERROR);
                    this.terminate();
                    this.response.redirect(this.getActionUrl('list'));

                    return readyCallback(error);
                }

                // Send remove item statuses
                if (item != null) {
                    this.flash.addMessage(this.itemRemovedSuccessMessage, FlashMessageType.SUCCESS);
                } else {
                    this.flash.addMessage(this.itemCanBeRemovedNotFoundMessage, FlashMessageType.ERROR);
                }

                // Terminating page
                this.terminate();
                this.response.redirect(this.getActionUrl('list'));

                // Send DATA_READY event
                readyCallback();
            });
        });
    }

    /**
     * Bulk Delete all selected items in table
     * @param readyCallback
     */
    bulkDelete(readyCallback) {

        this.canDelete(err => {
            if (err) return readyCallback(err);

            var selectedItems = [];
            if (this.request.body.selectedItems) {
                selectedItems = _.isArray(this.request.body.selectedItems) ? this.request.body.selectedItems : [this.request.body.selectedItems];
            }

            async.each(selectedItems, (item, callback) => {
                this.model.removeById(item, this.userId, (error, item) => {
                    if (error) {
                        return callback(error);
                    }

                    // Emitting event
                    this.emit(BaseCRUDController.CRUDEvents.ITEM_DELETE, {item: item});

                    callback();
                });
            }, err => {
                if (err) {
                    this.flash.addMessage("Failed to delete item! " + err.message, FlashMessageType.ERROR);
                } else {
                    this.flash.addMessage("Items successfully removed from the database!", FlashMessageType.INFO);
                }

                this.terminate();
                this.response.redirect(this.getActionUrl('list'));
                readyCallback(err);
            });
        });
    }

    /**
     * Handle autocomplete
     *
     * @param readyCallback
     */
    doAutocomplete(readyCallback) {

        var pagination = {
            currentPage: 1,
            pageSize: 10000
        };

        this.model.getListFiltered(this.getViewFilters(), null, pagination, {}, function (error, data) {
            if (error != null) {
                return readyCallback(error);
            }

            // Set page data
            if (data != null) {
                for (var key in data) {
                    if (data.hasOwnProperty(key)) {
                        this.data[key] = data[key];
                    }
                }
            }

            if (typeof this._autocompleteSuggestionsField === 'object') {

                this.data.items = this.data.items.map((item) => {

                    const itemObject = item.toObject({getters: true});

                    return {
                        id: this._autocompleteSuggestionsField.idField ?
                            objectPath.get(itemObject, this._autocompleteSuggestionsField.idField) : item._id,
                        text: this._autocompleteSuggestionsField.displayFields.map((displayField) => {
                            return objectPath.get(itemObject, displayField);
                        }).join(', ')
                    }
                });

            } else {

                this.data.items = this.data.items.map((item) => {
                    return {
                        id: item._id,
                        text: item[this._autocompleteSuggestionsField]
                    }
                });
            }

            this.terminate();
            this.response.send(this.data);

            // Send DATA_READY event
            readyCallback();
        }.bind(this));
    }

    /**
     * Validate all resource instances
     *
     * @param readyCallback
     */
    doValidateAll(readyCallback) {

        this.model.validateAll();

        this.flash.addMessage("Validation started!", FlashMessageType.INFO);
        this.terminate();
        this.response.redirect(this.getActionUrl('list'));
        readyCallback();
    }
}

/**
 * Base CRUD Events
 *
 * @type {{ITEM_CREATE: string, ITEM_BEFORE_INSERT: string, ITEM_UPDATE: string, ITEM_BEFORE_UPDATE: string, ITEM_DELETE: string}}
 */
BaseCRUDController.CRUDEvents = {
    ITEM_CREATE: 'ITEM_CREATE',
    ITEM_BEFORE_INSERT: 'ITEM_BEFORE_INSERT',
    ITEM_UPDATE: 'ITEM_UPDATE',
    ITEM_BEFORE_UPDATE: 'ITEM_BEFORE_UPDATE',
    ITEM_DELETE: 'ITEM_DELETE'
};

/**
 * Exporting Controller
 *
 * @type {Function}
 */
module.exports = BaseCRUDController;
