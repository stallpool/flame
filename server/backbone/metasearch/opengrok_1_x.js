const i_path = require('path');
const i_url = require('url');
const i_req = require('request');
const i_doc = require('cheerio');
const i_common = require('./common');
const i_text = require('../analysis/text');
const i_utils = require('../../utils');

const version_constants = {
   '1.x': {
      xref: 'xref',
      raw: 'download',
   }
}

const system = {
   project_n_group: 40,
}

function parse_cookie(text) {
   if (!text) return {};
   let keyval = text.split(';');
   let json = {};
   keyval.forEach((pair) => {
      let pos = pair.indexOf('=');
      let key = pair;
      if (pos < 0) {
         value = null;
      } else {
         key = pair.substring(0, pos).trim();
         value = pair.substring(pos+1).trim();
      }
      json[key] = value;
   });
   return json;
}

function process_check_authed_for_jsecurity(client, contents) {
   if (contents.indexOf('name="j_username"') < 0) return false;
   if (contents.indexOf('name="j_password"') < 0) return false;
   client.set_mode('jsecurity');
   return true;
}

function process_check_authed_for_basic(client, contents) {
   if (contents.indexOf('HTTP Status 401 – Unauthorized') < 0) return false;
   client.set_mode('basic');
   return true;
}

function process_noauth(client, contents) {
   client.set_mode('noauth');
   client.cache = contents;
   return true;
}

function set_mode_by_body(client, text, expected_mode) {
   process_check_authed_for_jsecurity(client, text)
   || process_check_authed_for_basic(client, text)
   // || process_next(...)
   || process_noauth(client, text); // no auth
   let result = { mode: expected_mode };
   if (expected_mode === client.get_mode()) {
      if (expected_mode === 'noauth') {
         result.ready = true;
      } else {
         result.ready = false;
      }
   } else {
      // for example, if use jsecurity,
      // if logged in, it will directly pass
      client.set_mode(expected_mode);
      result.ready = true;
   }
   return result;
}

function normalize_query(text) {
   text = i_text.tokenizer.basic(text).join(' ');
   return text;
}


