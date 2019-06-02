'use strict';

var Common = require('./common');
var dashcore = require('@dashevo/dashcore-lib');
var _ = dashcore.deps._;
var deprecatedMessage = 'This endpoint has been deprecated and will be replaced with a new endpoint compatible with the deterministic masternode lis introduced in v0.13';

function MasternodeController(node) {
	this.node = node;
	this.common = new Common({log: this.node.log});
}

MasternodeController.prototype.list = function(req, res) {
	var self = this;
	res.jsonp(deprecatedMessage);
	/*
	this.getMNList(function(err, result) {
		if (err) {
			return self.common.handleErrors(err, res);
		}
		res.jsonp(result);
	});
	*/
};

MasternodeController.prototype.validate = function (req, res, next) {
	var payeeAddr = req.params.payee;
	//We first validate that the payee address is valid
	var self = this;
	res.jsonp(deprecatedMessage);
	/*
	if(!payeeAddr || payeeAddr.length!=34 ) {
			return self.common.handleErrors({
					message: 'Must include a valid format address',
					code: 1
			}, res);
	}

	try {
		var a = new dashcore.Address(payeeAddr);
	} catch(e) {
		return self.common.handleErrors({
			message: 'Invalid address: ' + e.message,
			code: 1
		}, res);
	}


	//After having valide addr, we get the MNList
	this.getMNList(function(err, mnList){
		if(err){
			return self.common.handleErrors(err, res);
		}

		var filteredMnList = mnList.filter(function(elem){
			return elem.payee === payeeAddr;
		});

		if(!filteredMnList || !filteredMnList[0]){
			return res.jsonp({valid:false, payee:payeeAddr});
		}
		var mn = filteredMnList[0];
		mn.valid = false;

		if(!mn.hasOwnProperty('payee') ||
			mn.hasOwnProperty('vin')){
			var vin = mn.vin.split('-');
			var txid = vin[0];
			var voutindex = vin[1];

			self.node.getDetailedTransaction(txid, function(err, transaction) {
					if (err && err.code === -5) {
							return self.common.handleErrors(null, res);
					} else if(err) {
							return self.common.handleErrors(err, res);
					}
					if(transaction.outputs && transaction.outputs[voutindex]){
						var txvout = transaction.outputs[voutindex]
						if(txvout.satoshis===100000000000 &&
							txvout.spentTxId===undefined &&
							txvout.spentHeight===undefined &&
							txvout.spentIndex===undefined){
								mn.valid = true;
								res.jsonp(mn)
						}else{
								res.jsonp(mn)
						}
					}
			});
		}
	})
	*/
};

MasternodeController.prototype.getMNList = function(callback) {
	this.node.services.dashd.getMNList(function(err, result){
		var MNList = result || [];
		if (err) {
			return callback(err);
		}
		callback(null,MNList);
	});
};

module.exports = MasternodeController;
