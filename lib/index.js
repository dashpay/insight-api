'use strict';

var Writable = require('stream').Writable;
var bodyParser = require('body-parser');
var compression = require('compression');
var BaseService = require('./service');
var inherits = require('util').inherits;
var BlockController = require('./blocks');
var TxController = require('./transactions');
var AddressController = require('./addresses');
var GovObjectController = require('./govobject');
var GovernanceController = require('./governance');
var StatusController = require('./status');
var MessagesController = require('./messages');
var MasternodesController = require('./masternodes');
var UtilsController = require('./utils');
var CurrencyController = require('./currency');
var SporkController = require('./sporks');
var RateLimiter = require('./ratelimiter');
var morgan = require('morgan');
var dashcore = require('@dashevo/dashcore-lib');
var _ = dashcore.deps._;
var $ = dashcore.util.preconditions;
var Transaction = dashcore.Transaction;
var EventEmitter = require('events').EventEmitter;

/**
 * A service for Bitcore to enable HTTP routes to query information about the blockchain.
 *
 * @param {Object} options
 * @param {Boolean} options.enableCache - This will enable cache-control headers
 * @param {Number} options.cacheShortSeconds - The time to cache short lived cache responses.
 * @param {Number} options.cacheLongSeconds - The time to cache long lived cache responses.
 * @param {String} options.routePrefix - The URL route prefix
 */
var InsightAPI = function(options) {
  BaseService.call(this, options);

  // in minutes
  this.currencyRefresh = options.currencyRefresh || CurrencyController.DEFAULT_CURRENCY_DELAY;

  this.subscriptions = {
    inv: []
  };

  if (!_.isUndefined(options.enableCache)) {
    $.checkArgument(_.isBoolean(options.enableCache));
    this.enableCache = options.enableCache;
  }
  this.cacheShortSeconds = options.cacheShortSeconds;
  this.cacheLongSeconds = options.cacheLongSeconds;

  this.rateLimiterOptions = options.rateLimiterOptions;
  this.disableRateLimiter = options.disableRateLimiter;

  this.blockSummaryCacheSize = options.blockSummaryCacheSize || BlockController.DEFAULT_BLOCKSUMMARY_CACHE_SIZE;
  this.blockCacheSize = options.blockCacheSize || BlockController.DEFAULT_BLOCK_CACHE_SIZE;

  if (!_.isUndefined(options.routePrefix)) {
    this.routePrefix = options.routePrefix;
  } else {
    this.routePrefix = 'insight-api';
  }

  this.txController = new TxController(this.node);
};

InsightAPI.dependencies = ['dashd', 'web'];

inherits(InsightAPI, BaseService);

InsightAPI.prototype.cache = function(maxAge) {
  var self = this;
  return function(req, res, next) {
    if (self.enableCache) {
      res.header('Cache-Control', 'public, max-age=' + maxAge);
    }
    next();
  };
};

InsightAPI.prototype.cacheShort = function() {
  var seconds = this.cacheShortSeconds || 30; // thirty seconds
  return this.cache(seconds);
};

InsightAPI.prototype.cacheLong = function() {
  var seconds = this.cacheLongSeconds || 86400; // one day
  return this.cache(seconds);
};

InsightAPI.prototype.getRoutePrefix = function() {
  return this.routePrefix;
};

InsightAPI.prototype.start = function(callback) {
  this.node.services.dashd.on('tx', this.transactionEventHandler.bind(this));
  this.node.services.dashd.on('txlock', this.transactionLockEventHandler.bind(this));
  this.node.services.dashd.on('block', this.blockEventHandler.bind(this));
  setImmediate(callback);
};

InsightAPI.prototype.createLogInfoStream = function() {
  var self = this;

  function Log(options) {
    Writable.call(this, options);
  }
  inherits(Log, Writable);

  Log.prototype._write = function (chunk, enc, callback) {
    self.node.log.info(chunk.slice(0, chunk.length - 1)); // remove new line and pass to logger
    callback();
  };
  var stream = new Log();

  return stream;
};

InsightAPI.prototype.getRemoteAddress = function(req) {
  if (req.headers['cf-connecting-ip']) {
    return req.headers['cf-connecting-ip'];
  }
  return req.socket.remoteAddress;
};

InsightAPI.prototype._getRateLimiter = function() {
  var rateLimiterOptions = _.isUndefined(this.rateLimiterOptions) ? {} : _.clone(this.rateLimiterOptions);
  rateLimiterOptions.node = this.node;
  var limiter = new RateLimiter(rateLimiterOptions);
  return limiter;
};

