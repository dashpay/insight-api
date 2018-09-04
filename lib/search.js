'use strict';

var request = require('request');

var Common = require('./common');

function SearchController(node) {
  this.node = node;
  this.common = new Common({log: this.node.log});
  this.searchTypeArray = [
    {factory: 'Block', object: 'blockHash', path: 'block/'}, 
    {factory: 'Transaction', object:'txId', path: 'tx/'}, 
    {factory: 'Address', object: 'addrStr', path: 'address/'}, 
    {factory: 'BlockByHeight', object: 'blockHeight', path: 'block/'}
  ];
}

SearchController.prototype.swap = function(theArray, indexA, indexB) {
    var temp = theArray[indexA];
    theArray[indexA] = theArray[indexB];
    theArray[indexB] = temp;
};

SearchController.prototype.defineSearchType = function(searchString) {
  var self = this;
  var searchTypeArray = self.searchTypeArray.slice();
  if (searchString.length == 64) {
    if(!searchString.match(/^00/))
    {
      self.swap(searchTypeArray, 0, 1);
    }
  } else if (searchString.length == 38 || searchString.length === 34) {
    self.swap(searchTypeArray, 0, 2);
  }
  if (isFinite(searchString)) {
    self.swap(searchTypeArray, 0, 3);
  }
  return searchTypeArray;
}

SearchController.prototype.index = function(req, res) {
  var self = this;
  var searchTypeArray = false; 
  if (typeof req.params != "undefined") {
    if (typeof req.params.searchstr != "undefined") {
      searchTypeArray = self.defineSearchType(req.params.searchstr);
    }
  }
  if (!searchTypeArray) {
    searchTypeArray = self.searchTypeArray.slice();
  }
  res.jsonp({
    status: 200,
    data: searchTypeArray
  });
};

module.exports = SearchController;
