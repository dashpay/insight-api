'use strict';

var sinon = require('sinon');
var should = require('should');
var MasternodesController = require('../lib/masternodes');

/*
describe('Masternode', function() {
	describe('/masternodes/list', function () {
		var MNList = [{
			"vin": "f31bd0fcb34317a3db0dbf607c899d022c9e8a9d712c94c87bac953caafcf1a2-1",
			"status": "ENABLED",
			"rank": 1,
			"ip": "52.202.12.210:9999",
			"protocol": 70206,
			"payee": "Xjd6yGfWcsuDcHdECCwn3XUScLb3q3ChJK",
			"activeseconds": 14556663,
			"lastseen": 1502078628
		}, {
			"vin": "c097539c6d03e45d8933b92d7cd702c6906b74f16860ddaedb33107e940fea27-0",
			"status": "ENABLED",
			"rank": 2,
			"ip": "37.59.247.180:9999",
			"protocol": 70206,
			"payee": "Xk8LPywDnggrAQaVWTkLk1JMabs1ZRLWT5",
			"activeseconds": 312936,
			"lastseen": 1502078652
		}, {
			"vin": "f1de44e05cfc54ef70b6f2769f3ef9289c858ea7f0356012836ec9d0581f5ea3-1",
			"status": "ENABLED",
			"rank": 3,
			"ip": "45.76.178.221:9999",
			"protocol": 70206,
			"payee": "XpwGvnRwjbMmT1hyA6nS5NesdJk4d4bE3y",
			"activeseconds": 3714536,
			"lastseen": 1502078813
		}, {
			"vin": "2326359e1e0fed73063f0330d0d5d32d70ddfb427e7135fc3d678be49ac9022b-1",
			"status": "ENABLED",
			"rank": 4,
			"ip": "46.101.153.25:9999",
			"protocol": 70206,
			"payee": "XyxESWr2mPz5JQmrX5w1TQBRLMgM5MoE1K",
			"activeseconds": 12092763,
			"lastseen": 1502078485
		}, {
			"vin": "1297deb0f9cbd1443114ac15cb2fe42a69a182de9ebdf2b109114f61d2283798-1",
			"status": "ENABLED",
			"rank": 5,
			"ip": "178.62.218.126:9999",
			"protocol": 70206,
			"payee": "Xog5c8MG6Qneu1hZfLuUwjWqaWjD6Fbrdk",
			"activeseconds": 11796620,
			"lastseen": 1502078972
		}];
		var node = {
			services: {
        dashd: {
					getMNList: sinon.stub().callsArgWith(0, null, MNList)
				}
			}
		};

		var masternodes = new MasternodesController(node);

		it('getList', function (done) {
			var req = {};
			var res = {
				jsonp: function (data) {
					data.length.should.equal(5);
					should.exist(data[0].vin);
					should.exist(data[0].status);
					should.exist(data[0].rank);
					should.exist(data[0].ip);
					should.exist(data[0].protocol);
					should.exist(data[0].payee);
					should.exist(data[0].activeseconds);
					should.exist(data[0].lastseen);
					done();
				}
			};

			masternodes.list(req, res);
		});
	});
});
*/
