// Using STRICT mode for ES6 features
"use strict";

/**
 * Initializing application facade before export
 */
module.exports = {
    ApplicationEvent: require('./lib/facade.js').ApplicationEvent,
    ApplicationFacade: require('./lib/facade.js').ApplicationFacade,
    ControllerEvent: require('./lib/controller.js').ControllerEvent,
    Controller: require('./lib/controller.js').Controller,
    Controllers: {
        CRUDController: require('./lib/controllers/crudcontroller.js'),
        StateController: require('./lib/controllers/statecontroller.js'),
        APIController: require('./lib/controllers/apicontroller.js'),
        APISessionController: require('./lib/controllers/apisessioncontroller.js'),
        APIPushDeviceController: require('./lib/controllers/apipushdevicecontroller'),
        WebPushAPIController: require('./lib/controllers/apiwebpushcontroller')
    },
    Error: {
        BaseError: require('./lib/error/error.js'),
        HTTPError: require('./lib/error/httperror.js'),
        LoaderError: require('./lib/error/loadererror.js'),
        APIError: require('./lib/error/api.js')
    },
    ExecutionState: require('./lib/controller.js').ExecutionState,
    FlashMessage: require('./lib/flashmessages.js').FlashMessage,
    FlashMessages: require('./lib/flashmessages.js').FlashMessages,
    FlashMessageType: require('./lib/flashmessages.js').FlashMessageType,
    HTTPServer: require('./lib/httpserver.js'),
    Logger: require('./lib/logger.js'),
    Mailer: require('./lib/mailer.js'),
    MailerSendPulse: require('./lib/mailersendpulse.js'),
    MailerMailGun: require('./lib/mailermailgun'),
    Model: require('./lib/model.js').Model,
    AppBootstrap: require('./lib/appbootstrap.js'),
    ModuleView: require('./lib/view/moduleview.js').ModuleView,
    MongooseModel: require('./lib/mongoosemodel.js').MongooseModel,
    Models: {
        BaseAPIModel: require('./lib/baseapimodel.js').BaseAPIModel,
        SequelizeModel: require('./lib/sequelizemodel.js').SequelizeModel,
        ElasticSearchModel: require('./lib/elasticsearchmodel.js').ElasticSearchModel
    },
    ElasticSearch: require('./lib/elasticsearch'),
    ValidationError: require('./lib/mongoosemodel.js').ValidationError,
    PkgClient: require('./lib/pkgclient.js'),
    QueueClient: require('./lib/queueclient.js'),
    QueueServer: require('./lib/queueserver.js'),
    ViewType: require('./lib/view/view.js').ViewType,
    View: require('./lib/view/view.js').View
};
