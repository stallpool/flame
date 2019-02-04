const i_path = require('path');
const i_fs = require('fs');
const i_es = require('../elasticsearch');
const i_utils = require('../../utils');

const es_index = {
   latest_lines: {
      name: 'latest_lines',
      type: 'a',
   },
   project_info: {
      name: 'project_info',
      type: 'a',
   }
};

function decode_path(path) {
   if (!path) return null;
   path = path.split('/');
   if (path.length <= 2) return null;
   let project = path[1];
   path = path.slice(2);
   path.unshift('');
   return {
      project,
      path: path.join('/')
   }
}

class ElasticSearchResult {
   constructor(client, json) {
      this.client = client;
      this.json = json;
   }

   ready () {
      return true;
   }

   extract_projects() {
      if (!this.json) return [];
      let list = this.json.hits.hits;
      this.client.project_map = {};
      list.forEach((x) => {
         this.client.project_map[x._source.name] = x._source.path;
      });
      return list.map((x) => x._source.name);
   }

   extract_items() {
      let r = { items: [] };
      if (!this.json) return r;
      let list = this.json.hits.hits;
      let map = {};
      list.forEach((x) => {
         let filepath = `/${x._source.project}/${x._source.path}`;
         filepath = filepath.split('/');
         let name = filepath.pop();
         let path = filepath.join('/');
         let path_obj = map[path];
         if (!path_obj) {
            path_obj = { path, files: {} };
            map[path] = path_obj;
         }
         let file_obj = path_obj.files[name];
         if (!file_obj) {
            file_obj = { name, matches: [] };
            path_obj.files[name] = file_obj;
         }
         file_obj.matches.push({
            lineno: x._source.lineno,
            text: x._source.line,
         });
      });
      list = Object.values(map);
      list.forEach((path_obj) => {
         path_obj.files = Object.values(path_obj.files);
         path_obj.files.forEach((file_obj) => {
            file_obj.matches = file_obj.matches.sort((a, b) => a.lineno - b.lineno);
         });
      });
      return {
         path: `/${this.json.project}${this.json.path}`,
         items: list
      };
   }

   extract_directory() {
      return {
         items: this.json.items.map((x) => {
            return { name: x };
         })
      }
   }
}

class ElasticSearchClient {
   constructor(base_url, security_mode, version) {
      this.base_url = base_url;
      this.client = new i_es.Client(base_url);
      this.security_mode = security_mode || 'noauth';
      this.version = version || '6.x';
      this.project_map = null;
   }

   _get_projects() {
      return new Promise((r, e) => {
         this.client.search({
            index: es_index.project_info.name,
            type: es_index.project_info.type,
            size: 1000,
            query: {}
         }).then((project_list) => {
            if (!project_list) return e();
            r(new ElasticSearchResult(this, project_list));
         }, e);
      });
   }

   check_authed() {
      return this._get_projects();
   }

   login() {
      return this._get_projects();
   }

   search(options) {
      return new Promise((r, e) => {
         if (!options) return e(options);
         let query = options.fullsearch;
         if (!query) return e(options);
         this.client.search({
            index: es_index.latest_lines.name,
            type: es_index.latest_lines.type,
            size: 100,
            query: {
               query: {
                  match: {
                     line: query
                  }
               }
            }
         }).then((result) => {
            if (!result) return e();
            r(new ElasticSearchResult(this, result));
         }, e);
      });
   }

   xref_dir(options) {
      return new Promise((r, e) => {
         if (!this.project_map) return e();
         if (!options.path) return e();
         let path_obj = decode_path(options.path);
         if (!path_obj) return e();
         let project_name = this.project_map[path_obj.project];
         if (!project_name) return e();
         let fullpath = i_path.join(project_name, path_obj.path);
         let files = i_utils.Storage.list_files_without_nest(fullpath);
         let result = {
            project: path_obj.project,
            path: path_obj.path,
            items: files
         };
         r(new ElasticSearchResult(this, result));
      });
   }

   xref_file(options) {
      return new Promise((r, e) => {
         if (!this.project_map) return e();
         if (!options.path) return e();
         let path_obj = decode_path(options.path);
         if (!path_obj) return e();
         let project_path = this.project_map[path_obj.project];
         if (!project_path) return e();
         let fullpath = i_path.join(project_path, path_obj.path);
         let text = i_fs.readFileSync(fullpath).toString();
         let result = {
            project: path_obj.project,
            path: path_obj.path,
            text: text
         }
         let ret = new ElasticSearchResult(this, result);
         ret.text = result.text;
         r(ret);
      });
   }
}

module.exports = {
   Result: ElasticSearchResult,
   Client: ElasticSearchClient,
};
