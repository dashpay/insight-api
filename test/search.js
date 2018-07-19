'use strict';

var sinon = require('sinon');
var should = require('should');
var SearchController = require('../lib/search');

describe('Search', function() {
  describe('/search', function() {
    it('should have correct data', function(done) {
      var node = {};
      var expected = {
        "status": 200,
        "data": [
          {
            "factory": "Block",
            "object": "blockHash",
            "path": "block/"
          },
          {
            "factory": "Transaction",
            "object": "txId",
            "path": "tx/"
          },
          {
            "factory": "Address",
            "object": "addrStr",
            "path": "address/"
          },
          {
            "factory": "BlockByHeight",
            "object": "blockHeight",
            "path": "block/"
          }
        ]
      };
      
      var req = {};
      var res = {
        jsonp: function(data) {
          should(data).eql(expected);
          done();
        }
      };

      var search = new SearchController(node);
      search.index(req, res);
    });
  });
  
  describe('/search/:searchstr route', function() {
    it('should have correct data', function(done) {
      var node = {};
      var expected = {
        "status": 200,
        "data": [
          {
            "factory": "Address",
            "object": "addrStr",
            "path": "address/"
          },
          {
            "factory": "Transaction",
            "object": "txId",
            "path": "tx/"
          },
          {
            "factory": "Block",
            "object": "blockHash",
            "path": "block/"
          },
          {
            "factory": "BlockByHeight",
            "object": "blockHeight",
            "path": "block/"
          }
        ]
      };
      var address = 'XcDnXVu7p7mTxuPrNFemcqvi9E1cu1xff4';
      var req = {
        params: {
          searchstr: address
        }
      };
      var res = {
        jsonp: function(data) {
          should(data).eql(expected);
          done();
        }
      };

      var search = new SearchController(node);
      search.index(req, res);
    });
  });
});
