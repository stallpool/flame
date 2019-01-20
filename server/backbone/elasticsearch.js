const i_es = require('elasticsearch');
const i_uuid = require('uuid');

const api = {
   instance: null,
   gurantee_init: (cb) => {
      if (api.instance) return cb();
      api.instance = new i_es.Client({
         host: 'http://127.0.0.1:9200'
      });
      return cb();
   },
   search: (options) => gurantee_init(() => new Promise((r, e) => {
      if (!options) return r(null);
      let index = options.index;
      let type = options.type;
      let query = options. query;
      let size = options.size || 20;
      api.instance.search({
         index, type, size, q: query
      }, (err, res) => {
         if (res) r(res); else r(null);
      });
   })),
   addoc: (options) => gurantee_init(() => new Promise((r, e) => {
      if (!options) return r(null);
      let index = options.index;
      let type = options.type;
      let doc_id = options.id || i_uuid.v4();
      let doc = options.doc;
      api.instance.exists({
         index, type, id: doc_id
      }, (err, existing) => {
         if (existing) {
            api.instance.update({
               index, type, id: doc_id, body: { doc }
            }, () => {
               r({ index, type, id: doc_id });
            });
         } else {
            api.instance.create({
               index, type, id: doc_id, body: doc
            }, () => {
               r({ index, type, id: doc_id });
            });
         }
      });
   })),
   deldoc: (options) => gurantee_init(() => new Promise((r, e) => {
      if (!options) return r(null);
      let index = options.index;
      let type = options.type;
      let doc_id = options.id || i_uuid.v4();
      api.instance.delete({
         index, type, id: doc_id
      }, () => {
         r({ index, type, id: doc_id });
      });
   })),
};

module.exports = api;
