'use strict';

/**
 * Requiring base view
 *
 * @type {exports|module.exports}
 */
let CoreView = require('./view.js');

/**
 * Requiring application Facade
 */
let applicationFacade = require('../facade.js').ApplicationFacade.instance;

/**
 * Requiring SWIG
 *
 * @type {*|exports|module.exports}
 */
let swig = require('swig-templates');

/**
 * Requiring core filesystem functions
 */
let fs = require('fs');

/**
 * Requiring core path functions
 */
let path = require('path');

/**
 * Lodash swig integration
 *
 * @type {*|exports|module.exports}
 */
let swigLodash = require('swig-lodash');

/**
 * SWIG handle
 */
let _swigEngine;

/**
 * SWIG custom loader path map
 *
 * @type {{}}
 */
let swigResolvePathCache = {};

/**
 * SWIG custom loader files map
 *
 * @type {{}}
 */
let swigTemplateFileCache = {};

/**
 *  Module view. Handle different view types. Apply SWIG templates
 */
class ModuleView extends CoreView.View {

    /**
     * Default view class
     *
     * @param {string} viewType
     * @param {{}} data
     * @param {string} template
     * @param {*} error
     */
    constructor(viewType, data, template, error) {
        super(viewType, data, template, error);

        if (_swigEngine) {

            this._swigEngine = _swigEngine;

        } else {

            let swigDefaults = {
                loader: this.getSwigTemplateLoader()
            };

            if (applicationFacade.config.isDev) {
                swigDefaults.cache = false;
            }

            _swigEngine = this._swigEngine = new swig.Swig(swigDefaults);

            // Add all lodash functions
            swigLodash.useFilter(this._swigEngine);
        }
    }

    /**
     * Creates HTML View for specified parameters
     *
     * @param template
     * @param data
     * @param error
     * @returns {View}
     */
    static htmlView(template, data, error) {
        let viewInstance = new ModuleView(CoreView.ViewType.HTML, data, template, error);

        return viewInstance;
    }

    /**
     * Creates JSON View for specified data
     *
     * @param data
     * @param error
     * @returns {View}
     */
    static jsonView(data, error) {
        let viewInstance = new ModuleView(CoreView.ViewType.JSON, data, null, error);

        return viewInstance;
    }

    /**
     * Registers ROOT for templates
     *
     * @param rootDirectory
     * @param priority
     */
    static registerTemplatesRoot(rootDirectory, priority) {
        if (ModuleView._rootDirDefinitions == null) {
            ModuleView._rootDirDefinitions = [];
        }

        let pathNormalized = path.normalize(rootDirectory);
        ModuleView._rootDirDefinitions.push({path: pathNormalized, priority: priority});

        /**
         * Sorting based on the priority
         */
        ModuleView._rootDirDefinitions.sort(function (obj1, obj2) {
            if (obj1.priority > obj2.priority) {
                return 1;
            } else if (obj1.priority < obj2.priority) {
                return -1;
            } else {
                return 0;
            }
        });
    }

    /**
     * Returns template loader for SWIG Templates
     */
    getSwigTemplateLoader() {
        if (this._swigTemplateLoader == null) {
            /**
             * Create SWIG Template loader
             *
             * @param basepath
             * @param encoding
             * @returns {{}}
             * @private
             */
            this._swigTemplateLoader = function (basepath, encoding) {
                let templateLoader = {};
                let $this = this;

                encoding = encoding || 'utf8';
                let templatesBasePath = (basepath) ? path.normalize(basepath) : null;

                /**
                 * Resolves <var>to</var> to an absolute path or unique identifier. This is used for building correct,
                 * normalized, and absolute paths to a given template.
                 *
                 * @alias resolve
                 * @param  {string} to     Non-absolute identifier or pathname to a file.
                 * @param  {string} [from] If given, should attempt to find the <var>to</var> path in relation to
                 *                         this given, known path.
                 * @return {string}
                 */
                templateLoader.resolve = function (to, from) {

                    if (templatesBasePath) {
                        from = templatesBasePath;
                    } else {
                        from = (from) ? path.dirname(from) : $this.viewPath;
                    }

                    let key = to;
                    if (from) key += '-' + from;
                    if (swigResolvePathCache[key]) return swigResolvePathCache[key]; // from cache

                    let fullPath = null;

                    if (ModuleView._rootDirDefinitions != null) {

                        for (let i = 0; i < ModuleView._rootDirDefinitions.length; i++) {

                            let dirDefinition = ModuleView._rootDirDefinitions[i];

                            let tmpPath = path.resolve(dirDefinition.path, to);
                            // console.log('Path: %s, %s, %s', tmpPath, dirDefinition.path, to);

                            if (fs.existsSync(tmpPath)) {

                                fullPath = tmpPath;
                                break;
                            }
                        }
                    }

                    // Traditional path resolving logic
                    if (fullPath == null || !fs.existsSync(fullPath)) {

                        fullPath = path.resolve(applicationFacade.basePath, to);

                        if (!fs.existsSync(fullPath)) {

                            fullPath = path.resolve(from, to);
                        }
                    }

                    // cache if not dev
                    if (!applicationFacade.config.isDev) {
                        swigResolvePathCache[key] = fullPath;
                    }

                    return fullPath;
                };

                /**
                 * Loads a single template. Given a unique <var>identifier</var> found by the <var>resolve</var> method this should return the given template.
                 * @alias load
                 * @param  {string}   identifier  Unique identifier of a template (possibly an absolute path).
                 * @param  {function} [callback]  Asynchronous callback function. If not provided, this method should run synchronously.
                 * @return {string}               Template source string.
                 */
                templateLoader.load = function (identifier, callback) {

                    identifier = templateLoader.resolve(identifier);

                    if (callback) {

                        if (swigTemplateFileCache[identifier]) return callback(null, swigTemplateFileCache[identifier]);

                        fs.readFile(identifier, encoding, (err, data) => {
                            if (err) return callback(err);

                            swigTemplateFileCache[identifier] = data;

                            callback(null, data);
                        });

                    } else {

                        if (swigTemplateFileCache[identifier]) return swigTemplateFileCache[identifier];

                        // Read file in synchronous mode
                        let data = fs.readFileSync(identifier, encoding);

                        // cache if not dev
                        if (!applicationFacade.config.isDev) {
                            swigTemplateFileCache[identifier] = data;
                        }

                        return data;
                    }
                };

                return templateLoader;

            }.bind(this);
        }

        // Returning Template loader based on SWIG
        return this._swigTemplateLoader();
    }
}

/**
 * Exporting view classes
 */
module.exports.ModuleView = ModuleView;
