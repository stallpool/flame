const i_fs = require('fs');
const i_path = require('path');
const i_interface = require('./interface');
const i_util = require('./utils');

class FileSystemStorage extends i_interface.IStorage {
   constructor(config) {
      super(config);
      if (!config) config = {};
      if (config.base) {
         config.base = i_path.resolve(config.base);
      } else {
         config.base = '/tmp';
      }
   }

   transformToFilename(key) {
      let hash = i_util.md5(key);
      let rename = i_util.base64encode(key);
      let r = [];
      for (let i = 0, n = hash.length; i < n; i += 4) {
         r.push(hash.substring(i, i + 4));
      }
      r.push(rename);
      return `${this.config.base}/${r.join('/')}`;
   }

   createDirectories(path) {
      if(!i_fs.existsSync(path)) {
         let parent_dir = i_path.dirname(path);
         this.createDirectories(parent_dir);
         i_fs.mkdirSync(path);
      }
   }

   get(key) {
      return new Promise((r, e) => {
         let filename = this.transformToFilename(key);
         if (!i_fs.existsSync(filename)) {
            return e(key);
         }
         try {
            return r(i_fs.readFileSync(filename));
         } catch(err) {
            return e(key);
         }
      });
   }

   put(key, value) {
      return new Promise((r, e) => {
         let filename = this.transformToFilename(key);
         let dirname = i_path.dirname(filename);
         this.createDirectories(dirname);
         try {
            i_fs.writeFileSync(filename, value);
            return r();
         } catch (err) {
            return e(key);
         }
      });
   }

   del(key) {
      return new Promise((r, e) => {
         let filename = this.transformToFilename(key);
         if (!i_fs.existsSync(filename)) return e(key);
         try {
            i_fs.unlinkSync(filename);
            return r();
         } catch (err) {
            return e(key);
         }
      })
   }
}

module.exports = {
   Storage: FileSystemStorage,
}