define(function(require, exports, module) {

	console.log(module.dependencies);

	var $ = require('lib/jquery');
	window.debug = function(msg){
		$('#log').append(msg + '<br>');
	};

	var a = require('a');
	var b = require('b');
	var c = require('c');

	debug('Main module: ' + module.id);

	debug(a);
	b.sayHi();
	c.sayHi();

});