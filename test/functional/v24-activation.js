'use strict';

// Runs Dash Core (DASHD_PATH) on regtest with the indexes Insight needs,
// activates V24 by miner signalling, and checks the Insight API, served by the
// dashcore-node checkout at DASHCORE_NODE_PATH, on blocks and transactions from
// both sides of the activation: coinbases carry CbTx v3 before it and CbTx v4
// from the activation block on.

var assert = require('assert');
var childProcess = require('child_process');
var EventEmitter = require('events').EventEmitter;
var fs = require('fs');
var net = require('net');
var os = require('os');
var path = require('path');

var InsightAPI = require('../../lib');

var RPC_USER = 'insight';
var RPC_PASSWORD = 'insight';
// DIP3 and v20 activate at height 432 on regtest, so blocks 432-479 carry CbTx v3.
var V24_HEIGHT = 480;

function freePort() {
  return new Promise(function(resolve, reject) {
    var server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', function() {
      var port = server.address().port;
      server.close(function() {
        resolve(port);
      });
    });
  });
}

function sleep(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms);
  });
}

describe('Insight API across the V24 activation (CbTx v4)', function() {
  this.timeout(300000);

  var dashdPath = process.env.DASHD_PATH;
  var dashcoreNodePath = process.env.DASHCORE_NODE_PATH;
  var DashcoreNode;
  var datadir;
  var dashd;
  var node;
  var rpcPort;
  var apiUrl;

  var miner;
  var addrA;
  var addrB;
  var pre = {};
  var post = {};
  var txMempool;
  var invTxids = [];
  var badTxLogs = [];
  var consoleLog = console.log;
  var failed = false;

  function rpc(method) {
    var params = Array.prototype.slice.call(arguments, 1);
    return fetch('http://127.0.0.1:' + rpcPort + '/wallet/w', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Basic ' + Buffer.from(RPC_USER + ':' + RPC_PASSWORD).toString('base64')
      },
      body: JSON.stringify({jsonrpc: '1.0', id: method, method: method, params: params})
    }).then(function(res) {
      return res.json();
    }).then(function(body) {
      if (body.error) {
        var err = new Error(method + ': ' + body.error.message);
        err.code = body.error.code;
        throw err;
      }
      return body.result;
    });
  }

  async function api(route, expectedStatus) {
    var res = await fetch(apiUrl + route);
    var text = await res.text();
    assert.strictEqual(res.status, expectedStatus || 200, route + ' -> ' + res.status + ': ' + text);
    return JSON.parse(text);
  }

  async function mine(count) {
    return rpc('generatetoaddress', count, miner);
  }

  async function mineTo(height) {
    var count = await rpc('getblockcount');
    if (height > count) {
      await mine(height - count);
    }
  }

  async function blockAt(height) {
    var hash = await rpc('getblockhash', height);
    var block = await rpc('getblock', hash, 2);
    return {
      hash: hash,
      height: height,
      time: block.time,
      coinbase: block.tx[0].txid,
      cbTxVersion: block.cbTx.version
    };
  }

  // dashcore-node defers tip updates that arrive within a second of each
  // other, so wait until the tip has settled.
  async function waitForInsightTip(hash, height) {
    var since = null;
    for (var i = 0; i < 300; i++) {
      var service = node.services.dashd;
      if (service.tiphash === hash && service.height === height) {
        since = since || Date.now();
        if (Date.now() - since > 1500) {
          return;
        }
      } else {
        since = null;
      }
      await sleep(100);
    }
    throw new Error('Insight did not settle on tip ' + height + ' ' + hash);
  }

  function utcDate(time) {
    return new Date(time * 1000).toISOString().slice(0, 10);
  }

  function voutTo(tx, address) {
    return tx.vout.filter(function(out) {
      var spk = out.scriptPubKey;
      return spk.address === address || (spk.addresses || []).indexOf(address) !== -1;
    });
  }

  before(async function() {
    try {
      await setup();
    } catch (e) {
      failed = true;
      throw e;
    }
  });

  async function setup() {
    if (!dashdPath || !dashcoreNodePath) {
      throw new Error('Set DASHD_PATH to a Dash Core v24 dashd binary and DASHCORE_NODE_PATH to a dashcore-node checkout');
    }
    DashcoreNode = require(path.resolve(dashcoreNodePath));
    datadir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-v24-'));
    rpcPort = await freePort();
    var zmqUrl = 'tcp://127.0.0.1:' + (await freePort());
    var httpPort = await freePort();
    apiUrl = 'http://127.0.0.1:' + httpPort + '/insight-api';

    dashd = childProcess.spawn(dashdPath, [
      '-regtest',
      '-datadir=' + datadir,
      '-txindex=1',
      '-addressindex=1',
      '-spentindex=1',
      '-timestampindex=1',
      '-server=1',
      '-listen=0',
      '-dnsseed=0',
      '-fallbackfee=0.00001',
      '-rpcuser=' + RPC_USER,
      '-rpcpassword=' + RPC_PASSWORD,
      '-rpcport=' + rpcPort,
      '-rpcbind=127.0.0.1',
      '-rpcallowip=127.0.0.1',
      '-zmqpubrawtx=' + zmqUrl,
      '-zmqpubrawtxlock=' + zmqUrl,
      '-zmqpubhashblock=' + zmqUrl,
      '-vbparams=v24:0:999999999999:' + V24_HEIGHT + ':10:8:6:5:0'
    ], {stdio: 'ignore'});

    for (var i = 0; ; i++) {
      try {
        await rpc('createwallet', 'w');
        break;
      } catch (e) {
        if (i > 120) {
          throw e;
        }
        await sleep(500);
      }
    }

    miner = await rpc('getnewaddress');
    addrA = await rpc('getnewaddress');
    addrB = await rpc('getnewaddress');
    await mineTo(440);

    node = new DashcoreNode.Node({
      network: 'regtest',
      port: httpPort,
      services: [{
        name: 'dashd',
        module: DashcoreNode.services.Dash,
        config: {
          connect: [{
            rpchost: '127.0.0.1',
            rpcport: rpcPort,
            rpcuser: RPC_USER,
            rpcpassword: RPC_PASSWORD,
            zmqpubrawtx: zmqUrl
          }]
        }
      }, {
        name: 'web',
        module: DashcoreNode.services.Web,
        config: {port: httpPort}
      }, {
        name: '@dashevo/insight-api',
        module: InsightAPI,
        config: {disableRateLimiter: true}
      }]
    });
    await new Promise(function(resolve, reject) {
      node.start(function(err) {
        return err ? reject(err) : resolve();
      });
    });

    // Record what Insight pushes to its websocket subscribers, and any
    // transaction it fails to parse.
    var inv = new EventEmitter();
    inv.on('tx', function(tx) {
      invTxids.push(tx.txid);
    });
    node.services['@dashevo/insight-api'].subscribe(inv);
    console.log = function(message) {
      if (String(message).indexOf('bad txBuffer') !== -1) {
        badTxLogs.push(message);
      }
      return consoleLog.apply(console, arguments);
    };

    // Before activation: fund A, and keep the wallet from spending that output.
    pre.tx = await rpc('sendtoaddress', addrA, 1.5);
    var preVout = voutTo(await rpc('getrawtransaction', pre.tx, true), addrA)[0].n;
    await rpc('lockunspent', false, [{txid: pre.tx, vout: preVout}]);
    await mine(1);
    pre.block = await blockAt(441);

    await mineTo(V24_HEIGHT);
    post.activation = await blockAt(V24_HEIGHT);

    // After activation: fund A again and spend A's pre-activation output to B.
    post.tx = await rpc('sendtoaddress', addrA, 2.25);
    var postVout = voutTo(await rpc('getrawtransaction', post.tx, true), addrA)[0].n;
    var raw = await rpc('createrawtransaction',
      [{txid: pre.tx, vout: preVout}],
      [{[addrB]: 1.4999}]);
    var signed = await rpc('signrawtransactionwithwallet', raw);
    post.spend = await rpc('sendrawtransaction', signed.hex);
    await mine(1);
    post.block = await blockAt(V24_HEIGHT + 1);

    // Fund the mempool transaction from the miner, not from A or B.
    await rpc('lockunspent', false, [{txid: post.tx, vout: postVout}, {txid: post.spend, vout: 0}]);
    txMempool = await rpc('sendtoaddress', addrA, 0.5);

    await waitForInsightTip(post.block.hash, post.block.height);

    // Websocket events come over the separate ZMQ rawtx path.
    post.inv = [pre.tx, pre.block.coinbase, post.activation.coinbase, post.tx, post.spend, post.block.coinbase, txMempool];
    for (var n = 0; n < 100 && !post.inv.every(function(txid) {
      return invTxids.indexOf(txid) !== -1;
    }); n++) {
      await sleep(100);
    }
  }

  afterEach(function() {
    if (this.currentTest.state === 'failed') {
      failed = true;
    }
  });

  after(async function() {
    console.log = consoleLog;
    if (failed && datadir) {
      var debugLog = path.join(datadir, 'regtest', 'debug.log');
      if (fs.existsSync(debugLog)) {
        console.error('--- tail of dashd debug.log ---\n' + fs.readFileSync(debugLog, 'utf8').split('\n').slice(-200).join('\n'));
      }
    }
    if (node) {
      await new Promise(function(resolve) {
        node.stop(function() {
          resolve();
        });
      });
    }
    if (dashd && dashd.exitCode === null && dashd.signalCode === null) {
      var exited = new Promise(function(resolve) {
        dashd.once('exit', resolve);
      });
      dashd.kill('SIGTERM');
      await exited;
    }
    if (datadir) {
      fs.rmSync(datadir, {recursive: true, force: true});
    }
  });

  it('dashd activated V24 and switched the coinbase payload from CbTx v3 to v4', async function() {
    var info = await rpc('getdeploymentinfo');
    assert.strictEqual(info.deployments.v24.active, true);
    assert.strictEqual(info.deployments.v24.height, V24_HEIGHT);
    assert.strictEqual(pre.block.cbTxVersion, 3);
    assert.strictEqual((await blockAt(V24_HEIGHT - 1)).cbTxVersion, 3);
    assert.strictEqual(post.activation.cbTxVersion, 4);
    assert.strictEqual(post.block.cbTxVersion, 4);
  });

  it('GET /block/:hash before and after activation', async function() {
    var blocks = [
      [pre.block, [pre.tx]],
      [post.activation, []],
      [post.block, [post.tx, post.spend]]
    ];
    for (var i = 0; i < blocks.length; i++) {
      var expected = blocks[i][0];
      var block = await api('/block/' + expected.hash);
      assert.strictEqual(block.hash, expected.hash);
      assert.strictEqual(block.height, expected.height);
      assert.strictEqual(block.tx[0], expected.coinbase);
      blocks[i][1].forEach(function(txid) {
        assert.ok(block.tx.indexOf(txid) !== -1, txid + ' in block ' + expected.height);
      });
    }
  });

  it('GET /blocks lists blocks from both sides of the activation', async function() {
    var dates = [pre.block, post.block].map(function(b) {
      return utcDate(b.time);
    }).filter(function(date, i, all) {
      return all.indexOf(date) === i;
    });
    var listed = [];
    for (var i = 0; i < dates.length; i++) {
      listed = listed.concat((await api('/blocks?limit=200&blockDate=' + dates[i])).blocks);
    }
    var res = {blocks: listed};
    var heights = res.blocks.map(function(b) {
      return b.height;
    });
    [pre.block.height, V24_HEIGHT - 1, V24_HEIGHT, post.block.height].forEach(function(height) {
      assert.ok(heights.indexOf(height) !== -1, 'height ' + height + ' listed');
    });
    var summary = res.blocks.find(function(b) {
      return b.height === post.block.height;
    });
    assert.strictEqual(summary.hash, post.block.hash);
    assert.strictEqual(summary.txlength, 3);
  });

  it('GET /block-index/:height, /rawblock/:hash and /block-headers across the boundary', async function() {
    assert.strictEqual((await api('/block-index/' + V24_HEIGHT)).blockHash, post.activation.hash);
    var raw = await api('/rawblock/' + post.activation.hash);
    assert.strictEqual(raw.rawblock, await rpc('getblock', post.activation.hash, 0));
    var headers = await api('/block-headers/' + pre.block.hash + '/50');
    var hashes = headers.headers.map(function(h) {
      return h.hash;
    });
    assert.ok(hashes.indexOf(post.activation.hash) !== -1);
  });

  it('GET /tx/:txid shows the CbTx v3 and v4 coinbases', async function() {
    var cbPre = await api('/tx/' + pre.block.coinbase);
    assert.strictEqual(cbPre.type, 5);
    assert.strictEqual(cbPre.cbTx.version, 3);
    assert.strictEqual(cbPre.blockheight, pre.block.height);
    var cbPost = await api('/tx/' + post.block.coinbase);
    assert.strictEqual(cbPost.type, 5);
    assert.strictEqual(cbPost.cbTx.version, 4);
    assert.strictEqual(cbPost.blockheight, post.block.height);
    assert.ok(cbPost.isCoinBase);
  });

  it('GET /tx/:txid shows spends across the boundary', async function() {
    var preTx = await api('/tx/' + pre.tx);
    assert.strictEqual(preTx.blockheight, pre.block.height);
    var outA = voutTo(preTx, addrA)[0];
    assert.strictEqual(outA.value, '1.50000000');
    assert.strictEqual(outA.spentTxId, post.spend);
    assert.strictEqual(outA.spentHeight, post.block.height);

    var spend = await api('/tx/' + post.spend);
    assert.strictEqual(spend.blockheight, post.block.height);
    assert.strictEqual(spend.vin[0].txid, pre.tx);
    assert.strictEqual(spend.vin[0].addr, addrA);
    assert.strictEqual(spend.fees, 0.0001);
  });

  it('GET /txs?block= lists a post-activation block', async function() {
    var res = await api('/txs?block=' + post.block.hash);
    var txids = res.txs.map(function(tx) {
      return tx.txid;
    });
    assert.deepStrictEqual(txids.slice().sort(), [post.block.coinbase, post.tx, post.spend].sort());
  });

  it('GET /addr/:addr reports history and balances from both sides', async function() {
    var a = await api('/addr/' + addrA);
    assert.strictEqual(a.totalReceived, 3.75);
    assert.strictEqual(a.totalSent, 1.5);
    assert.strictEqual(a.balance, 2.25);
    assert.strictEqual(a.unconfirmedBalance, 0.5);
    assert.strictEqual(a.txAppearances, 3);
    assert.strictEqual(a.unconfirmedAppearances, 1);
    assert.deepStrictEqual(a.transactions.slice().sort(), [pre.tx, post.tx, post.spend, txMempool].sort());

    var b = await api('/addr/' + addrB);
    assert.strictEqual(b.balance, 1.4999);
    assert.strictEqual(b.txAppearances, 1);
  });

  it('GET /addr/:addr/utxo returns the unspent outputs', async function() {
    var utxos = await api('/addr/' + addrA + '/utxo');
    var byTx = {};
    utxos.forEach(function(u) {
      byTx[u.txid] = u;
    });
    assert.strictEqual(utxos.length, 2);
    assert.strictEqual(byTx[post.tx].height, post.block.height);
    assert.strictEqual(byTx[post.tx].amount, 2.25);
    assert.strictEqual(byTx[txMempool].amount, 0.5);
    assert.ok(!byTx[pre.tx], 'spent pre-activation output is not listed');
  });

  it('GET /addrs/:addrs/txs pages history for several addresses', async function() {
    var res = await api('/addrs/' + addrA + ',' + addrB + '/txs');
    assert.strictEqual(res.totalItems, 4);
  });

  it('GET /status and /sync report the post-activation tip', async function() {
    var status = await api('/status');
    assert.strictEqual(status.info.blocks, post.block.height);
    assert.strictEqual(status.info.version, (await rpc('getnetworkinfo')).version);
    assert.strictEqual((await api('/status?q=getBestBlockHash')).bestblockhash, post.block.hash);
    var sync = await api('/sync');
    assert.strictEqual(sync.status, 'finished');
    assert.strictEqual(sync.height, post.block.height);
  });

  it('GET /rawtx/:txid returns Core\'s bytes for the CbTx v4 coinbase and a spend', async function() {
    var txids = [post.block.coinbase, post.spend];
    for (var i = 0; i < txids.length; i++) {
      var raw = await api('/rawtx/' + txids[i]);
      assert.strictEqual(raw.rawtx, await rpc('getrawtransaction', txids[i], false));
    }
  });

  it('pushes post-activation transactions to websocket subscribers without parse errors', function() {
    post.inv.forEach(function(txid) {
      assert.ok(invTxids.indexOf(txid) !== -1, txid + ' pushed');
    });
    assert.deepStrictEqual(badTxLogs, []);
  });

  it('other Core-backed endpoints still answer on v24', async function() {
    var routes = [
      '/status?q=getDifficulty',
      '/peer',
      '/version',
      '/sporks',
      '/gobject/info',
      '/gobject/count',
      '/gobject/list',
      '/governance/budget/' + post.block.height
    ];
    for (var i = 0; i < routes.length; i++) {
      await api(routes[i]);
    }
  });
});
