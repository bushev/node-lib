'use strict';

/**
 * Kraken image optimisation library
 * @type {*|exports|module.exports}
 */
const Kraken = require('kraken');

/**
 * Request library
 * @type {request|exports|module.exports}
 */
const request = require('request');

/**
 * Async events execution
 */
const async = require('async');

/**
 * Random string generation
 */
const rs = require('randomstring');

/**
 * File systems module
 */
const fs = require('fs');

/**
 * OS node core module
 */
const os = require('os');

/**
 * Path node core module
 */
const path = require('path');

/**
 * GraphicsMagick and ImageMagick for node
 *
 * @type {*|exports|module.exports}
 */
const gm = require('gm').subClass({imageMagick: true});

/**
 *  Class that implements pkg cloud API
 */
class PkgClient {

    /**
     * Constructor
     *
     */
    constructor() {

        /**
         * Global config
         *
         * @private
         */
        this._config = require('./facade.js').ApplicationFacade.instance.config;

        /**
         * Application logger
         *
         * @type {Logger|exports|module.exports}
         * @private
         */
        this._logger = require('./facade.js').ApplicationFacade.instance.logger;

        /**
         * Configure Pkg Cloud client
         */
        this.configure();

        /**
         * Kraken API instance
         *
         * @type {*|exports|module.exports}
         * @private
         */
        this._kraken = new Kraken({
            api_key: this._config._configuration.KRAKEN_API_KEY,
            api_secret: this._config._configuration.KRAKEN_API_SECRET
        });
    }

    /**
     * Return a client
     *
     */
    get client() {
        return this._client;
    }

    get logger() {
        return this._logger;
    }

    /**
     * Obtain remote file name
     *
     * @param options
     * @param {string} options.fileName - File name.
     * @param {string} [options.remoteFileName] - File name to use for remove file (exactly).
     */
    getRemoteFileName(options) {

        if (options.remoteFileName) {

            return options.remoteFileName;

        } else {

            /**
             * Remote file name, MUST be unique
             * @type {string}
             */
            let remoteFileName = options.fileName ? rs.generate(5) + '_' + options.fileName : rs.generate(20);

            if (this._options.provider === 'azure') {

                // azure BLOB storage is not support some charsets in names
                remoteFileName = remoteFileName.replace(/[^a-z0-9A-Z\._]+/g, '-');
            }

            return remoteFileName;
        }
    }