InsightAPI.prototype.setupRoutes = function(app) {

  var self = this;

  //Enable rate limiter
  if (!this.disableRateLimiter) {
    var limiter = this._getRateLimiter();
    app.use(limiter.middleware());
  }

  //Setup logging
  morgan.token('remote-forward-addr', function(req){
    return self.getRemoteAddress(req);
  });
  var height = (typeof self.node.services !== 'undefined') ? ((self.node.services.dashd.height) ? self.node.services.dashd.height : 0) : 0;
  var logFormat = '{'+height +'} :remote-forward-addr ":method :url" :status :res[content-length] :response-time ":user-agent" ';
  var logStream = this.createLogInfoStream();
  app.use(morgan(logFormat, {stream: logStream}));

  //Enable compression
  app.use(compression());

  //Enable urlencoded data
  app.use(bodyParser.urlencoded({extended: true}));

  //Enable CORS
  app.use(function(req, res, next) {

    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, HEAD, PUT, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Content-Length, Cache-Control, cf-connecting-ip');

    var method = req.method && req.method.toUpperCase && req.method.toUpperCase();

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
    } else {
      next();
    }
  });

  //Block routes
  var blockOptions = {
    node: this.node,
    blockSummaryCacheSize: this.blockSummaryCacheSize,
    blockCacheSize: this.blockCacheSize
  };
  var blocks = new BlockController(blockOptions);
  app.get('/blocks', this.cacheShort(), blocks.list.bind(blocks));

  app.get('/block/:blockHash', this.cacheShort(), blocks.checkBlockHash.bind(blocks), blocks.show.bind(blocks));
  app.param('blockHash', blocks.block.bind(blocks));

  app.get('/rawblock/:blockHash', this.cacheLong(), blocks.checkBlockHash.bind(blocks), blocks.showRaw.bind(blocks));
  app.param('blockHash', blocks.rawBlock.bind(blocks));

  app.get('/block-index/:height', this.cacheShort(), blocks.blockIndex.bind(blocks));
  app.param('height', blocks.blockIndex.bind(blocks));

  //Return 25 next blocks from blockHash or blockHeight
  app.get('/block-headers/:blockIdentifier',this.cacheLong(),blocks.blockHeaders.bind(blocks));
  //Return nbOfBlock's blocks next from blockHash or blockHeight
  app.get('/block-headers/:blockIdentifier/:nbOfBlock',this.cacheLong(),blocks.blockHeaders.bind(blocks));

  // Transaction routes
  var transactions = new TxController(this.node);
  app.get('/tx/:txid', this.cacheShort(), transactions.show.bind(transactions));
  app.param('txid', transactions.transaction.bind(transactions));
  app.get('/txs', this.cacheShort(), transactions.list.bind(transactions));
  app.post('/tx/send', transactions.send.bind(transactions));
  app.post('/tx/sendix', transactions.sendix.bind(transactions));

  // Raw Routes
  app.get('/rawtx/:txid', this.cacheLong(), transactions.showRaw.bind(transactions));
  app.param('txid', transactions.rawTransaction.bind(transactions));

  // Address routes
  var addresses = new AddressController(this.node);
  app.get('/addr/:addr', this.cacheShort(), addresses.checkAddr.bind(addresses), addresses.show.bind(addresses));
  app.get('/addrs/:addrs', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.show.bind(addresses));
  app.get('/addr/:addr/utxo', this.cacheShort(), addresses.checkAddr.bind(addresses), addresses.utxo.bind(addresses));
  app.get('/addrs/:addrs/utxo', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.multiutxo.bind(addresses));
  app.post('/addrs/utxo', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.multiutxo.bind(addresses));
  app.get('/addrs/:addrs/utxopage', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.paginatedUtxo.bind(addresses));
  app.post('/addrs/utxopage', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.paginatedUtxo.bind(addresses));
  app.get('/addrs/:addrs/txs', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.multitxs.bind(addresses));
  app.post('/addrs/txs', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.multitxs.bind(addresses));

  // Address property routes
  app.get('/addr/:addr/balance', this.cacheShort(), addresses.checkAddr.bind(addresses), addresses.balance.bind(addresses));
  app.get('/addr/:addr/totalReceived', this.cacheShort(), addresses.checkAddr.bind(addresses), addresses.totalReceived.bind(addresses));
  app.get('/addr/:addr/totalSent', this.cacheShort(), addresses.checkAddr.bind(addresses), addresses.totalSent.bind(addresses));
  app.get('/addr/:addr/unconfirmedBalance', this.cacheShort(), addresses.checkAddr.bind(addresses), addresses.unconfirmedBalance.bind(addresses));
  app.get('/addrs/:addrs/balance', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.balance.bind(addresses));
  app.get('/addrs/:addrs/totalReceived', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.totalReceived.bind(addresses));
  app.get('/addrs/:addrs/totalSent', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.totalSent.bind(addresses));
  app.get('/addrs/:addrs/unconfirmedBalance', this.cacheShort(), addresses.checkAddrs.bind(addresses), addresses.unconfirmedBalance.bind(addresses));

  //Governance Routes
  var govObject = new GovObjectController(this.node);
  app.post('/gobject/submit', this.cacheShort(), govObject.submit.bind(govObject));
  app.get('/gobject/list', this.cacheShort(), govObject.list.bind(govObject));
  app.get('/gobject/list/:filter', this.cacheShort(), govObject.list.bind(govObject));
  app.get('/gobject/get/:hash', this.cacheShort(), govObject.validateHash.bind(govObject), govObject.show.bind(govObject));
  app.get('/gobject/check/:hexdata', this.cacheShort(), govObject.govObjectCheck.bind(govObject));
  app.get('/gobject/info', this.cacheShort(), govObject.getInfo.bind(govObject));
  app.get('/gobject/count', this.cacheShort(), govObject.getCount.bind(govObject));
  app.get('/gobject/deserialize/:hexdata', this.cacheShort(), govObject.govObjectDeserialize.bind(govObject));
  app.get('/gobject/votes/current/:hash', this.cacheShort(), govObject.govObjectCurrentVotes.bind(govObject));
  app.get('/gobject/votes/:hash', this.cacheShort(), govObject.govObjectVotes.bind(govObject));

  var governance = new GovernanceController(this.node);
  app.get('/governance/budget/:blockindex', this.cacheShort(), governance.getSuperBlockBudget.bind(governance));

  //Masternodes
  var masternodes = new MasternodesController(this.node);
  app.get('/masternodes/list', this.cacheShort(), masternodes.list.bind(masternodes));
  app.get('/masternodes/validate/:payee', this.cacheShort(), masternodes.validate.bind(masternodes));
  // Status route
  var status = new StatusController(this.node);
  app.get('/status', this.cacheShort(), status.show.bind(status));
  app.get('/sync', this.cacheShort(), status.sync.bind(status));
  app.get('/peer', this.cacheShort(), status.peer.bind(status));
  app.get('/version', this.cacheShort(), status.version.bind(status));

  // Address routes
  var messages = new MessagesController(this.node);
  app.get('/messages/verify', messages.verify.bind(messages));
  app.post('/messages/verify', messages.verify.bind(messages));

  //Spork routes
  var sporks = new SporkController(this.node);
  app.get('/sporks', sporks.list.bind(sporks));

  // Utils route
  var utils = new UtilsController(this.node);
  app.get('/utils/estimatefee', utils.estimateFee.bind(utils));

  // Currency
  var currency = new CurrencyController({
    node: this.node,
    currencyRefresh: this.currencyRefresh
  });
  app.get('/currency', currency.index.bind(currency));

  // Not Found
  app.use(function(req, res) {
    res.status(404).jsonp({
      status: 404,
      url: req.originalUrl,
      error: 'Not found'
    });
  });

};

