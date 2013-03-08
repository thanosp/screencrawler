var crawlstream = require('crawlstream');
var phantom = require('phantom');
var em = require('events').EventEmitter;
var _ = require('underscore');

var home = 'http://www.in.gr';
var imageDir = './images';

var urlDb = [];
var urlsToDo = [];
var urlsInProgress = [];
var urlsComplete = [];

var getNextPage = function () {
	var nextPage = null;

	// stop if busy
	if (urlsInProgress.length > 0) {
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
				var imagePath = imageDir + '/' + (_.size(urlsComplete) + 1) + '.png';
				page.render(imagePath);
				console.log('created', imagePath, 'for', url);
				urlsInProgress = _.difference(urlsInProgress, [url]);
				urlsComplete.push(url);
				return ph.exit();
			});
		});	
	});
	process.nextTick(createNextPage);
};

setInterval(function() { process.nextTick(createNextPage); }, 300);

crawlstream(home, 2)
	.on('data', function(req) {
		var url = req.uri.protocol + '//' + req.uri.hostname + req.uri.path;

		if (urlDb.indexOf(url) === -1) {
			urlDb.push(url);
			urlsToDo.push(url);
		}
	});