    /**
     * Configure Pkg Cloud client
     */
    configure() {

        let options = {};
        let pkgCloudConfiguration = this._config._configuration.pkgcloud;

        // openstack / rackspace / azure
        if (this._config._configuration.PKG_CLOUD_PROVIDER) {
            options.provider = this._config._configuration.PKG_CLOUD_PROVIDER
        } else if (pkgCloudConfiguration && pkgCloudConfiguration.provider) {
            options.provider = pkgCloudConfiguration.provider;
        } else {
            throw new Error('PkgClient: provider option is not defined, can\'t create a client.')
        }

        if (options.provider === 'openstack' || options.provider === 'rackspace') {
            // Common option user name
            if (this._config._configuration.PKG_CLOUD_USER_NAME) {
                options.username = this._config._configuration.PKG_CLOUD_USER_NAME
            } else if (pkgCloudConfiguration && pkgCloudConfiguration.username) {
                options.username = pkgCloudConfiguration.username;
            } else {
                throw new Error('PkgClient: username option is not defined, can\'t create a client.')
            }
        }

        if (options.provider == 'openstack') {

            if (this._config._configuration.PKG_CLOUD_AUTH_URL) {
                options.authUrl = this._config._configuration.PKG_CLOUD_AUTH_URL
            } else if (pkgCloudConfiguration && pkgCloudConfiguration.authUrl) {
                options.authUrl = pkgCloudConfiguration.authUrl;
            } else {
                throw new Error('PkgClient: authUrl option is not defined for openstack provider, can\'t create a client.')
            }

            if (this._config._configuration.PKG_CLOUD_PASSWORD) {
                options.password = this._config._configuration.PKG_CLOUD_PASSWORD
            } else if (pkgCloudConfiguration && pkgCloudConfiguration.password) {
                options.password = pkgCloudConfiguration.password;
            } else {
                throw new Error('PkgClient: password option is not defined for openstack provider, can\'t create a client.')
            }

        } else if (options.provider == 'rackspace') {

            if (this._config._configuration.PKG_CLOUD_API_KEY) {
                options.apiKey = this._config._configuration.PKG_CLOUD_API_KEY
            } else if (pkgCloudConfiguration && pkgCloudConfiguration.apiKey) {
                options.apiKey = pkgCloudConfiguration.apiKey;
            } else {
                throw new Error('PkgClient: apiKey option is not defined for openstack provider, can\'t create a client.')
            }

        } else if (options.provider == 'azure') {

            if (this._config._configuration.PKG_CLOUD_AZURE_ACCOUNT) {
                options.storageAccount = this._config._configuration.PKG_CLOUD_AZURE_ACCOUNT;
            } else if (pkgCloudConfiguration && pkgCloudConfiguration.azureAccount) {
                options.storageAccount = pkgCloudConfiguration.azureAccount;
            } else {
                throw new Error('PkgClient: storageAccount option is not defined for azure provider, can\'t create a client.')
            }

            if (this._config._configuration.PKG_CLOUD_AZURE_ACCESS_KEY) {
                options.storageAccessKey = this._config._configuration.PKG_CLOUD_AZURE_ACCESS_KEY;
            } else if (pkgCloudConfiguration && pkgCloudConfiguration.azureAccessKey) {
                options.storageAccessKey = pkgCloudConfiguration.azureAccessKey;
            } else {
                throw new Error('PkgClient: storageAccessKey option is not defined for azure provider, can\'t create a client.')
            }

        } else {
            throw new Error(`PkgClient: Unexpected provider '${options.provider}'.`);
        }

        // Optional
        if (this._config._configuration.PKG_CLOUD_REGION) {
            options.region = this._config._configuration.PKG_CLOUD_REGION
        } else if (pkgCloudConfiguration && pkgCloudConfiguration.region) {
            options.region = pkgCloudConfiguration.region;
        }

        this._options = options;

        // Create a client
        this._client = require('pkgcloud').storage.createClient(options);
    }

    /**
     * Create Container for Openstack
     *
     * @param options
     * @param callback
     */
    createContainerOpenstack(options, callback) {
        let opt = {
            name: options.containerName
        };

        if (options.containerCdn) {
            opt.metadata = {
                type: 'public'
            }
        }

        this.client.createContainer(opt, callback);
    }

    /**
     * Create Container for Rackspace
     *
     * @param options
     * @param callback
     */
    createContainerRackspace(options, callback) {
        let opt = {
            name: options.containerName
        };

        this.client.createContainer(opt, callback);
    }

    /**
     * Create Container for Azure
     *
     * @param options
     * @param callback
     */
    createContainerAzure(options, callback) {
        let opt = {
            name: options.containerName
        };

        this.client.createContainer(opt, callback);
    }

