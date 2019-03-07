const i_fs = require('fs');
const i_path = require('path');
const i_filesystem = require('../storage/filesystem');
const i_metadata = require('./metadata');
const i_tokenizer = require('./tokenizer');
const i_xref = require('./xref');

/**
 * Operator:
 * DirectoryScan -> base, key(project) => { file_list: [] }
 * FileTokenScan -> base, key(project, filename) => { rawTokens: [] }
 * TokenXref     -> base, key(project, filename) => { tokens: [] }
 * TokenCleanUp  -> base, key(project, filename) => { del rawTokens }
 */

function error(obj, message) {
   return { obj, message };
}

class Operator {
   constructor(config) {
      this.config = config;
      this.storage = new i_filesystem.Storage(config);
      this.keyval = new i_metadata.MetaDataService(this.storage);
      this.progress = null;
   }

   act(options) {
      return new Promise((r) => r());
   }

   getProgress() {
      return this.progress;
   }
}

class DirectoryScanOperator extends Operator {
   constructor(config) {
      super(config);
   }

   act(options) {
      return new Promise((r, e) => {
         if (!options) options = {};
         if (!options.base) return e(error(options));
         if (!options.project) return e(error(options));
         let project_path = i_path.join(options.base, options.project);
         let queue = [];
         let list = [];
         listDirectory(project_path, queue, list, null, () => {
            this.keyval.putKey(options.project, {
               file_list: list.map((x) => x.substring(project_path.length))
            }).then(r, e);
         }, e);
      });

      function listDirectory(path, queue, list, filter, r, e) {
         i_fs.readdir(path, (err, name_list) => {
            if (err) return e(error(err));
            name_list.forEach((name) => {
               let filename = i_path.join(path, name);
               let state = i_fs.lstatSync(filename);
               if (state.isDirectory()) {
                  if (!filter || filter(filename)) {
                     queue.push(filename);
                  }
               } else if (!filter || filter(filename)) {
                  list.push(filename);
               }
            });
            if (queue.length) {
               listDirectory(queue.pop(), queue, list, filter, r, e);
            } else {
               r();
            }
         });
      }
   }
}

class FileTokenScanOperator extends Operator {
   constructor(config) {
      super(config);
   }

   act(options) {
      //@depend DirectoryScanOperator
      let keyval = this.keyval;
      return new Promise((r, e) => {
         if (!options) options = {};
         if (!options.base) return e(error(options));
         if (!options.project) return e(error(options));
         this.keyval.getKey(options.project).then((project_info) => {
            let file_list = project_info.file_list;
            if (!file_list) return e(error(options));
            extractToken(options.base, options.project, file_list, r, e);
         }, e);
      });

      function extractToken(base, project, file_list, r, e) {
         if (!file_list.length) {
            return r();
         }
         let path = file_list.pop();
         path = `${base}/${project}${path}`;
         i_tokenizer.tokenize(path).then((tokens) => {
            keyval.putKey([project, path, 'raw_tokens'], tokens).then(() => {
               extractToken(base, project, file_list, r, e);
            }, () => {
               console.log('[error/io]', base, project, path);
               extractToken(base, project, file_list, r, e);
            });
         }, () => {
            console.log('[error/tokenize]', base, project, path);
            extractToken(base, project, file_list, r, e);
         });
      }
   }
}

class TokenXrefOperator extends Operator {
   constructor(config) {
      super(config);
   }

   act(options) {
      //@depend FileTokenScanOperator
      return new Promise((r, e) => {
         if (!options) options = {};
         if (!options.base) return e(error(options));
         if (!options.project) return e(error(options));
         i_xref.c_xref(options, this.keyval).then(r, e);
      });
   }
}

class TokenCleanUpOperator extends Operator {
   constructor(config) {
      super(config);
   }

   act(options) {
      //@depend TokenXrefOperator
      return new Promise((r, e) => {
         if (!options) options = {};
         if (!options.base) return e(error(options));
         if (!options.project) return e(error(options));
         r();
      });
   }
}

class ProjectScanOperator extends Operator {
   constructor(config) {
      super(config);
   }

   act(options) {
      return new Promise((r, e) => {
         if (!options) options = {};
         if (!options.base) return e(error(options));
         new DirectoryScanOperator(this.config).act(options).then(() => {
            return Promise.resolve(null);
            return new FileTokenScanOperator(this.config).act(options);
         }, e).then(() => {
            return new TokenXrefOperator(this.config).act(options);
         }, e).then(() => {
            return new TokenCleanUpOperator(this.config).act(options);
         }, e).then(() => {
            return r();
         }, e);
      });
   }
}

module.exports = {
   Operator,
   DirectoryScanOperator,
   FileTokenScanOperator,
   TokenXrefOperator,
   ProjectScanOperator,
}