const mode = {
   common: {
      search: (client, options) => new Promise((r, e) => {
         if (!options || !options.project) return e(options);
         if (
            options.definition || options.symbol || options.filepath ||
            options.history || options.lang || options.project.length
         ) {
         } else if (!options.fullsearch) {
            return e(options);
         }
         // options:
         //     cookie
         //    project -> project
         // fullserach -> q
         // definition -> defs
         //     symbol -> refs
         //   filepath -> path
         //    history -> hist
         //     offset -> start
         //       size -> n
         //    orderby -> sort
         //          ? -> si
         let form = {};
         if (options.fullsearch) form.full = options.fullsearch || '.';
         if (options.definition) form.def = options.definition;
         if (options.symbol) form.symbol = options.symbol;
         if (options.filepath) form.path = options.filepath;
         if (options.history) form.hist = normalize_query(options.history);
         if (options.language) form.type = options.language;
         if (options.offset) form.start = options.offset;
         if (options.size) form.maxresults = options.size;
         form.maxresults = form.maxresults || 50;
         if (form.maxresults > 500) form.maxresults = 500;
         form.sort = options.orderby || 'relevancy';
         form = Object.keys(form).map(
            (key) => `${encodeURIComponent(key)}=${encodeURIComponent(form[key])}`
         )
         if (!Array.isArray(options.project)) {
            options.project = [options.project];
         }
         options.project.forEach((project_name) => {
            form.push(`projects=${encodeURIComponent(project_name)}`);
         });
         form = form.join('&');

         let request_options = {
            url: `${client.base.url}/api/v1/search?${form}`,
            headers: { 'Content-Type': 'application/json' },
         };
         if (options.cookie) request_options.jar = options.cookie;
         if (options.headers) request_options.headers = options.headers;
         console.log('search:', request_options.url);
         i_req(request_options, (err, res, body) => {
            if (err) {
               return e(err);
            }
            r(body);
         });
      }), // search
      browse: (client, options) => new Promise((r, e) => {
         if (!options.path) return e(options);
         if (!options.prefix) options.prefix = '';
         let request_options = {
            url: `${client.base.url}/${options.prefix}${options.path}`,
            followAllRedirects: true
         };
         if (options.cookie) request_options.jar = options.cookie;
         if (options.headers) request_options.headers = options.headers;
         i_req(request_options, (err, res, body) => {
            if (err) return e(err);
            if (~~(res.statusCode/100) !== 2) return e(res);
            if (body && body.indexOf('\0') >= 0) return r('<BinaryFile ...>');
            r(body);
         });
      }),
      get_xref_item: (xref_contents) => {
         let doc = i_doc.load(xref_contents);
         // xref: ...
         let path = doc('#Masthead').text();
         path = path.split(' ').pop();
         // table
         let columns = null;
         let items = doc('#dirlist tr').map((_, elem) => {
            let cells = doc(elem).find('td'), x;
            if (cells.length === 1) {
               x = doc(cells[0]);
               return;
            }
            if (cells.length > 1) {
               let data = cells.map((_, elem) => doc(elem).text().trim()).get();
               if (!columns) {
                  columns = data;
                  return null;
               }
               let data_json = {};
               data.forEach((value, index) => {
                  let key = columns[index];
                  if (!key) return;
                  key = key.toLowerCase();
                  data_json[key] = value;
               });
               // opengrok 1.x [skip] item of `..`
               if (data_json.name === '..') return null;
               // Size | 1.x: '-'
               return data_json;
            }
            cells = doc(elem).find('th');
            if (cells.length > 0) {
               columns = cells.map((_, elem) => doc(elem).text().trim()).get();
            } else {
               return null;
            }
         }).get().filter((x) => !!x);
         return { path, items };
      }, // get_xref_item
      get_projects: (base_contents) => {
         let doc = i_doc.load(base_contents);
         return doc('select#project.q option').map(
            (_, elem) => doc(elem).val()
         ).get();
      }, // get_projects
      get_items: (search_contents, options) => {
         let r = {
            pages: 0,
            items: {},
            config: {
               history: 'history',
               xref: 'xref',
               raw: 'download',
            }
         };
         let query_set = null;
         if (options && options.query) {
            query_set = {};
            i_text.tokenizer.basic(options.query).forEach((token) => {
               query_set[token] = 1;
            });
         }
         let doc = null;
         let score_filter = {
            count: 0,
            score: 0,
            number: 10,
         };
         try {
            doc = JSON.parse(search_contents);
            doc.results && Object.keys(doc.results).forEach((filename) => {
               let item = doc.results[filename];
               let path = i_path.dirname(filename) + '/';
               let name = i_path.basename(filename);
               let path_obj = r.items[path];
               if (!path_obj) {
                  path_obj = {
                     path, files: []
                  };
                  r.items[path] = path_obj;
               }
               let file_obj = {
                  name, matches: item.map((obj) => ({
                     lineno: obj.lineNumber,
                     text: obj.line,
                     score: score(obj.line, query_set),
                  })),
               };
               if (item.length) {
                  score_filter.count += file_obj.matches.length;
                  score_filter.score += file_obj.matches.map((x) => x.score).reduce((x, y) => x+y);
               }
               path_obj.files.push(file_obj);
            });
            let avg_score = 0; //score_filter.score / (score_filter.count || 1);
            Object.values(r.items).forEach((path_obj) => {
               path_obj.files.forEach((file_obj) => {
                  file_obj.matches = file_obj.matches.filter(
                     (x) => x.score >= avg_score
                  ).sort((x, y) => y.score - x.score).slice(0, score_filter.number);
               });
            });
         } catch(err) {
            console.error('opengrok_1_x/doc: parse error', search_contents, options);
         }
         r.items = Object.values(r.items);
         return r;

         function score(text, query_set) {
            if (!query_set) return 0;
            let item_set = i_text.tokenizer.basic(text);
            let score_set = {};
            let score = 0;
            item_set.forEach((token) => {
               if (query_set[token]) score_set[token] = 1;
            });
            score = Object.keys(score_set).length;
            return score;
         }
      }, // get_items
   },
   noauth: {
      check_authed: (client) => new Promise((r, e) => {
         mode.noauth.login(client).then((item) => {
            r(new OpenGrokResult(client, item.contents));
         }, e);
      }),
      login: (client) => new Promise((r, e) => {
         i_req.get(client.base.url, (err, res, body) => {
            if (err) {
               return e(err);
            }
            r({ contents: body });
         });
      }),
      search: (client, options) => mode.common.search(client, options),
      browse_path: (client, options) => mode.common.browse(client, options),
      browse_file: (client, options) => mode.common.browse(client, options),
   },
   basic: {
      check_authed: (client) => new Promise((r, e) => {
         i_req.get({
            url: client.base.url,
            headers: client.headers,
            followAllRedirects: true
         }, (err, res, body) => {
            if (err) {
               return r(new OpenGrokResult(client, null));
            }
            r(new OpenGrokResult(client, body));
         });
      }),
      login: (client, username, password) => new Promise((r, e) => {
         client.headers = {
            'Authorization': (
               'Basic ' +
               i_utils.Codec.base64.encode(`${username}:${password}`)
            )
         }
         i_req.get({
            url: client.base.url,
            headers: client.headers,
            followAllRedirects: true
         }, (err, res, body) => {
            if (err) {
               return e(err);
            }
            r({ contents: body });
         });
      }),
      search: (client, options) => {
         options.headers = client.headers;
         return mode.common.search(client, options)
      },
      browse_path: (client, options) => {
         options.headers = client.headers;
         return mode.common.browse(client, options)
      },
      browse_file: (client, options) => {
         options.headers = client.headers;
         return mode.common.browse(client, options);
      },
   },
   jsecurity: {
      check_authed: (client) => {
         return new Promise((r, e) => {
            i_req.get({
               url: client.base.url,
               jar: client.cookie,
            }, (err, res, body) => {
               // TODO: check err
               if (err) {
                  return e(err);
               }
               r(new OpenGrokResult(client, body));
            });
         });
      },
      login: (client, username, password) => new Promise((r, e) => {
         i_req.post({
            url: `${client.base.url}/j_security_check`,
            jar: client.get_cookie(),
            form: {
               j_username: username,
               j_password: password,
            },
            followAllRedirects: true
         }, (err, res, body) => {
            if (err) {
               return e(err);
            }
            if (res.statusCode !== 200) {
               return e(res);
            }
            let set_cookie = res.headers['set-cookie'] || [];
            r({
               contents: body,
               token: parse_cookie(set_cookie.join('; ')).JSESSIONID
            });
         });
      }), // login
      search: (client, options) => {
         options = Object.assign({ cookie: client.get_cookie() }, options);
         return mode.common.search(client, options);
      }, // search
      browse_path: (client, options) => {
         options = Object.assign({ cookie: client.get_cookie() }, options);
         return mode.common.browse(client, options)
      },
      browse_file: (client, options) => {
         options = Object.assign({ cookie: client.get_cookie() }, options);
         return mode.common.browse(client, options)
      },
   }
};

