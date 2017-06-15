var mongoose = require('mongoose');
var cheerio = require('cheerio');
var http = require('http');
var urljoin = require('url-join');
var Manga = require('./manga');

mongoose.connect('mongodb://localhost/mangareaderbot');

function MangaPanda() {
	var base_url = "http://www.mangapanda.com"
	var path_url = "/alphabetical";
	http.get(base_url+path_url, (res) => {
		var html;
		res.on('data', (data) => { html += data; })
		res.on('end', () => {
			var $ = cheerio.load(html);
			var links = $('ul.series_alpha a');
			var count = 0;

			links.each(function(id, elem) {
				var manga = { 
					name : $(elem).text(), 
					host : 'http://www.mangapanda.com/',
					url : urljoin(base_url, $(elem).attr('href')),
					isComplete : Boolean($(elem).parent().children('.mangacompleted').length)
				};
				Manga.findOrCreate({ url : manga.url }, manga, (err, res) => { count++; process.stdout.write(`\r${count}/${links.length}`);});
			});
			setInterval(() => { if(count == links.length) {  mongoose.connection.close(); process.stdout.write('\n'); process.exit(0); }}, 1000)
		})
		
	})
};

MangaPanda();