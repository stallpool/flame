const i_fs = require('fs');
const i_path = require('path');
const i_utils = require('../../utils');

const system = {
   cache_capacity: 
      parseInt(
         process.env.FLAME_METADATA_CACHE_CAPACITY || '16'
      ) * 1024 * 1024 /* in MB, default 16 MB */,
   base_dir: process.env.FLAME_METADATA_BASE,
};

class Cache {
   constructor(capcity) {
      this.capacity = capcity;
      this.size = 0;
      this.cache = {};
   }

   load(filename) {
      if (!i_fs.existsSync(filename)) return null;
      let data = i_fs.readFileSync(filename);
      return data;
   }
}

class MetaData {
   constructor() {
      if (system.base_dir) {
         this.cache = new Cache(system.cache_capacity);
      } else {
         this.cache = null;
      }
   }

   load(path) {
      return new Promise((r) => {
         if (!this.cache) return r(null);
         let filename = i_path.join(system.base_dir, path);
         let item = this.cache.load(filename);
         if (item) {
            item = JSON.parse(item);
         }
         return r(item);
      });
   }
}

module.exports = {
   MetaData,
}