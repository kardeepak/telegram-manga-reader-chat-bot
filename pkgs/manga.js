var urljoin = require('url-join');
var cheerio = require('cheerio');
var http = require('http');
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Manga = new Schema({
	name : String,
	host : String,
	url : {type: String, unique: true},
	isComplete : Boolean,
});

class MangaClass {
	static findOrCreate(condition, data, callback) {
		this.findOne(condition, (err, res) => {
			if(!res)
				this.create(data, callback);
			else
				callback(err, res);
		});
	}
	static findByName(name) {
		return this.find({'name' : { '$regex':name, '$options':'i' }});
	}

	getChapterUrl(chapter) {
		return urljoin(this.url, chapter.toString());
	}

	getPageUrl(chapter, page) {
		return urljoin(this.url, chapter.toString(), page.toString());
	}

	getImageUrl(chapter, page) {
		return new Promise((resolve, reject) => {
			var url = this.getPageUrl(chapter, page);
			http.get(url, (res) => {
				if(res.statusCode < 200 || res.statusCode > 299)
					reject(null);
				var html = '';
				res.on('data', (data) => { html += data; })
				res.on('end', () => {
					var $ = cheerio.load(html);
					var imgurl = $('.episode-table img').attr('src');
					if(imgurl)	resolve([imgurl, chapter, page]);
					else	reject(null);
				});
			});
		})
	}

	getPrevImageUrl(chapter, page) {
		return new Promise((resolve, reject) => {
			var url = this.getPageUrl(chapter, page);
			http.get(url, (res) => {
				var html = '';
				res.on('data', (data) => { html += data; })
				res.on('end', () => {
					var $ = cheerio.load(html);
					var path = $('.prev a').attr('href')
					var newurl = urljoin(this.host, path)
					var chapter = path.split('/')[2];
					var page = path.split('/')[3];
					http.get(newurl, (res) => {
						if(res.statusCode < 200 || res.statusCode > 299)
							reject(null);
						var html = '';
						res.on('data', (data) => { html += data; });
						res.on('end', () => {
							var $ = cheerio.load(html);
							var imgurl = $('.episode-table img').attr('src');
							if(imgurl)	resolve([imgurl, chapter, page]);
							else	reject(null);
						});
					});
				});
			});
		})
	}

	getNextImageUrl(chapter, page) {
		return new Promise((resolve, reject) => {
			var url = this.getPageUrl(chapter, page);
			http.get(url, (res) => {
				var html = '';
				res.on('data', (data) => { html += data; })
				res.on('end', () => {
					var $ = cheerio.load(html);
					var path = $('.next a').attr('href')
					var newurl = urljoin(this.host, path)
					var chapter = path.split('/')[2];
					var page = path.split('/')[3];
					page = page ? page : 1;
					http.get(newurl, (res) => {
						if(res.statusCode < 200 || res.statusCode > 299)
							reject(null);
						var html = '';
						res.on('data', (data) => { html += data; })
						res.on('end', () => {
							var $ = cheerio.load(html);
							var imgurl = $('.episode-table img').attr('src');
							if(imgurl)	resolve([imgurl, chapter, page]);
							else	reject(null);
						});
					});
				});
			});
		})
	}
}

Manga.loadClass(MangaClass);

module.exports = mongoose.model('Manga', Manga);