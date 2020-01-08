// modified zoekt: https://github.com/dna2fork/zoekt
// npm install request
const i_path = require('path');
const i_req = require('request');
const i_common = require('./common');

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

async function request(options) {
   return new Promise((r, e) => {
      i_req(options, (err, res, body) => {
         if (err) return e(err);
         r(body);
      });
   });
}

class LocalFSResult {
   constructor(client, json) {
      this.client = client;
      this.json = json;
   }

   ready() {
      return true;
   }

   extract_projects() {
      return this.json;
   }

   extract_items() {
      let items = this.json.items;
      let r = { items: [] };
      if (!items || !items.length) return r;
      let paths = {};
      items.forEach((item) => {
         let name = i_path.basename(item.filename);
         if (name.startsWith('.')) return;
         let path = i_path.dirname(item.filename);
         let path_obj = paths[path];
         if (!path_obj) {
            path_obj = {};
            path_obj.path = path;
            path_obj.files = {};
            paths[path] = path_obj;
         }
         let file_obj = path_obj.files[name];
         if (!file_obj) {
            file_obj = {};
            file_obj.name = name;
            file_obj.matches = item.matches;
            path_obj.files[name] = file_obj;
         }
      });
      r.items = Object.values(paths);
      r.items.forEach((item) => {
         item.path += '/';
         item.files = Object.values(item.files);
      });
      return r;
   }

   extract_directory() {
      return {
         items: this.json.items.map((x) => {
            return { name: x };
         })
      }
   }
}

const zoekt_api = {
   search: async (zoekt_url, query) => {
      let request_options = {
         method: 'GET',
         url: `${zoekt_url}/search?q=${encodeURIComponent(query)}`,
      };
      let body = await request(request_options);
      try {
         return JSON.parse(body);
      } catch (err) {
         return null;
      }
   },
   fetch: async (zoekt_url, project, path) => {
      let request_options = {
         method: 'GET',
         url: `${zoekt_url}/fsprint?r=${encodeURIComponent(project)}&f=${encodeURIComponent(path)}`,
      };
      let body = await request(request_options);
      try {
         return JSON.parse(body);
      } catch (err) {
         return null;
      }
   },
};

class LocalFSClient {
   constructor(base_url, security_mode, version) {
      this.zoekt_url = base_url;
      this.security_mode = 'noauth';
      this.version = '0.1';
   }

   async _get_projects() {
      let data = await zoekt_api.fetch(this.zoekt_url, '', '/');
      if (!data || data.error) return [];
      return new LocalFSResult(this, data.contents.map(
         (item) => item && item.name
      ).filter(
         (name) => name && !name.startsWith('.') && name.endsWith('/')
      ).map(
         (name) => name.substring(0, name.length - 1)
      ));
   }

   check_authed() {
      return this._get_projects();
   }

   login() {
      return this._get_projects();
   }

   async search(options) {
      let project = options.project;
      let transformed_query = `${options.fullsearch}`;
      if (project && project.length) {
         transformed_query = `r:${project.join(',')} ${transformed_query}`;
      }
      let results = await zoekt_api.search(this.zoekt_url, transformed_query);
      if (!results) return new LocalFSResult(this, { items: [] });
      let items = results.hits.filter((x) => !!x).map((item) => ({
         filename: '/' + item.repository + '/' + item.filename,
         matches: item.matches?item.matches.filter((x) => !!x).map((match) => ({
            lineno: match.linenumber,
            text: match.text,
         })):null
      })).filter((item) => item.matches && item.matches.length);
      return new LocalFSResult(this, { items });
   }

   async xref_dir(options) {
      let path_obj = decode_path(options.path);
      if (!path_obj) return null;
      let data = await zoekt_api.fetch(this.zoekt_url, path_obj.project, path_obj.path);
      if (!data || data.error) return new LocalFSResult(this, {});
      return new LocalFSResult(this, {
         project: path_obj.project,
         path: path_obj.path,
         items: data.contents.filter((x) => !!x).map((item) => item.name),
      });
   }

   async xref_file(options) {
      let path_obj = decode_path(options.path);
      if (!path_obj) return null;
      let data = await zoekt_api.fetch(this.zoekt_url, path_obj.project, path_obj.path);
      if (!data || data.error) return new LocalFSResult(this, {});
      let ret = new LocalFSResult(this, {
         project: path_obj.project,
         path: path_obj.path,
         text: data.contents,
      });
      ret.text = data.contents;
      return ret;
   }

   generate_tasks(query_map, projects, output_task_list, config) {
      return new Promise((r, e) => {
         projects = i_common.query.filter_project(query_map, projects);
         output_task_list.push({
            client: this,
            query: query_map.query,
            projects,
         })
         r();
      });
   }

   get_metadata(path) {
      return i_common.metadata.load(path);
   }

}

module.exports = {
   Result: LocalFSResult,
   Client: LocalFSClient,
};
