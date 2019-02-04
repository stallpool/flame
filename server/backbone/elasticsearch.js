const i_es = require('elasticsearch');
const i_uuid = require('uuid');

class ElasticSearchClient {
   constructor(host) {
      this.host = host;
      this.client = new i_es.Client({ host });
   }

   search(options) {
      return new Promise((r, e) => {
         if (!options) return r(null);
         let index = options.index;
         let type = options.type;
         let query = options.query;
         let size = options.size || 20;
         let request_options = {
            index, type, size
         };
         if (typeof(query) === 'string') {
            request_options.q = query;
         } else {
            request_options.body = query;
         }
         this.client.search(request_options, (err, res) => {
            if (res) r(res); else r(null);
         });
      });
   }

   addoc(options) {
      return new Promise((r, e) => {
         if (!options) return r(null);
         let index = options.index;
         let type = options.type;
         let doc_id = options.id || i_uuid.v4();
         let doc = options.doc;
         this.client.exists({
            index, type, id: doc_id
         }, (err, existing) => {
            if (existing) {
               this.client.update({
                  index, type, id: doc_id, body: { doc }
               }, () => {
                  r({ index, type, id: doc_id });
               }, e);
            } else {
               this.client.create({
                  index, type, id: doc_id, body: doc
               }, () => {
                  r({ index, type, id: doc_id });
               }, e);
            }
         });
      });
   }

   deldoc(options) {
      return new Promise((r, e) => {
         if (!options) return r(null);
         let index = options.index;
         let type = options.type;
         let doc_id = options.id;
         let doc_query = options.query;
         if (doc_id) {
            this.client.delete({
               index, type, id: doc_id
            }, () => {
               r({ index, type, id: doc_id });
            }, e);
         } else if (doc_query) {
            let request_options = {
               index, type
            };
            if (typeof(query) === 'string') {
               request_options.q = query;
            } else {
               request_options.body = query;
            }
            this.client.deleteByQuery(request_options, () => {
               r({ index, type, query: doc_query });
            }, e);
         } else {
            r(null);
         }
      });
   }

   getdoc(options) {
      return new Promise((r, e) => {
         if (!options) return r(null);
         let index = options.index;
         let type = options.type;
         let doc_id = options.id;
         this.client.get({
            index, type, id: doc_id
         }, (err, res) => {
            if (res) r(res); else e(null);
         })
      });
   }
}

module.exports = {
   Client: ElasticSearchClient
};
