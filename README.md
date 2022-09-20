# Insight-API

[![Build Status](https://github.com/dashevo/insight-api/actions/workflows/test_and_release.yml/badge.svg)](https://github.com/dashevo/insight-api/actions/workflows/test_and_release.yml)
[![NPM version](https://img.shields.io/npm/v/@dashevo/insight-api.svg)](https://npmjs.org/package/@dashevo/insight-api)
[![API stability](https://img.shields.io/badge/stability-stable-green.svg)](https://nodejs.org/api/documentation.html#documentation_stability_index)

A Dash blockchain REST and WebSocket API Service

This is a backend-only service. If you're looking for the web frontend application, take a look at https://github.com/dashevo/insight-ui.

## Table of Content
- [Install](#install)
    - [Prerequisites](#prerequisites)
    - [Query Rate Limit](#query-rate-limit)
- [Usage](#usage)
- [API HTTP Endpoints](#api-http-endpoints)
    - [Block](#block)
    - [Block Index](#block-index)
    - [Raw Block](#raw-block)
    - [Block Summaries](#block-summaries)
    - [Transaction](#transaction)
    - [Address](#address)
    - [Address Properties](#address-properties)
    - [Unspent Outputs](#unspent-outputs)
    - [Unspent Outputs for Multiple Addresses](#unspent-outputs-for-multiple-addresses)
    - [InstantSend Transactions](#instantsend-transactions)
    - [Transactions by Block](#transactions-by-block)
    - [Transactions by Address](#transactions-by-address)
    - [Transactions for Multiple Addresses](#transactions-for-multiple-addresses)
    - [Transaction Broadcasting](#transaction-broadcasting)
    - [Sporks List](#sporks-list)
    - [Proposals Informations](#proposals-informations)
    - [Proposals Count](#proposals-count)
    - [Budget Proposal List](#budget-proposal-list)
    - [Budget Triggers List](#budget-triggers-list)
    - [Budget Proposal Detail](#budget-proposal-detail)
    - [Proposal Check](#proposal-check)
    - [Proposal Deserialization](#proposal-deserialization)
    - [Proposal Current Votes](#proposal-current-votes)
    - [Governance Budget](#governance-budget)
    - [Masternodes List](#masternodes-list)
    - [Historic Blockchain Data Sync Status](#historic-blockchain-data-sync-status)
    - [Live Network P2P Data Sync Status](#live-network-p2p-data-sync-status)
    - [Status of the Dash Network](#status-of-the-dash-network)
    - [Utility Methods](#utility-methods)
- [Web Socket Api](#web-socket-api)
    - [Example Usage](#example-usage)
- [Notes on Upgrading from v0.3](#notes-on-upgrading-from-v03)
- [Notes on Upgrading from v0.2](#notes-on-upgrading-from-v02)
- [Resources](#resources)
- [License](#license)

## Install

```bash
npm install -g @dashevo/dashcore-node
dashcore-node create mynode
cd mynode
dashcore-node install @dashevo/insight-api
dashcore-node start  # to also start the service
```

The API endpoints will be available by default at: `http://localhost:3001/insight-api/`

### Prerequisites

- [Dashcore Node Dash 6.x](https://github.com/dashevo/dashcore-node)

**Note:** You can use an existing Dash data directory, however `txindex`, `addressindex`, `timestampindex` and `spentindex` need to be enabled in `dash.conf`, as well as a few other additional fields.

### Query Rate Limit

To protect the server, insight-api has a built-in query rate limiter. It can be configurable in `dashcore-node.json` with:

```json /*eslint-disable */

"servicesConfig": {
  "insight-api": {
    "rateLimiterOptions": {
      "whitelist": ["::ffff:127.0.0.1"]
    }
  }
}
```

With all the configuration options available: https://github.com/dashevo/insight-api/blob/master/lib/ratelimiter.js#L10-17

Or disabled entirely with:

```json /*eslint-disable */
"servicesConfig": {
  "insight-api": {
    "disableRateLimiter": true
  }
}
```

## Usage

Follow the install instructions above, and ...

```bash
dashcore-node start
```

This will start the Insight-API listening on default port 3001.

## API HTTP Endpoints

### Block

```
  /insight-api/block/[:hash]
  /insight-api/block/0000000006e7b38e8ab2d351239019c01de9a148b5baef58cfe52dfd9917cedc
```

### Block Index

Get block hash by height

```
  /insight-api/block-index/[:height]
  /insight-api/block-index/0
```

This would return:

```
{
  "blockHash":"00000bafbc94add76cb75e2ec92894837288a481e5c005f6563d91623bf8bc2c"
}
```

which is the hash of the TestNet Genesis block (0 height)

### Raw Block

```
  /insight-api/rawblock/[:blockHash]
```

This would return:

```
{
  "rawblock":"blockhexstring..."
}
```

### Block Summaries

Get block summaries by date:

```
  /insight-api/blocks?limit=3&blockDate=2017-04-22
```

Example response:

```
{
  "blocks": [
    {
      "height": 188928,
      "size": 312,
      "hash": "00000000ee9a976cf459240c2add1147137ca6126b7906fa13ce3d80b5cadcc7",
      "time": 1492905418,
      "txlength": 1,
      "poolInfo": {
        "poolName": "BTCC Pool",
        "url": "https://pool.btcc.com/"
      }
    },{...},{...}
  ],
  "length": 3,
  "pagination": {
    "next":"2017-04-23",
    "prev":"2017-04-21",
    "currentTs":1492905599,
    "current":"2017-04-22",
    "isToday":false,
    "more":true,
    "moreTs":1492905600
  }
}
```

### Transaction

```
  /insight-api/tx/[:txid]
  /insight-api/tx/ebdca263fe1c75c8609ce8fe3d82a320a0b3ca840f4df995883f5dab1b9ff8d9

  /insight-api/rawtx/[:rawid]
  /insight-api/rawtx/ebdca263fe1c75c8609ce8fe3d82a320a0b3ca840f4df995883f5dab1b9ff8d9
```

### Address

```
  /insight-api/addr/[:addr][?noTxList=1][&from=&to=]
  /insight-api/addr/ybi3gej7Ea1MysEYLR7UMs3rMuLJH5aVsW?noTxList=1
  /insight-api/addr/yPv7h2i8v3dJjfSH4L3x91JSJszjdbsJJA?from=1000&to=2000

  /insight-api/addrs/[:addrs][?noTxList=1][&from=&to=]
  /insight-api/addrs/ygwNQgE5f15Ygopbs2KPRYMS4TcffqBpsz,ygw5yCtVkx3hREke4L8qDqQtnNoAiPKTSx
  /insight-api/addrs/ygwNQgE5f15Ygopbs2KPRYMS4TcffqBpsz,ygw5yCtVkx3hREke4L8qDqQtnNoAiPKTSx?from=1000&to=2000
```

### Address Properties

```
  /insight-api/addr/[:addr]/balance
  /insight-api/addr/[:addr]/totalReceived
  /insight-api/addr/[:addr]/totalSent
  /insight-api/addr/[:addr]/unconfirmedBalance

  /insight-api/addrs/[:addrs]/balance
  /insight-api/addrs/[:addrs]/totalReceived
  /insight-api/addrs/[:addrs]/totalSent
  /insight-api/addrs/[:addrs]/unconfirmedBalance
```

The response contains the value in Satoshis.

### Unspent Outputs

```
  /insight-api/addr/[:addr]/utxo
```

Sample return:

```
[
  {
    "address":"ygwNQgE5f15Ygopbs2KPRYMS4TcffqBpsz",
    "txid":"05d70bc1c4cf1c3afefc3250480d733b5666b19cb1f629901ded82cb2d6263d1",
    "vout":0,
    "scriptPubKey":"76a914e22dc8acf5bb5624f4beef22fb2238f8479e183f88ac",
    "amount":0.01194595,
    "satoshis":1194595,
    "height":142204,
    "confirmations":124317
  },{...}
]
```

### Unspent Outputs for Multiple Addresses

GET method:

```
  /insight-api/addrs/[:addrs]/utxo
  /insight-api/addrs/ygwNQgE5f15Ygopbs2KPRYMS4TcffqBpsz,ygw5yCtVkx3hREke4L8qDqQtnNoAiPKTSx/utxo
```

POST method:

```
  /insight-api/addrs/utxo
```

POST params:

```
addrs: ygwNQgE5f15Ygopbs2KPRYMS4TcffqBpsz,ygw5yCtVkx3hREke4L8qDqQtnNoAiPKTSx
```

### InstantSend Transactions

If a Transaction Lock has been observed by Insight API a 'txlock' value of true will be included in the Transaction Object.

Sample output:

```
{
	"txid": "b7ef92d1dce458276f1189e06bf532eff78f9c504101d3d4c0dfdcd9ebbf3879",
	"version": 1,
	"locktime": 133366,
	"vin": [{ ... }],
	"vout": [{ ... }],
	"blockhash": "0000001ab9a138339fe4505a299525ace8cda3b9bcb258a2e5d93ed7a320bf21",
	"blockheight": 133367,
	"confirmations": 37,
	"time": 1483985187,
	"blocktime": 1483985187,
	"valueOut": 8.998,
	"size": 226,
	"valueIn": 8.999,
	"fees": 0.001,
	"txlock": true
}
```

### Transactions by Block

```
  /insight-api/txs/?block=HASH
  /insight-api/txs/?block=000000000814dd7cf470bd835334ea6624ebf0291ea857a5ab37c65592726375
```

### Transactions by Address

```
  /insight-api/txs/?address=ADDR
  /insight-api/txs/?address=yWFfdp9nLUjy1kJczFhRuBMUjtTkTTiyMv
```

### Transactions for Multiple Addresses

GET method:

```
  /insight-api/addrs/[:addrs]/txs[?from=&to=]
  /insight-api/addrs/ygwNQgE5f15Ygopbs2KPRYMS4TcffqBpsz,ygw5yCtVkx3hREke4L8qDqQtnNoAiPKTSx/txs?from=0&to=20
```

POST method:

```
  /insight-api/addrs/txs
```

POST params:

```
addrs: ygwNQgE5f15Ygopbs2KPRYMS4TcffqBpsz,ygw5yCtVkx3hREke4L8qDqQtnNoAiPKTSx
from (optional): 0
to (optional): 20
noAsm (optional): 1 (will omit script asm from results)
noScriptSig (optional): 1 (will omit the scriptSig from all inputs)
noSpent (option): 1 (will omit spent information per output)
```

Sample output:

```
{ totalItems: 100,
  from: 0,
  to: 20,
  items:
    [ { txid: '3e81723d069b12983b2ef694c9782d32fca26cc978de744acbc32c3d3496e915',
       version: 1,
       locktime: 0,
       vin: [Object],
       vout: [Object],
       blockhash: '00000000011a135e5277f5493c52c66829792392632b8b65429cf07ad3c47a6c',
       confirmations: 109367,
       time: 1393659685,
       blocktime: 1393659685,
       valueOut: 0.3453,
       size: 225,
       firstSeenTs: undefined,
       valueIn: 0.3454,
       fees: 0.0001,
       txlock: false },
      { ... },
      { ... },
      ...
      { ... }
    ]
}
```

Note: if pagination params are not specified, the result is an array of transactions.

### Transaction Broadcasting

#### Standard transaction

POST method:

```
  /insight-api/tx/send
```

POST params:

```
  rawtx: "signed transaction as hex string"

  eg

  rawtx: 01000000017b1eabe0209b1fe794124575ef807057c77ada2138ae4fa8d6c4de0398a14f3f00000000494830450221008949f0cb400094ad2b5eb399d59d01c14d73d8fe6e96df1a7150deb388ab8935022079656090d7f6bac4c9a94e0aad311a4268e082a725f8aeae0573fb12ff866a5f01ffffffff01f0ca052a010000001976a914cbc20a7664f2f69e5355aa427045bc15e7c6c77288ac00000000
```

POST response:

```
  {
      txid: [:txid]
  }

  eg

  {
      txid: "c7736a0a0046d5a8cc61c8c3c2821d4d7517f5de2bc66a966011aaa79965ffba"
  }
```

#### InstantSend transaction

Conditions :
* Every inputs should have 6 confirmations.
* Fee are 0.001 per input.
* Transaction value should be below SPORK_5_INSTANTSEND_MAX_VALUE (see spork route)

POST method:

```
  /insight-api/tx/sendix
```

POST params:

```
  rawtx: "signed transaction as hex string"
```

POST response:

```
  {
      txid: [:txid]
  }
```

### Sporks List

GET method:

```
  /insight-api/sporks
```

Sample output:

```
{
  "sporks": {
    "SPORK_2_INSTANTSEND_ENABLED":0,
    "SPORK_3_INSTANTSEND_BLOCK_FILTERING":0,
    "SPORK_5_INSTANTSEND_MAX_VALUE":2000,
    "SPORK_8_MASTERNODE_PAYMENT_ENFORCEMENT":0,
    "SPORK_9_SUPERBLOCKS_ENABLED":0,
    "SPORK_10_MASTERNODE_PAY_UPDATED_NODES":0,
    "SPORK_12_RECONSIDER_BLOCKS":0,
    "SPORK_13_OLD_SUPERBLOCK_FLAG":4070908800,
    "SPORK_14_REQUIRE_SENTINEL_FLAG":4070908800
  }
}
```

### Proposals Informations

GET method:

```
  /insight-api/gobject/info
```

Sample output:

```
{
  "result":{
    "governanceminquorum":1,
    "masternodewatchdogmaxseconds":7200,
    "proposalfee":5,
    "superblockcycle":24,
    "lastsuperblock":79800,
    "nextsuperblock":79824,
    "maxgovobjdatasize":16384
  },
  "error":null,
  "id":68537
}
```

### Proposals Count

GET method:

```
  /insight-api/gobject/count
```

Sample output:

```
{
  "result":"Governance Objects: 47 (Proposals: 7, Triggers: 40, Watchdogs: 0/0, Other: 0; Erased: 0), Votes: 1883",
  "error":null,
  "id":47025
}
```

### Budget Proposal List

GET method:

```
  /insight-api/gobject/list/proposal (or /insight-api/gobject/list)
```

Sample output:

```
[
  {
    Hash: 'b6af3e70c686f660541a77bc035df2e5e46841020699ce3ec8fad786f7d1aa35',
    DataObject: {
      end_epoch: 1513555200,
      name: 'flare03',
      payment_address: 'yViyoK3NwfH5GXRo7e4DEYkzzhBjDNQaQG',
      payment_amount: 5,
      start_epoch: 1482105600,
      type: 1,
      url: 'https://www.dash.org'
    },
    AbsoluteYesCount: 40,
    YesCount: 40,
    NoCount: 0,
    AbstainCount: 0
  }
]
```

### Budget Triggers List

GET method:

```
  /insight-api/gobject/list/trigger
```

Sample output:

```
[
  {
    "Hash":"fa2a7505c52438b2ca3d14def1c2cdcb59d7ccca417920182f04fcb9be968f00",
    "DataObject":{"type":2},
    "AbsoluteYesCount":53,
    "YesCount":53,
    "NoCount":0,
    "AbstainCount":0
  }
]
```

### Budget Proposal Detail

GET method:

```
  /insight-api/gobject/get/[:hash]
  /insight-api/gobject/get/b6af3e70c686f660541a77bc035df2e5e46841020699ce3ec8fad786f7d1aa35
```

Sample output:

```
    [ { Hash: 'b6af3e70c686f660541a77bc035df2e5e46841020699ce3ec8fad786f7d1aa35',
        CollateralHash: '24a71d8f221659717560365d2914bc7a00f82ffb8f8c68e7fffce5f35aa23b90',
       	DataHex: '5b5b2270726f706f73616c222c7b22656e645f65706f6368223a313531333535353230302c226e616d65223a22666c6172653033222c227061796d656e745f61646472657373223a22795669796f4b334e776648354758526f3765344445596b7a7a68426a444e51615147222c227061796d656e745f616d6f756e74223a352c2273746172745f65706f6368223a313438323130353630302c2274797065223a312c2275726c223a2268747470733a2f2f64617368646f742e696f2f702f666c6172653033227d5d5d',
        DataObject: {
          end_epoch: 1513555200,
          name: 'flare03',
          payment_address: 'yViyoK3NwfH5GXRo7e4DEYkzzhBjDNQaQG',
          payment_amount: 5,
          start_epoch: 1482105600,
          type: 1,
          url: 'https://www.dash.org'
        },
        CreationTime: 1482223714,
        FundingResult: {
            AbsoluteYesCount: 40,
            YesCount: 40,
            NoCount: 0,
            AbstainCount: 0
        },
        ValidResult: {
            AbsoluteYesCount: 74,
            YesCount: 74,
            NoCount: 0,
            AbstainCount: 0
        },
        DeleteResult: {
            AbsoluteYesCount: 0,
            YesCount: 0,
            NoCount: 0,
            AbstainCount: 0
        },
        EndorsedResult: {
            AbsoluteYesCount: 0,
            YesCount: 0,
            NoCount: 0,
            AbstainCount: 0
        } } ]
```

### Proposal Check

GET method:

```
  /insight-api/gobject/check/[:hexData]
  /insight-api/gobject/check/5b5b2270726f706f736[..]
```

Sample output:

```
    {"Object status":"OK"}
```

### Proposal Deserialization

GET method:

```
  /insight-api/gobject/deserialize/[:hexData]
  /insight-api/gobject/deserialize/5b5b2270726f706f736[..]
```

Sample output:

```
{
  "result":"[[\"proposal\",{\"end_epoch\":1519848619,\"name\":\"ghijklmnopqrstuvwxyz01234567891519097947\",\"payment_address\":\"yik5HAgVAgjH1oZKjcDfvcf22bwBNbSYzB\",\"payment_amount\":10,\"start_epoch\":1519097947,\"type\":1,\"url\":\"https://www.dashcentral.org/p/test_proposal_1519097947\"}]]",
  "error":null,
  "id":78637
}
```

### Proposal Current Votes

GET method:

```
  /insight-api/gobject/votes/current/[:hash]
  /insight-api/gobject/votes/current/fbda8cdc1f48917f53b7d63fbce81c85d6dedd3d0e476e979926dfd154b84034
```

Sample output:

```
{
  "result":"[[\"proposal\",{\"end_epoch\":1519848619,\"name\":\"ghijklmnopqrstuvwxyz01234567891519097947\",\"payment_address\":\"yik5HAgVAgjH1oZKjcDfvcf22bwBNbSYzB\",\"payment_amount\":10,\"start_epoch\":1519097947,\"type\":1,\"url\":\"https://www.dashcentral.org/p/test_proposal_1519097947\"}]]",
  "error":null,
  "id":78637
}
```

### Governance Budget

GET method:

```
  /insight-api/governance/budget/[:blockIndex]
  /insight-api/governance/budget/79872
```

Sample output:

```
{
    "result":"60.00",
    "error":null,
    "id":75619
}
```

### Submit Proposal

POST method:

```
  /insight-api/gobject/submit
```

Example input:

```
{
  "parentHash":"abc",
  "revision":1,
  "time":10009,
  "dataHex":"abc",
  "feeTxId":"abc"
}
```

Sample output:

```
{
    "result":"60.00",
    "error":null,
    "id":75619
}
```

### Masternodes List

```
  deprecated until full support for v0.13 deterministic masternode list
```

### Validate Masternode

```
  deprecated until full support for v0.13 deterministic masternode list
```

### Historic Blockchain Data Sync Status

```
  /insight-api/sync
```

### Live Network P2P Data Sync Status

```
  /insight-api/peer
```

### Status of the Dash Network

```
  /insight-api/status?q=xxx
```

Where "xxx" can be:

 * getInfo
 * getDifficulty
 * getBestBlockHash
 * getBestChainLock
 * getLastBlockHash

### Utility Methods

```
  /insight-api/utils/estimatefee[?nbBlocks=2]
```

## Web Socket API

The web socket API is served using [socket.io](http://socket.io).

The following are the events published by Insight:

`tx`: new transaction received from network, txlock boolean is set true if a matching txlock event has been observed. This event is published in the 'inv' room. Data will be a app/models/Transaction object.

Sample output:

```
{
  "txid":"00c1b1acb310b87085c7deaaeba478cef5dc9519fab87a4d943ecbb39bd5b053",
  "txlock": false,
  "processed":false
  ...
}
```

`txlock`: InstantSend transaction received from network, this event is published alongside the 'tx' event when a transaction lock event occurs. Data will be a app/models/Transaction object.
Sample output:

```
{
  "txid":"00c1b1acb310b87085c7deaaeba478cef5dc9519fab87a4d943ecbb39bd5b053",
  "processed":false
  ...
}
```

`block`: new block received from network. This event is published in the `inv` room. Data will be a app/models/Block object.
Sample output:

```
{
  "hash":"000000004a3d187c430cd6a5e988aca3b19e1f1d1727a50dead6c8ac26899b96",
  "time":1389789343,
  ...
}
```

`<dashAddress>`: new transaction concerning <dashAddress> received from network. This event is published in the `<dashAddress>` room.

`status`: every 1% increment on the sync task, this event will be triggered. This event is published in the `sync` room.

Sample output:

```
{
  blocksToSync: 164141,
  syncedBlocks: 475,
  upToExisting: true,
  scanningBackward: true,
  isEndGenesis: true,
  end: "000000000933ea01ad0ee984209779baaec3ced90fa3f408719526f8d77f4943",
  isStartGenesis: false,
  start: "000000009f929800556a8f3cfdbe57c187f2f679e351b12f7011bfc276c41b6d"
}
```

### Example Usage

The following html page connects to the socket.io insight API and listens for new transactions.

```html
<html>
<body>
  <script src="http://<insight-server>:<port>/socket.io/socket.io.js"></script>
  <script>
    eventToListenTo = 'tx'
    room = 'inv'

    var socket = io("http://<insight-server>:<port>/");
    socket.on('connect', function() {
      // Join the room.
      socket.emit('subscribe', room);
    })
    socket.on(eventToListenTo, function(data) {
      if (data.txlock) {
        console.log("New InstantSend transaction received: " + data.txid)
      } else {
        console.log("New transaction received: " + data.txid)
      }
    })
  </script>
</body>
</html>
```

## Notes on Upgrading from v0.3

The unspent outputs format now has `satoshis` and `height`:

```
[
  {
    "address":"mo9ncXisMeAoXwqcV5EWuyncbmCcQN4rVs",
    "txid":"d5f8a96faccf79d4c087fa217627bb1120e83f8ea1a7d84b1de4277ead9bbac1",
    "vout":0,
    "scriptPubKey":"76a91453c0307d6851aa0ce7825ba883c6bd9ad242b48688ac",
    "amount":0.000006,
    "satoshis":600,
    "confirmations":0,
    "ts":1461349425
  },
  {
    "address": "mo9ncXisMeAoXwqcV5EWuyncbmCcQN4rVs",
    "txid": "bc9df3b92120feaee4edc80963d8ed59d6a78ea0defef3ec3cb374f2015bfc6e",
    "vout": 1,
    "scriptPubKey": "76a91453c0307d6851aa0ce7825ba883c6bd9ad242b48688ac",
    "amount": 0.12345678,
    "satoshis: 12345678,
    "confirmations": 1,
    "height": 300001
  }
]
```

The `timestamp` property will only be set for unconfirmed transactions and `height` can be used for determining block order. The `confirmationsFromCache` is nolonger set or necessary, confirmation count is only cached for the time between blocks.

There is a new `GET` endpoint or raw blocks at `/rawblock/<blockHash>`:

Response format:

```
{
  "rawblock": "blockhexstring..."
}
```

There are a few changes to the `GET` endpoint for `/addr/[:address]`:

- The list of txids in an address summary does not include orphaned transactions
- The txids will be sorted in block order
- The list of txids will be limited at 1000 txids
- There are two new query options "from" and "to" for pagination of the txids (e.g. `/addr/[:address]?from=1000&to=2000`)

Some additional general notes:
- The transaction history for an address will be sorted in block order
- The response for the `/sync` endpoint does not include `startTs` and `endTs` as the sync is no longer relevant as indexes are built in dashd.
- The endpoint for `/peer` is no longer relevant connection to dashd is via ZMQ.
- `/tx` endpoint results will now include block height, and spentTx related fields will be set to `null` if unspent.
- `/block` endpoint results does not include `confirmations` and will include `poolInfo`.

## Notes on Upgrading from v0.2

Some of the fields and methods are not supported:

The `/tx/<txid>` endpoint JSON response will not include the following fields on the "vin"
object:
- `doubleSpentTxId` // double spends are not currently tracked
- `isConfirmed` // confirmation of the previous output
- `confirmations` // confirmations of the previous output
- `unconfirmedInput`

The `/tx/<txid>` endpoint JSON response will not include the following fields on the "vout"
object.
- `spentTs`

The `/status?q=getTxOutSetInfo` method has also been removed due to the query being very slow and locking dashd.

Plug-in support for Insight API is also no longer available, as well as the endpoints:
- `/email/retrieve`
- `/rates/:code`

Caching support has not yet been added in the v0.3 upgrade.

## Resources

- (Medium)[How to setup a Dash Instant-Send Transaction using Insight API - The comprehensive way](https://medium.com/@obusco/setup-instant-send-transaction-the-comprehensive-way-a80a8a0572e)

## Contributing

Feel free to dive in! [Open an issue](https://github.com/dashevo/insight-api/issues/new) or submit PRs.

## License

[MIT](LICENSE) &copy; Dash Core Group, Inc.
