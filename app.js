#!/usr/bin/env node

var express = require('express');
var ejs = require('ejs');
var fs = require('fs');
var crawlstream = require('crawlstream');
var phantom = require('phantom');
var _ = require('underscore');
var util = require('util');

var home = 'http://www.in.gr';
var imageDir = __dirname + '/images';

var maxCrawlWorkers = 1;

var urlDb = [];
var urlsToDo = [];
var urlsInProgress = [];
var urlsComplete = [];

var initApp = function () {
	var app = express();

	app.use("/images", express.static(imageDir));

	app.get('/', function(req, res) {
		if (req.query.url) {
			home = req.query.url;
			initCrawl();
		}
		res.render('index.ejs');
	});

	app.get('/status', function(req, res) {
		res.send(
			util.format(
				'urlsToDo: %d, urlsInProgress: %d, urlsComplete: %d',
				urlsToDo.length,
				urlsInProgress.length,
				urlsComplete.length
			)
		);
	});

	// show the last image
	app.get('/status/image', function(req, res) {
		var response = '';
		if (urlsComplete.length > 0) {
			var url = _.last(urlsComplete);
			response = { url: url, path: urlToImagePath(urlsComplete.length, url) };
		}
		res.send(JSON.stringify(response));
	});
 
	app.listen(3000);
}

initApp();

var getNextPage = function () {
	var nextPage = null;

	// stop if busy
	if (urlsInProgress.length >= maxCrawlWorkers) {
		return nextPage;
	}

	// nothing to do
	if (urlsToDo.length == 0) {
		return nextPage;
	}

	nextPage = urlsToDo.shift();
	urlsInProgress.push(nextPage);

	console.log('selected', nextPage);

	return nextPage;
}

var createNextPage = function () {
	var url = getNextPage();
	if (null === url) {
		return;
	}
	
	// spawn a worker
	phantom.create(function(ph) {
		ph.createPage(function (page) {
			page.open(url, function (status) {
				var fileId = urlsComplete.length + 1;
				imagePath = imageDir + '/' + urlToImagePath(fileId, url);
				page.render(imagePath);
				console.log('created', imagePath, 'for', url);
				urlsInProgress = _.difference(urlsInProgress, [url]);
				urlsComplete.push(url);
				return ph.exit();
			});
		});	
	});
	process.nextTick(createNextPage);
}

var urlToImagePath = function (fileId, url) {
	var filename = url
		.replace(/\/$/, '') // trim trailing slashes
		.replace(/http(s)?\:\/\//ig, '') // trim protocol
		.replace(/[\/\\]+/ig, '-') // turn slashes into dashes
		.replace(/[^a-z\-\.0-9]+/ig, '.'); // replace fs unsafe chars with dots
	var imagePath = fileId + '-' + filename +'.png';
	return imagePath;
}


var initCrawl = function () {
	setInterval(function() { process.nextTick(createNextPage); }, 300);

	console.log('home:', home);

	crawlstream(home, 2)
		.on('data', function(req) {
			var url = req.uri.protocol + '//' + req.uri.hostname + req.uri.path;

			if (urlDb.indexOf(url) === -1) {
				urlDb.push(url);
				urlsToDo.push(url);
			}
		});
}