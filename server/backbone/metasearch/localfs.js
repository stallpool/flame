const i_path = require('path');
const i_fs = require('fs');
const i_utils = require('../../utils');
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

class LocalFSResult {
   constructor(client, json) {
      this.client = client;
      this.json = json;
   }

   ready () {
      return true;
   }

   extract_projects() {
      return this.json;
   }

   extract_items() {
      let r = { items: [] };
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

class LocalFSClient {
   constructor(base_url, security_mode, version) {
      this.base_url = i_path.resolve(base_url);
      this.security_mode = 'noauth';
      this.version = '0.1';
   }

   _get_projects() {
      return new Promise((r, e) => {
         r(new LocalFSResult(this, i_utils.Storage.list_files_without_nest(
            this.base_url
         ).filter(
            (name) => !name.startsWith('.') && name.endsWith('/')
         ).map(
            (name) => name.substring(0, name.length-1)
         )));
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
         // TODO: search in local file system without index
         //       for example, child_process + `grep`
         r(new LocalFSResult(this, { items: [] }));
      });
   }

   xref_dir(options) {
      return new Promise((r, e) => {
         if (!options.path) return e();
         let path_obj = decode_path(options.path);
         if (!path_obj) return e();
         let fullpath = i_path.join(this.base_url, path_obj.project, path_obj.path);
         let files = i_utils.Storage.list_files_without_nest(fullpath);
         files = files.filter((name) => !name.startsWith('.'));
         let result = {
            project: path_obj.project,
            path: path_obj.path,
            items: files
         };
         r(new LocalFSResult(this, result));
      });
   }

   xref_file(options) {
      return new Promise((r, e) => {
         if (!options.path) return e();
         let path_obj = decode_path(options.path);
         if (!path_obj) return e();
         let fullpath = i_path.join(this.base_url, path_obj.project, path_obj.path);
         let name = fullpath.split('/').pop();
         if (!name || name.startsWith('.')) return e();
         let text = null;
         try {
            text = i_fs.readFileSync(fullpath).toString();
         } catch (err) {
            return e();
         }
         let result = {
            project: path_obj.project,
            path: path_obj.path,
            text: text
         }
         let ret = new LocalFSResult(this, result);
         ret.text = result.text;
         r(ret);
      });
   }

   generate_tasks(query_map, projects, output_task_list, config) {
      return new Promise((r, e) => {
         projects = i_common.query.filter_project(query_map, projects);
         output_task_list.push({
            client: this,
            query: query_map.query,
            projects,
         });
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