class OpenGrokResult {
   constructor(client, text) {
      this.client = client;
      this.text = text;
   }

   ready() {
      if (!this.text) return false;
      return set_mode_by_body(
         this.client, this.text, this.client.get_mode()
      ).ready;
   }

   extract_directory() {
      if (!this.text) return null;
      return mode.common.get_xref_item(this.text);
   }

   extract_projects() {
      if (!this.text) return null;
      return mode.common.get_projects(this.text);
   }

   extract_items(options) {
      if (!this.text) return null;
      let result = mode.common.get_items(this.text, options);
      result.base = this.client.base.url;
      return result;
   }

}

class OpenGrokClient {
   constructor(base_url, _mode, _version) {
      this.base = null;
      this.cookie = i_req.jar();
      this.mode = _mode || 'noauth';
      this.mode_api = mode[this.mode];
      this.projects = null;
      this.search_result = null;
      this.version = _version || '1.x';
      base_url && this.set_base(base_url);
   }

   set_base(url) {
      let parsed = i_url.parse(url);
      this.base = {
         url,
         root: `${parsed.protocol}//${parsed.host}`
      };
   }

   check_authed() {
      return this.mode_api.check_authed(this);
   }

   login(username, password) {
      return new Promise((r, e) => {
         this.mode_api.login(this, username, password).then((res) => {
            r(new OpenGrokResult(this, res.contents));
         }, e);
      });
   }

   search(options) {
      return new Promise((r, e) => {
         this.mode_api.search(this, options).then((res) => {
            // (define) res = contents
            r(new OpenGrokResult(this, res));
         }, e);
      });
   }

   xref_dir(options) {
      options.prefix = version_constants[this.version];
      if (options.prefix) options.prefix = options.prefix.xref;
      if (options.path && options.path.charAt(options.path.length-1) !== '/') {
         options.path += '/';
      }
      return new Promise((r, e) => {
         this.mode_api.browse_path(this, options).then((res) => {
            r(new OpenGrokResult(this, res));
         }, e);
      });
   }

   xref_file(options) {
      options.prefix = version_constants[this.version];
      if (options.prefix) options.prefix = options.prefix.raw;
      return new Promise((r, e) => {
         this.mode_api.browse_file(this, options).then((res) => {
            r(new OpenGrokResult(this, res));
         }, e);
      });
   }

   generate_tasks(query_map, projects, output_task_list, config) {
      projects = i_common.query.filter_project(query_map, projects);
      return new Promise((r, e) => {
         let project_n = projects.length;
         if (!project_n) return r();
         let group_n = Math.ceil(project_n / system.project_n_group);
         for (let i = 0; i < group_n; i++) {
            let task = {
               client: this,
               query: query_map.query,
               projects: projects.slice(
                  i * system.project_n_group,
                  (i + 1) * system.project_n_group
               ),
               options: {},
            };
            if (query_map.definition) task.options.definition = query_map.definition;
            if (query_map.symbol) task.options.symbol = query_map.symbol;
            if (query_map.filepath) task.options.filepath = query_map.filepath;
            if (query_map.history) task.options.history = query_map.history;
            if (query_map.lang) task.options.language = query_map.lang;
            if (query_map.offset) task.options.offset = query_map.offset;
            if (query_map.size) task.options.size = query_map.size;
            task.options.sort = query_map.orderby || 'relevancy';
            let search_act = true;
            if (
               query_map.definition || query_map.symbol || query_map.filepath ||
               query_map.history || query_map.lang || projects.length
            ) {
            } else if (!query_map.query) {
               search_act = false;
            }
            if (search_act) output_task_list.push(task);
         }
         r();
      });
   }

   get_metadata(path) {
      return i_common.metadata.load(path);
   }

   get_cookie() {
      return this.cookie;
   }

   get_mode() {
      return this.mode;
   }

   set_mode(m) {
      this.mode = m;
      this.mode_api = mode[m];
   }
}

const api = {
   Client: OpenGrokClient,
   Result: OpenGrokResult,
};

module.exports = api;