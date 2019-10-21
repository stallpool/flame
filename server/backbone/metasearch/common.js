const i_env = require('../../env');
const i_metadata = require('./metadata');
const i_curl = require('../analysis/curl');

function extract_query_keyval (text) {
   if (!text) return null;
   if (text.indexOf(':') < 0) return null;
   // skip text like 23:59:59
   if (!/^[A-Za-z][-\w\d]*:/.test(text)) return null;
   let index = text.indexOf(':');
   let key = text.substring(0, index);
   let val = text.substring(index+1);
   return { key, val };
}

const api = {
   metadata: new i_metadata.MetaData(),
   query: {
      parse: (query) => {
         // semantic query, e.g.
         //    -           common: query = "this is a test"
         //    - specific project: query = "project:xxx this is a test"
         // general:
         //    query = "key1:val1 key2:val2 ... text"
         let map = { query: [] };
         let keyval_on = true;
         if (!query) return map;
         query.split(' ').forEach((part) => {
            if (!keyval_on) {
               map.query.push(part);
            }
            let item = extract_query_keyval(part);
            if (item) {
               map[item.key] = item.val;
            } else {
               keyval_on = false;
               map.query.push(part);
            }
         });
         map.query = map.query.join(' ');
         return map;
      }, // parse
      filter_project: (query_map, projects) => {
         if(!query_map.project) return projects;
         let filter_in = query_map.project.split(',');
         //          projects: after check with acl, e.g. a, b, c
         // query_map.project:                       e.g.    b,   d
         //         filter_in:                       e.g.    b
         filter_in = filter_in.filter(
            (project) => projects.indexOf(project) >= 0
         );
         return filter_in;
      }, // parse
   }, // query
   search: {
      zoekt: async (options) => {
         let url = i_env.search_engine.url;
         if (!url) return [];
         if (!options) return [];
         let query = encodeURIComponent(options.query);
         let size = parseInt(options.size) || 50;
         let r = await i_curl.request({
            data_type: 'plain',
            follow_redirect: true,
            url: `${url}?q=${query}&num=${size}`,
            method: 'POST'
         });
         return r;
      }
   }, //search
};

module.exports = api;