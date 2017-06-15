var mongoose = require('mongoose');
var urljoin = require('url-join');
var http = require('https');
var Manga = require('./manga');
var config = require('./config')
var token = config.token;
var baseurl = `https://api.telegram.org/bot${token}/`;

mongoose.connect('mongodb://localhost/mangareaderbot');

function serialize(obj) {
	return '?'+Object.keys(obj).reduce(function(a,k){if(obj[k] != null	) {a.push(k+'='+encodeURIComponent(obj[k]));} return a},[]).join('&')
}

function setWebhook() {
	var data = {url : config.url}
	var url = urljoin(baseurl, "setWebhook", serialize(data));
	http.get(url, (res) => {
		res.on('end', () => {
			console.log("Webhook Done...");
		})
	});
}

function sendMessage(chat_id, message, parse_mode) {
	var url = urljoin(baseurl, 'sendMessage', serialize({chat_id : chat_id, text : message, parse_mode: parse_mode}));
	http.get(url);
}


function sendChatAction(chat_id, action) {
	var url = urljoin(baseurl, 'sendChatAction', serialize({chat_id : chat_id, action : action}));
	http.get(url);
}

function editMessageText(chat_id, message_id, message, parse_mode) {
	var url = urljoin(baseurl, 'editMessageText', serialize({chat_id : chat_id, message_id : message_id, text : message, parse_mode : parse_mode}));
	http.get(url);
}


function parseCommand(update) {
	if(update.message)
		parseMessage(update.message);
	else if(update.edited_message)
		parseMessage(update.edited_message);
	else if(update.callback_query)
		parseCallback(update.callback_query);
	else
		sendMessage(update.message.chat.id, "Sorry!! We do not understand your request,");
}

function parseMessage(message) {
	var chat_id = message.chat.id;
	if(message.entities && message.entities.filter(entity => entity.type == 'bot_command').length) {
		var command = message.text.slice(message.entities[0].offset+1, message.entities[0].offset+message.entities[0].length);
		var query = message.text.slice(message.entities[0].offset+message.entities[0].length+1);
		if(command == 'start')
			sendStartMessage(chat_id);
		if(command == 'search')
			searchQuery(chat_id, query);
	}
	else if(message.reply_to_message) {
		var manga_name = message.reply_to_message.text.split('\n')[0].trim();
		sendManga(manga_name, chat_id, message.message_id, message.text)
	}
	else
		sendMessage(chat_id, "Sorry!! We do not understand your request,");
}

function sendStartMessage(chat_id) {
	var s = `*Manga Reader Bot*
	This bot can send your favorite manga to you.
	Following command is to search through our manga directory:-
	/search _keyword_ - Looks through manga directory for 'keyword'.
	In results, select the index of manga to start reading.
	After selecting manga you will be asked for the chapter number. If you reply to that message then you will be sent the first page of that chapter.
	Then you can traverse through the chapter via the Next and Prev buttons.
	`;
	sendMessage(chat_id, s, 'Markdown');
}

function searchQuery(chat_id, query, page, message_id) {
	const limit = 5;
	if(!page || page < 0) page = 0;
	Manga.findByName(query).skip(limit*page).limit(limit).exec().then(mangas => {
		var obj = { chat_id : chat_id }
		obj.text = mangas.length ? mangas.slice().map(function(manga, id) {
			return `${limit*page+id+1}. ${manga.name}`;
		}).join('\n') : "No More Results!!!";
		var keyboard =  [[], []];
		if(page != 0)
			keyboard[0].push({text : "Prev", callback_data : JSON.stringify({command : "search", query : query, page : page - 1})})
		if(mangas.length == limit)
			keyboard[0].push({text : "Next", callback_data : JSON.stringify({command : "search", query : query, page : page + 1})});

		for(var i = 1; i <= mangas.length; i++)
			keyboard[1].push({text:`${page*limit+i}`, callback_data : JSON.stringify({ command: 'start', id:mangas[i-1]._id})});

		obj.reply_markup = JSON.stringify({inline_keyboard : keyboard})
		if(message_id) {
			obj.message_id = message_id;
			var url = urljoin(baseurl, 'editMessageText', serialize(obj));
		}
		else
			var url = urljoin(baseurl, 'sendMessage', serialize(obj));
		http.get(url);
	})
	.catch(() => {});
}

function readManga(id, chat_id) {
	var obj = {chat_id : chat_id}
	Manga.findOne({_id : id}).exec().then(manga => {
		var url = urljoin(baseurl, 'sendMessage', 
			serialize({chat_id : chat_id, text: `*${manga.name}*\nSelect Chapter Number!!!`, 
				parse_mode:'Markdown', reply_markup : JSON.stringify({force_reply:true})
			})
		);
		console.log(url);
		http.get(url);
	})
}

function sendManga(name, chat_id, message_id, chapter, page, action) {
	if(!page) page = 1;
	Manga.findOne({name : {$regex:name, $options:'i'}}).exec().then(manga => {
		if(!manga) return;
		http.get(urljoin(baseurl, 'deleteMessage', serialize({chat_id:chat_id, message_id:message_id})));
		http.get(urljoin(baseurl, 'sendChatAction', serialize({chat_id:chat_id, action:'upload_photo'})));
		manga['get' + (action ? action : '') +'ImageUrl'](chapter, page)
			.then((args) => {
				var imgurl = args[0], chapter = args[1], page = args[2];
				if(!page)	page = 1;
				if(imgurl) {
					var obj = {chat_id:chat_id, photo : imgurl, caption : `${manga.name}\nChapter ${chapter} - Page ${page}`};
					obj.reply_markup = JSON.stringify({
						inline_keyboard : [[
							{text:"Prev Page", callback_data:JSON.stringify({command : 'read', chapter : chapter, page: page, action:'Prev'})},
							{text:"Next Page", callback_data:JSON.stringify({command : 'read', chapter : chapter, page: page, action:'Next'})},
						]]
					});
					var url = urljoin(baseurl, 'sendPhoto', serialize(obj));
					http.get(url);
				}
			})
			.catch(err => sendMessage(chat_id, `Chapter ${chapter} is not released.`))
	}).catch((err) => console.log(err))
}

function parseCallback(callback_query) {
	http.get(urljoin(baseurl, 'answerCallbackQuery', serialize({ callback_query_id : callback_query.id })));
	var data = JSON.parse(callback_query.data);
	console.log(callback_query);
	if(data.command == 'search')
		searchQuery(callback_query.message.chat.id, data.query, data.page, callback_query.message.message_id);
	if(data.command == 'start')
		readManga(data.id, callback_query.message.chat.id);
	if(data.command == 'read') {
		var manga_name = callback_query.message.caption.split('\n')[0].trim();
		sendManga(manga_name, callback_query.message.chat.id, callback_query.message.message_id, data.chapter, data.page, data.action);
	}
}


module.exports = {
	setWebhook : setWebhook,
	sendMessage : sendMessage,
	editMessageText : editMessageText,
	parseCommand : parseCommand,
	parseMessage : parseMessage,
	searchQuery : searchQuery,
	readManga : readManga,
	sendManga : sendManga,
	parseCallback : parseCallback,
}