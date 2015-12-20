/**
 * @file mdjs
 * @author xiaowu
 * @email fe.xiaowu@gmail.com
 */

'use strict';

var _createClass = require('babel-runtime/helpers/create-class')['default'];

var _classCallCheck = require('babel-runtime/helpers/class-call-check')['default'];

var _extends = require('babel-runtime/helpers/extends')['default'];

var _interopRequireDefault = require('babel-runtime/helpers/interop-require-default')['default'];

exports.__esModule = true;

var _artTemplateNodeTemplateNative = require('art-template/node/template-native');

var _artTemplateNodeTemplateNative2 = _interopRequireDefault(_artTemplateNodeTemplateNative);

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _serveStatic = require('serve-static');

var _serveStatic2 = _interopRequireDefault(_serveStatic);

var _serveIndex = require('serve-index');

var _serveIndex2 = _interopRequireDefault(_serveIndex);

var _fs = require('fs');

var _url = require('url');

var _path = require('path');

var _keyCache = require('key-cache');

var _keyCache2 = _interopRequireDefault(_keyCache);

var _marked = require('marked');

var _marked2 = _interopRequireDefault(_marked);

var _highlightJs = require('highlight.js');

var _highlightJs2 = _interopRequireDefault(_highlightJs);

var Mdjs = (function () {
    _createClass(Mdjs, null, [{
        key: 'options',
        value: {
            /**
             * 文档名
             *
             * @type {String}
             */
            name: 'mdjs',

            /**
             * 监听的端口
             *
             * @type {Number}
             */
            port: 8091,

            /**
             * 文档根目录
             *
             * @type {String}
             */
            root: './',

            /**
             * 缓存文件目录
             *
             * @type {String}
             */
            cache_path: './.cache/',

            /**
             * 目录别名
             *
             * @type {Object}
             */
            dir_alias: {},

            /**
             * mdjs静态资源前缀
             *
             * @description 监听内置的静态资源，配置是为了解决与别的名冲突
             * @type {String}
             */
            static_prefix: 'static',

            /**
             * 忽略的目录
             *
             * @type {Array}
             */
            ignore_dir: ['.svn', '.git', 'node_modules'],

            /**
             * 导航里额外追加的链接
             *
             * @example
             *     [
             *         {
             *             "text": "链接名称-默认往导航之前插件",
             *             "url": "链接"
             *         },
             *         {
             *             "text": "链接名称-往导航之后追加",
             *             "url": "链接",
             *             "type": "after"
             *         }
             *     ]
             * @type {Array}
             */
            links: [],

            /**
             * 调试模式
             *
             * @description 开启后不使用缓存
             * @type {Boolean}
             */
            debug: false,

            /**
             * 默认主页
             *
             * @type {Array}
             */
            default_index: ['readme.md', 'README.md']
        },

        /**
         * 构造器
         *
         * @param  {Object} options 配置参数
         */
        enumerable: true
    }]);

    function Mdjs() {
        var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

        _classCallCheck(this, Mdjs);

        var package_options = undefined;
        try {
            package_options = require(_path.resolve('./package.json')).mdjs;
        } catch (e) {
            package_options = {};
        }

        // 合并默认配置
        // 合并的顺序是： 参数 > package.mdjs > 默认 （由左向右合并）
        options = this.options = _extends({}, Mdjs.options, package_options, options);

        options.root = _path.resolve(options.root);
        options.cache_path = _path.resolve(options.cache_path);

        // 缓存当前运行的目录
        this.__dirname = _path.dirname(__dirname);

        // 缓存express
        this.express = _express2['default']();

        // 初始化express
        this._init_express();
    }

    /**
     * 获取渲染后的导航html代码
     *
     * @param  {string|undefined} uri 当前高亮的路径，如果为空则全不高亮， 高亮即展开
     *
     * @return {string}     html代码
     */

    Mdjs.prototype.get_render_nav = function get_render_nav(uri) {
        var data = this.get_list();
        var str = '';

        if (!data || !data.length) {
            return str;
        }

        if (uri) {
            uri = decodeURIComponent(uri);
        }

        var filter = function filter(filepath, type) {
            if (!uri) {
                return false;
            }

            if (type === 'dir') {
                return uri.indexOf(filepath + '/') === 0;
            }
            return uri === filepath;
        };

        var fn = function fn(res) {
            var html = '';

            res.forEach(function (val) {
                if (!val.children || !val.children.length) {
                    if (filter(val.uri, 'file')) {
                        html += '<li class="nav-tree-file nav-tree-current">';
                    } else {
                        html += '<li class="nav-tree-file">';
                    }
                    html += '\n                            <div class="nav-tree-text">\n                                <a href="' + val.uri + '" class="nav-tree-file-a" data-uri="' + val.uri + '" title="' + val.text + '">\n                                    ' + val.text + '\n                                </a>\n                            </div>\n                        </li>\n                    ';
                } else {
                    if (filter(val.uri, 'dir')) {
                        html += '<li class="nav-tree-dir nav-tree-dir-open">';
                    } else {
                        html += '<li class="nav-tree-dir">';
                    }
                    html += '\n                            <div class="nav-tree-text">\n                                <a href="#" class="nav-tree-dir-a" data-uri="' + val.uri + '" title="' + val.text + '">\n                                    ' + val.text + '\n                                </a>\n                            </div>\n                            ' + fn(val.children) + '\n                        </li>\n                    ';
                }
            });

            return '<ul>' + html + '</ul>';
        };

        return fn(data);
    };

    /**
     * 清空缓存
     *
     * @return {Object} this
     */

    Mdjs.prototype.clear_cache = function clear_cache() {
        // 调用缓存对象清空缓存
        new _keyCache2['default']({
            dir: this.options.cache_path
        }).remove();

        return this;
    };

    /**
     * 获取navtree使用数据，会追加options.links
     *
     * @description 会先读取缓存
     * @return {Array} 数组
     */

    Mdjs.prototype.get_list = function get_list() {
        var _this = this;

        return this.cache('nav_data', function () {
            var data = _this._get_list();

            if (!data.children) {
                data.children = [];
            }

            // 如果有链接，则追加
            if (_this.options.links && _this.options.links.length) {
                _this.options.links.forEach(function (val) {
                    if (val.type === 'after') {
                        data.children.push(val);
                    } else {
                        data.children.unshift(val);
                    }
                });
            }

            return data.children;
        });
    };

    /**
     * 渲染md文件
     *
     * @param  {string} content md源码
     *
     * @return {Object}         {content:html代码, catalog: h2,3分类}
     */

    Mdjs.prototype.renderMarkdown = function renderMarkdown() {
        var content = arguments.length <= 0 || arguments[0] === undefined ? '' : arguments[0];

        var renderer = new _marked2['default'].Renderer();
        var cachekey = {};

        var catalog = [];

        // 渲染标题
        renderer.heading = function (text, level) {
            var key = undefined;

            if (level !== 2 && level !== 3) {
                return '<h' + level + '>' + text + '</h' + level + '>';
            }

            if (cachekey[level] === undefined) {
                cachekey[level] = 0;
            }

            key = ++cachekey[level];

            catalog.push({
                text: text,
                level: level,
                id: 'h' + level + '-' + key
            });

            return '\n                <h' + level + '>\n                    <span>\n                        <a name="h' + level + '-' + key + '" class="anchor" href="#h' + level + '-' + key + '"></a>\n                        <span>' + text + '</span>\n                    </span>\n                </h' + level + '>\n            ';
        };

        // 渲染代码
        renderer.code = function (data, lang) {
            data = _highlightJs2['default'].highlightAuto(data).value;

            // 有语言时
            if (lang) {

                // 超过3行有提示
                if (data.split(/\n/).length >= 3) {
                    var html = '<pre><code class="hljs lang-' + lang + '"><span class="hljs-lang-tips">' + lang + '</span>';
                    return html + (data + '</code></pre>');
                }

                return '<pre><code class="hljs lang-' + lang + '">' + data + '</code></pre>';
            }

            return '<pre><code class="hljs">' + data + '</code></pre>';
        };

        // md => html
        content = _marked2['default'](content, {
            renderer: renderer
        });

        // 兼容todo
        content = content.replace(/<li>\s*\[ \]\s*/g, '<li><input type="checkbox" class="ui-todo" disabled>');
        content = content.replace(/<li>\s*\[x\]\s*/g, '<li><input type="checkbox" disabled checked class="ui-todo">');

        return {
            content: content,
            catalog: catalog
        };
    };

    /**
     * 运行
     *
     * @return {Object} this
     */

    Mdjs.prototype.run = function run() {
        // 委托目录浏览
        this.express.use('/', _serveIndex2['default'](this.options.root, {
            icons: true
        }));
        this.express.listen(this.options.port);
        return this;
    };

    /**
     * 缓存
     *
     * @description 如果有key的缓存则直接调用缓存，否则使用fn返回值作为缓存，如果开启了debug则直接使用fn返回值
     * @param  {string}   key  缓存key
     * @param {Function} fn 当没有缓存时执行的回调
     * @return {Object|undefined} 缓存数据或者回调返回值
     */

    Mdjs.prototype.cache = function cache(key) {
        var fn = arguments.length <= 1 || arguments[1] === undefined ? function () {} : arguments[1];

        // 如果没有key则返回空
        if (!key) {
            return undefined;
        }

        // 如果有debug
        if (this.options.debug) {
            return fn();
        }

        var cache = new _keyCache2['default']({
            dir: this.options.cache_path
        });
        var value = cache.get(key);
        if (value) {
            return value;
        }

        value = fn();

        // 如果不为空则设置缓存
        if (value !== undefined) {
            cache.set(key, value);
        }

        return value;
    };

    /**
     * 初始化express
     *
     * @private
     */

    Mdjs.prototype._init_express = function _init_express() {
        var _this2 = this;

        var app = this.express;

        _artTemplateNodeTemplateNative2['default'].config('base', '');
        _artTemplateNodeTemplateNative2['default'].config('extname', '.html');

        app.engine('.html', _artTemplateNodeTemplateNative2['default'].__express);
        app.set('views', _path.resolve(this.__dirname, './views/'));
        app.set('view engine', 'html');

        // 写入变量
        app.use(function (req, res, next) {
            // 写入变量
            res.locals.options = _this2.options;

            return next();
        });

        // 绑定.md文档
        app.get(/([\s\S]+?)\.md$/, this._md.bind(this));

        // 监听以目录结束的，其实是为了解决默认主页为md文档问题
        app.get(/(^\/$|\/$)/, function (req, res, next) {
            var parseUrl = _url.parse(req.url, true);
            var pathname = parseUrl.pathname;

            // 相对文件的路径,用来判断文件是否存在
            var filepath = decodeURIComponent('.' + pathname);

            // 默认主页
            var default_index = _this2.options.default_index;
            var flag = false;
            for (var i = 0, len = default_index.length; i < len; i++) {
                if (_fs.existsSync(_path.resolve(_this2.options.root, filepath, default_index[i]))) {
                    flag = default_index[i];
                    break;
                }
            }

            if (flag) {
                req.url = _url.format({
                    hash: parseUrl.hash,
                    search: parseUrl.search,
                    pathname: pathname + flag,
                    query: parseUrl.query
                });

                return _this2._md(req, res, next);
            }

            next();
        });

        // 委托静态资源
        app.use('/' + this.options.static_prefix, _serveStatic2['default'](_path.resolve(this.__dirname, './static/')));

        // 委托源目录
        app.use('/', _serveStatic2['default'](this.options.root));
    };

    // _search(req, res, next) {
    //     let key = req.param('key');
    //     grep(resolve('**/*.md'), key, (data) => {
    //         let result = [];

    //         result.push('# 搜索结果 - ' + key);

    //         if (Object.keys(data).length) {
    //             result.push(`\n> 共找到${Object.keys(data).length}条结果\n`);
    //             Object.keys(data).forEach(filepath => {

    //                 result.push(`## [${this._get_md_title(filepath)}](${filepath.replace(this.options.root, '')})`);

    //                 data[filepath].forEach(val => {
    //                     result.push('```\n' + val.line + '```');
    //                 });
    //             });
    //         }
    //         else {
    //             result.push('无搜索结果～');
    //         }

    //         res.render('markdown', {
    //             key: key,
    //             nav_data: this.get_render_nav(),
    //             markdown_data: this.renderMarkdown(result.join('\n')).content,
    //             title: `搜索结果 - ${this.options.name}`
    //         });
    //     });
    // }

    /**
     * 内部获取列表数据
     *
     * @private
     * @param  {string|undefined} dir 目录
     *
     * @return {Object}     {path:'', children:[]}
     */

    Mdjs.prototype._get_list = function _get_list(dir) {
        var _this3 = this;

        var options = this.options;
        var result = undefined;

        dir = dir || options.root;

        var file_basename = _path.basename(dir);

        result = {
            uri: dir.replace(options.root, '') || '/',
            children: [],
            text: options.dir_alias[file_basename] || file_basename
        };

        // 如果目录不存在
        if (!_fs.existsSync(dir)) {
            return result;
        }

        // 读取目录里数据
        var data = _fs.readdirSync(dir);

        // 定义目录数据和文件数据
        var dir_data = [];
        var file_data = [];

        // 遍历数据，拿出目录、文件的数据
        data.forEach(function (file) {
            var filepath = _path.resolve(dir, file);
            var stat = _fs.statSync(filepath);

            if (stat.isDirectory()) {
                if (options.ignore_dir && options.ignore_dir.indexOf(file) === -1) {
                    dir_data.push({
                        type: 'dir',
                        filepath: filepath
                    });
                }
            } else {
                if (_path.extname(file) === '.md') {
                    file_data.push({
                        filepath: filepath
                    });
                }
            }
        });

        // 合并目录+文件数据
        dir_data.concat(file_data).forEach(function (file) {
            if (file.type === 'dir') {
                var res = _this3._get_list(file.filepath);

                // 必须有子集才算
                if (res.children && res.children.length) {
                    result.children.push(res);
                }
            } else {
                result.children.push({
                    text: _this3._get_md_title(file.filepath),
                    uri: file.filepath.replace(options.root, '')
                });
            }
        });

        return result;
    };

    /**
     * 渲染md文档
     *
     * @private
     * @param  {Object}   req  express.req
     * @param  {Object}   res  express.res
     * @param  {Function} next 下一个路由
     * @return {Object} res
     */

    Mdjs.prototype._md = function _md(req, res, next) {
        var parseUrl = _url.parse(req.url, true);

        // 如果要读取源码
        if (parseUrl.query.source) {
            return next();
        }

        // 加.是为了变成相对路径
        var filepath = _path.resolve(this.options.root, '.' + parseUrl.pathname);

        // 为了中文
        filepath = decodeURIComponent(filepath);

        // 如果md文件不存在
        if (!_fs.existsSync(filepath)) {
            return next();
        }

        var htmldata = this.renderMarkdown(_fs.readFileSync(filepath).toString()).content;

        // 如果是pjax
        if (parseUrl.query.pjax) {
            return res.end(htmldata);
        }

        // 渲染md
        return res.render('markdown', {
            nav_data: this.get_render_nav(parseUrl.pathname),
            markdown_data: htmldata,
            title: this._get_md_title(filepath) + ' - ' + this.options.name
        });
    };

    /**
     * 内部获取md文档的标题
     *
     * @private
     * @param  {string} filepath 文件路径
     *
     * @return {string}     标题
     */

    Mdjs.prototype._get_md_title = function _get_md_title(filepath) {
        // 如果是md扩展
        if (_path.extname(filepath) === '.md') {
            // 获取文件内容
            var filedata = _fs.readFileSync(filepath).toString();

            // 正则取出#标题的文字
            if (filedata.match(/^\#+\s?(.+)/)) {
                return String(RegExp.$1).trim();
            }
        }

        return _path.basename(filepath);
    };

    return Mdjs;
})();

exports['default'] = Mdjs;
module.exports = exports['default'];