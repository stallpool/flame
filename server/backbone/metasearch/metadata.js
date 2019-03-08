const i_indexer_keyval = require('../../../indexer/storage/filesystem');

const system = {
   base_dir: process.env.FLAME_METADATA_BASE,
};

class MetaData {
   constructor() {
      this.cache = new i_indexer_keyval.Storage({
         base: system.base_dir
      });
   }

   load(path) {
      return new Promise((r) => {
         if (!this.cache) return r(null);
         let name = path.split('/');
         let project = name[1];
         let project_path = '/' + name.slice(2).join('/');
         let key = `${project}\t${project_path}\tinfo`;
         this.cache.get(`${project}\t${project_path}\tinfo`).then((data) => {
            if (!data) return r(null);
            let json = JSON.parse(data);
            r(json);
         }, () => {
            r(null);
         });
      });
   }
}

module.exports = {
   MetaData,
}
