const i_path = require('path');
const i_fs = require('fs');
const i_exec = require('child_process').exec;
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
      let items = this.json.items;
      let r = { items: [] };
      if (!items || !items.length) return r;
      let cache = { filename: null, text: null, lineno: 1 };
      let paths = {};
      items.forEach((item) => {
         let name = i_path.basename(item.path);
         if (name.startsWith('.')) return;
         let path = i_path.dirname(item.path);
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
            file_obj.matches = [];
            path_obj.files[name] = file_obj;
         }
         if (cache.filename !== item.path) {
            cache.filename = item.path;
            cache.text = i_fs.readFileSync(
               i_path.join(this.client.base_url, item.path)
            ).toString().split('\n');
         }
         for (let i = 0, n = cache.text.length; i < n; i++) {
            let line = cache.text[i];
            let text = item.text;
            if (text.length > 100) text = text.substring(0, 100);
            if (line.startsWith(text)) {
               file_obj.matches.push({
                  lineno: cache.lineno + i,
                  text: item.text,
               });
               cache.lineno = cache.lineno + i + 1;
               cache.text = cache.text.slice(i + 1);
               break;
            }
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
      let _this = this;
      return new Promise((r, e) => {
         // TODO: search in local file system without index
         //       for example, child_process + `grep`
         if (!options) options = {};
         let project = options.project;
         if (!project || !project.length) project = [''];
         let items = [];
         grep_one_project(project, items, () => {
            r(new LocalFSResult(this, { items }));
         });
      });

      function grep_one_project(project_list, item_list, cb) {
         if (!project_list.length) {
            cb && cb(item_list);
            return;
         }
         let project_name = project_list.pop();
         if (project_name) project_name = `/${project_name}`; else project_name = '';
         let query = options.fullsearch
            .replace(/\\/g, '')
            .replace(/"/g, '')
            .replace(/[$]/g, '');
         i_exec(
            `grep "${query}" "${_this.base_url}${project_name}" -r`,
            (err, stdout, stderr) => {
               stdout = stdout.split('\n');
               stdout.forEach((line) => {
                  if (!line) return;
                  let i = line.indexOf(':');
                  if (i < 0) return;
                  let filename = line.substring(0, i);
                  filename = filename.substring(_this.base_url.length);
                  let text = line.substring(i + 1);
                  if (text.length > 100) text = text.substring(0, 100) + ' ...';
                  item_list.push({
                     path: filename,
                     text: text,
                  });
               });
               grep_one_project(project_list, item_list, cb);
            }
         );
      }
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