InsightAPI.prototype.getPublishEvents = function() {
  return [
    {
      name: 'inv',
      scope: this,
      subscribe: this.subscribe.bind(this),
      unsubscribe: this.unsubscribe.bind(this),
      extraEvents: ['tx', 'txlock', 'block']
    }
  ];
};

InsightAPI.prototype.blockEventHandler = function(hashBuffer) {
  // Notify inv subscribers
  for (var i = 0; i < this.subscriptions.inv.length; i++) {
    this.subscriptions.inv[i].emit('block', hashBuffer.toString('hex'));
  }
};
InsightAPI.prototype.transactionEventHandler = function(txBuffer) {
  try {
    var tx = new Transaction().fromBuffer(txBuffer);
  }
  catch(error) {
    console.log(`${error}\nbad txBuffer: ${txBuffer.toString('hex')}`);
  }
  var result = this.txController.transformInvTransaction(tx);

  for (var i = 0; i < this.subscriptions.inv.length; i++) {
    this.subscriptions.inv[i].emit('tx', result);
  }
};
InsightAPI.prototype.transactionLockEventHandler = function(txBuffer) {
  try {
    var tx = new Transaction().fromBuffer(txBuffer);
  }
  catch(error) {
    console.log(`${error}\nbad txBuffer: ${txBuffer.toString('hex')}`);
  }
  var result = this.txController.transformInvTransaction(tx, true);

  for (var i = 0; i < this.subscriptions.inv.length; i++) {
    this.subscriptions.inv[i].emit('txlock', result);
  }
};

InsightAPI.prototype.subscribe = function(emitter) {
  $.checkArgument(emitter instanceof EventEmitter, 'First argument is expected to be an EventEmitter');

  var emitters = this.subscriptions.inv;
  var index = emitters.indexOf(emitter);
  if(index === -1) {
    emitters.push(emitter);
  }
};

InsightAPI.prototype.unsubscribe = function(emitter) {
  $.checkArgument(emitter instanceof EventEmitter, 'First argument is expected to be an EventEmitter');

  var emitters = this.subscriptions.inv;
  var index = emitters.indexOf(emitter);
  if(index > -1) {
    emitters.splice(index, 1);
  }
};

module.exports = InsightAPI;
