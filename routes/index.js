var express = require('express');
var parser = require('../pkgs/commandparser')
var router = express.Router();

/* GET home page. */
router.all('/', function(req, res, next) {
	console.log(req.body);
	parser.parseCommand(req.body);
    res.send({ "ok": true });
});

module.exports = router;