    /**
     * Upload item to the specified container, create container if it's not exist
     *
     * @param {string} file - Local file path
     * @param {Object} options - Upload options.
     * @param {string} options.fileName - File name.
     * @param {string} options.containerName - Container name.
     * @param {boolean} options.containerCdn - Should container use CDN or not.
     * @param {boolean} options.optimize - Optimize jpg image or not (kraken.io).
     * @param {boolean} options.optimizeLocally - Optimize jpg image or not (local).
     * @param {Object} options.resize - Resize parameters.
     * @param {string} [options.remoteFileName] - File name to use for remove file (exactly).
     * @param {String} [options.baseUrl] - Base URL path including container information.
     * @param {function} callback - Callback function.
     */
    upload(file, options, callback) {

        let optimizedPath = null;

        async.waterfall([callback => {

            this.client.getContainer(options.containerName, (err, container) => {

                if (err) {
                    if (err.statusCode == 404) {
                        /**
                         * Container not found
                         */
                        return callback(null, null);
                    }

                    return callback(err);
                }

                callback(null, container);
            });

        }, (container, callback) => {

            if (container) {
                callback(null, container);
            } else {
                if (this._options.provider == 'openstack') {
                    this.createContainerOpenstack(options, callback);
                } else if (this._options.provider == 'rackspace') {
                    this.createContainerRackspace(options, callback);
                } else if (this._options.provider == 'azure') {
                    this.createContainerAzure(options, callback);
                }
            }

        }, (container, callback) => {

            if (this._options.provider == 'rackspace' && !container.cdnEnabled && options.containerCdn) {
                container.enableCdn(err => {
                    if (err) return callback(err);

                    // Fetch container info again
                    this.client.getContainer(options.containerName, (err, container) => {
                        callback(err, container);
                    });

                });
            } else {
                callback(null, container);
            }

        }, (container, callback) => {

            if (options.optimize) {
                /**
                 * Optimize image using kraken
                 */
                let opts = {
                    file: file,
                    wait: true,
                    lossy: true,
                    resize: options.resize
                };

                this._kraken.upload(opts, data => {
                    if (data.success) {

                        this.logger.debug('Kraken response: ' + require('util').inspect(data));

                        optimizedPath = path.join(os.tmpdir(), rs.generate(20));

                        let writeStream = fs.createWriteStream(optimizedPath);

                        writeStream.on('finish', () => {
                            callback(null, container);
                        });

                        writeStream.on('error', callback);

                        let readStream = request.get(data.kraked_url);

                        readStream.on('error', callback);

                        readStream.pipe(writeStream);

                    } else {
                        callback('Kraken upload fails. Error message: ' + require('util').inspect(data));
                    }
                });
            } else if (options.optimizeLocally) {

                optimizedPath = path.join(os.tmpdir(), rs.generate(20));

                gm(file).thumb(options.resize.width, options.resize.height, optimizedPath, 65, err => {
                    callback(err, err ? null : container);
                }, '>');

            } else {
                callback(null, container)
            }

        }, (container, callback) => {

            /**
             * Create a read stream for our source file
             */
            let source = fs.createReadStream(optimizedPath || file);

            source.on('error', callback);

            /**
             * Remote file name, MUST be unique
             * @type {string}
             */
            let remoteFileName = this.getRemoteFileName(options);

            /**
             * Create a writable stream for our destination
             */
            let dest = this.client.upload({
                container: options.containerName,
                remote: remoteFileName
            });

            dest.on('error', callback);

            dest.on('success', remoteFile => {

                let result = {
                    fileName: remoteFile.name,
                    containerName: remoteFile.container
                };

                if ((container.cdnEnabled || (container.metadata && container.metadata.type === 'public')) && options.containerCdn) {

                    let baseUrl;

                    if (options.baseUrl) {

                        baseUrl = options.baseUrl;

                    } else if (this._options.provider == 'rackspace' && container.cdnSslUri) {

                        baseUrl = container.cdnSslUri;

                    } else if (this._options.provider == 'openstack' && remoteFile.client && remoteFile.client._serviceUrl) {

                        //baseUrl = remoteFile.client._serviceUrl + remoteFile.container;
                        baseUrl = this._config._configuration.PKG_CLOUD_BASE_URL + '/' + remoteFile.container;

                    } else if (this._options.provider == 'azure') {

                        baseUrl = `https://${this._options.storageAccount}.blob.core.windows.net/${remoteFile.container}`;

                    } else {
                        return callback(new Error('Can\'t get URL from pkgclient'));
                    }

                    result.cdnUrl = baseUrl + '/' + encodeURIComponent(remoteFile.name);
                }

                callback(null, result);
            });

            /**
             * Pipe the source to the destination
             */
            source.pipe(dest);

        }], (err, remoteFile) => {
            if (err) return callback(err);

            if (optimizedPath) {
                fs.unlink(optimizedPath, err => {
                    if (err) this.logger.error(err);

                    callback(err, remoteFile);
                });
            } else {
                callback(err, remoteFile);
            }
        });
    }

    /**
     * Download item from the specified container
     *
     * @param {Object} options - Download options
     * @param {string} options.fileName - Remote file name
     * @param {string} options.containerName - Container name
     * @param {string} [options.saveToFile] - Container name
     * @param {function} callback - Callback function
     */
    download(options, callback) {

        if (!options.saveToFile) {
            options.saveToFile = path.join(os.tmpdir(), rs.generate(5) + '_' + options.fileName);
        }

        let stream = this.client.download({
            container: options.containerName,
            remote: options.fileName
        }, (err) => {
            if (err) return callback(err);

            callback(null, {localFile: options.saveToFile});
        });

        stream.pipe(fs.createWriteStream(options.saveToFile));
    }
}

module.exports = PkgClient;