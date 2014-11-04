/**
 * GoJS 1.2.1
 * https://github.com/Lanfei/GoJS
 * A JavaScript module loader following CMD standard
 * [Common Module Definition](https://github.com/cmdjs/specification/blob/master/draft/module.md)
 */

(function(global, undefined) {

	// GoJS
	if (global.gojs) {
		return;
	}

	var gojs = global.gojs = {
		version: '1.2.1'
	};

	// Path
	var DOT_RE = /\/\.\//g;
	var MULTI_SLASH_RE = /([^:/])\/+\//g;
	var DOUBLE_DOT_RE = /\/[^/]+\/\.\.\//;

	var PROTOCOL_RE = /^(http:|https:|file:)?\/\//;

	function normPath(path) {
		path = path.replace(DOT_RE, '/');

		path = path.replace(MULTI_SLASH_RE, '$1/');

		while (path.match(DOUBLE_DOT_RE)) {
			path = path.replace(DOUBLE_DOT_RE, '/');
		}
		return path;
	}

	function dirname(path) {
		return path.match(/[^?#]*\//)[0];
	}

	function absSrc(script) {
		return script.hasAttribute ? script.src : script.getAttribute('src', 4);
	}

	// Config
	var config = {
			map: {},
			base: '',
			main: '',
			debug: false,
			charset: 'utf-8'
		},
		base,
		uriMap = {},
		scripts = document.scripts,
		goScript = scripts[scripts.length - 1],
		dataset = goScript.dataset;

	// config function
	gojs.config = function(data) {
		if (data === undefined) {
			return config;
		}

		for (var key in config) {
			config[key] = data[key] || config[key];
		}

		// normalize base option
		base = config.base;
		if (!PROTOCOL_RE.test(base)) {
			base = dirname(document.location.href) + base;
		} else if (base.indexOf('//') === 0) {
			base = document.location.protocol + base;
		}
		if (base.slice(-1) !== '/') {
			base += '/';
		}

		// normalize map option
		if (!config.debug) {
			var idList, uriList,
				idMap = config.map;
			for (var id in idMap) {
				idList = idMap[id];
				uriList = [];
				for (var i = 0, l = idList.length; i < l; ++i) {
					uriList.push(id2Uri(idList[i]));
				}
				uriMap[id2Uri(id)] = uriList;
			}
		}
	};

	// init GoJS
	gojs.init = function(main) {
		if (main) {
			gojs.config({
				main: main
			});
		}
		loadModule(id2Uri(config.main, absSrc(goScript)));
	};

	// read dataset in old browers
	if (dataset === undefined) {
		dataset = {};
		var attrs = goScript.attributes;
		for (var i = 0, l = attrs.length; i < l; ++i) {
			var item = attrs[i],
				nodeName = item.nodeName,
				nodeValue = item.nodeValue;

			if (nodeName.indexOf('data-') === 0) {
				dataset[nodeName.replace('data-', '')] = nodeValue;
			}
		}
	}

	// save config in dataset
	gojs.config(dataset);

	// Loader
	var moduleMap = {},
		loadedMap = {},
		syncQueue = [],
		isSync = false,
		currentScript = '',
		head = document.head || document.getElementsByTagName('head')[0];

	// get the url of defining script
	function getCurrentScript() {

		// Chrome
		if (document.currentScript) {
			return absSrc(document.currentScript);
		}

		// Safari, etc.
		if (isSync) {
			return currentScript;
		}

		// Opera 9, etc.
		try {
			throwAnError();
		} catch (e) {
			var stack = e.stack;
			// Opera 9 or lower
			if (e.stacktrace) {
				stack = e.toString();
			}
			if (stack) {
				var reg = /(http|https|file):\/\/[^ ]+\.js/g;
				var matches = stack.match(reg);
				return matches.pop();
			}
		}

		// IE 6-9
		for (var i = 0, l = scripts.length; i < l; ++i) {
			var script = scripts[i];
			if (script.readyState === 'interactive') {
				return absSrc(script);
			}
		}

		// use sync mode if current script is unable to get
		isSync = true;

		return currentScript;
	}

	// convert ID to URI based on referer
	function id2Uri(id, referer) {
		var uri = id;
		if (referer && id.indexOf('.') === 0) {
			uri = normPath(dirname(referer) + id);
		} else if (!PROTOCOL_RE.test(id)) {
			uri = normPath(base + id);
		} else if (uri.indexOf('//') === 0) {
			uri = document.location.protocol + uri;
		}
		if (!/\.js($|\?)/.test(uri)) {
			uri += '.js';
		}
		return uri;
	}

	// convert URI to ID
	function uri2Id(uri) {
		var id = uri.replace(base, '');
		if (id.slice(-3) === '.js') {
			id = id.substring(0, id.length - 3);
		}
		return id;
	}

	// search the uri of merged modules
	function resolveUriMap(uri) {
		for (var key in uriMap) {
			var list = uriMap[key];
			for (var i = 0, l = list.length; i < l; ++i) {
				if (list[i] === uri) {
					return key;
				}
			}
		}
		return uri;
	}

	// load module by uri
	function loadModule(uri) {
		var module = moduleMap[uri];

		// init module
		if (module === undefined) {
			module = moduleMap[uri] = {
				id: uri2Id(uri),
				uri: uri,
				factory: null,
				exports: null,
				dependencies: null,
				_waitings: [],
				_remains: 0
			};
		}

		// get the uri of merged modules
		if (!config.debug) {
			uri = resolveUriMap(uri);
		}

		// sync mode
		if (getCurrentScript() && isSync) {
			syncQueue.push(uri);
			return module;
		}

		// prevent multiple loading
		if (loadedMap[uri]) {
			if (syncQueue.length) {
				loadModule(syncQueue.shift());
			}
			return module;
		}
		loadedMap[uri] = true;

		// create script element
		var script;
		script = document.createElement('script');
		script.src = currentScript = uri;
		script.charset = config.charset;
		script.async = true;

		// setTimeout: IE6
		setTimeout(function() {
			script.onload = script.onreadystatechange = function() {
				if (!script.readyState || /loaded|complete/.test(script.readyState)) {
					script.onload = script.onreadystatechange = null;
					head.removeChild(script);
					script = null;
				}
				currentScript = '';
				if (syncQueue.length) {
					loadModule(syncQueue.shift());
				}
			};
			head.insertBefore(script, head.firstChild);
		});

		return module;
	}

	// a factory to create require function
	function requireFactory(uri) {

		// the require function
		var require = function(id) {
			var uri = id2Uri(id, uri);
			return moduleMap[uri].exports;
		};

		// convert ID to URI according to current script
		require.resolve = function(id) {
			return id2Uri(id, uri);
		};

		// load module in async mode
		require.async = function(ids, callback) {
			var deps = [],
				depUri, depModule;

			if (typeof ids == 'string') {
				ids = [ids];
			}

			callback._deps = deps;
			callback._remains = ids.length;

			// load dependencies and update waiting map
			for (var i = 0, l = ids.length; i < l; ++i) {
				depUri = id2Uri(ids[i], uri);
				depModule = loadModule(depUri);
				depModule._waitings.push(callback);
				deps.push(depUri);
			}
		};

		return require;
	}

	// call this function when callback's dependencies are loaded
	function emitCallback(callback) {
		var args = [],
			deps = callback._deps;

		for (var i = 0, l = deps.length; i < l; ++i) {
			args.push(moduleMap[deps[i]].exports);
		}

		callback.apply(null, args);

		// reduce memory
		delete callback._deps;
		delete callback._remains;
	}

	// call this function when module is loaded
	function emitload(module) {
		var uri = module.uri,
			factory = module.factory,
			waitings = module._waitings,
			require, exports, waiting;

		// save exports if factory is a function
		if (typeof factory === 'function') {
			require = requireFactory(uri);
			exports = factory(require, module.exports, module);
			module.exports = exports || module.exports;
		}

		// notify waiting modules or callbacks
		for (var i = 0, l = waitings.length; i < l; ++i) {
			waiting = waitings[i];
			if (--waiting._remains === 0) {
				if (typeof waiting === 'function') {
					emitCallback(waiting);
				} else {
					emitload(waiting);
				}
			}
		}

		// reduce memory
		delete module._waitings;
		delete module._remains;
	}

	// parse the dependencies in factory
	function parseDeps(factory) {
		var re = /(^|\b)(?!_)require\( *[\'\"][^\'\"]+[\'\"] *\)/g,
			code = factory.toString(),
			// code = code.replace(/\/\/.*/g, ''),
			deps = code.match(re) || [];

		for (var i = 0, l = deps.length; i < l; ++i) {
			deps[i] = deps[i].replace(/require\( *[\'\"]([^\'\"]+)[\'\"] *\)/, '$1');
		}

		return deps;
	}

	// save module and resolve dependencies
	function saveModule(uri, factory) {
		var module = moduleMap[uri],
			exports, deps;

		// update module
		if (typeof factory === 'function') {
			exports = {};
			deps = parseDeps(factory);
		} else {
			exports = factory;
			deps = [];
		}

		module.factory = factory;
		module.exports = exports;
		module.dependencies = deps;
		module._remains = deps.length;

		// resolve dependencies
		var depUri, depModule;
		for (var i = 0, l = deps.length; i < l; ++i) {
			depUri = id2Uri(deps[i], uri);
			depModule = loadModule(depUri);
			if (depModule._remains === undefined) {
				--module._remains;
			} else {
				depModule._waitings.push(module);
			}
		}

		if (module._remains === 0) {
			emitload(module);
		}
	}

	// define a module
	global.define = function(factory) {
		var uri = getCurrentScript();

		// correct the uri of merged modules
		if (!config.debug) {
			var index,
				list = uriMap[uri];
			if (list) {
				index = list.index || 0;
				uri = list[index];
				list.index = index + 1;
			}
		}

		saveModule(uri, factory);
	};

	// an empty object to determine if a CMD loader exists
	global.define.cmd = {};

	// auto initialization
	if (config.main) {
		gojs.init();
	}

})(this);