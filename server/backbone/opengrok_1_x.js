const i_url = require('url');
const i_req = require('request');
const i_doc = require('cheerio');

let opengrok_cookie = i_req.jar();

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

function process_check_authed_for_jsecurity(res, body, resolve_fn) {
   if (body.indexOf('name="j_username"') < 0) return false;
   if (body.indexOf('name="j_password"') < 0) return false;
   let keyval = res.headers['set-cookie'];
   if (!keyval) return false;
   keyval = keyval.join('; ');
   resolve_fn({ type: 'jsecurity' });
   return true;
}

const mode = {
   common: {
      search: (options) => new Promise((r, e) => {
         if (!options || !options.project) return e(options);
         if (!(
            options.fullsearch || options.definition || options.symbol || options.filepath || options.history
         )) return e(options);
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
         if (Array.isArray(options.project)) options.project = options.project.join(',');
         form.project = options.project;
         if (options.fullsearch) form.q = options.fullsearch;
         if (options.definition) form.defs = options.definition;
         if (options.symbol) form.refs = options.symbol;
         if (options.filepath) form.path = options.filepath;
         if (options.history) form.hist = options.history;
         if (options.offset) form.start = options.offset;
         if (options.size) form.n = options.size;
         form.sort = options.orderby || 'relevancy';
         form = Object.keys(form).map(
            (key) => `${encodeURIComponent(key)}=${encodeURIComponent(form[key])}`
         ).join('&');

         let request_options = {
            url: `${api.base.url}/search?${form}`,
         };
         if (options.cookie) request_options.jar = options.cookie;
         i_req(request_options, (err, res, body) => {
            if (err) {
               return e(err);
            }
            r(body);
         });
      }), // search
      get_projects: (base_contents) => {
         let doc = i_doc.load(base_contents);
         return doc('select#project.q option').map(
            (_, elem) => doc(elem).val()
         ).get();
      }, // get_projects
      get_items: (search_contents, options) => {
         let doc = i_doc.load(search_contents);
         let r = {
            base: api.base.root,
            pages: 0,
            items: []
         };
         let table = doc('div#results > table');
         if (!table) return r;
         let pages = doc('div#results > p > .sel')[0];
         if (pages) {
            let page_n = parseInt(doc(pages.parent).find('a').map(
               (x) => doc(x).text()
            ).get().pop()) || 1;
            r.pages += page_n;
         } else {
            r.pages += 1
         }

         if (!options) options = {};
         // not_parse_items: true/false, default=false
         if (options.not_parse_items) return r;
         let current_dir = null, current_file = null;
         table.find('tr').each((_, tr) => {
            tr = doc(tr);
            let a, text;
            if (tr.hasClass('dir')) {
               a = tr.find('a');
               text = a.text();
               current_dir = {};
               current_dir.path = text;
               current_dir.files = [];
               r.items.push(current_dir);
            } else {
               if (!current_dir) return;
               current_file = {};

               current_file.name = tr.find('td.f > a').text();

               current_file.matches = [];
               tr.find('td > .con > a.s').each((_, line) => {
                  text = doc(line).text();
                  if (!text) return;
                  let space1st = text.indexOf(' ');
                  if (space1st < 0) return;
                  current_file.matches.push({
                     lineno: parseInt(text.substring(0, space1st)),
                     text: text.substring(space1st+1)
                  });
               });

               if (!r.config) {
                  // parse and store once
                  // /history, /xref, /raw|/download
                  a = tr.find('td.q > a');
                  let links = [
                     doc(a[0]).attr('href').split('/'),
                     doc(a[1]).attr('href').split('/'),
                     doc(a[2]).attr('href').split('/')
                  ];
                  for (let part_n = links[0].length, i = 0; i < part_n; i++) {
                     if (links[0][i] !== links[1][i]) {
                        r.config = {
                           history: links[0][i],
                           xref: links[1][i],
                           // in odler version, it is 'raw' instead of 'download'
                           raw: links[2][i],
                        };
                        break;
                     }
                  }
               }
               current_dir.files.push(current_file);
               current_file = null;
            }
         });
         return r;
      }, // get_items
   },
   noauth: {
      login: () => new Promise((r, e) => {
         i_req.get(api.base.url, (err, res, body) => {
            if (err) {
               return e(err);
            }
            r({ contents: body });
         });
      }),
      search: (options) => mode.common.search(options),
   },
   jsecurity: {
      login: (username, password) => new Promise((r, e) => {
         i_req.post({
            url: `${api.base.url}/j_security_check`,
            jar: opengrok_cookie,
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
      search: (options) => {
         options = Object.assign({ cookie: opengrok_cookie }, options);
         return mode.common.search(options);
      }, // search
   }
};

const api = {
   base: null,
   set_base: (url) => {
      let parsed = i_url.parse(url);
      api.base = {
         url,
         root: `${parsed.protocol}//${parsed.host}`
      };
   },
   check_authed: () => new Promise((r, e) => {
      i_req.get({
         url: api.base.url,
         jar: opengrok_cookie,
      }, (err, res, body) => {
         // TODO: check err
         if (err) {
            return e(err);
         }
         process_check_authed_for_jsecurity(res, body, r)
         // || process_next(...)
         || r({ type: 'noauth', contents: body }); // no auth
      });
   }),
   mode
};

module.exports = api;