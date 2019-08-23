
const system = {
   base_dir: process.env.FLAME_METADATA_BASE,
};

class MetaData {
   constructor() {
      this.cache = new i_indexer_keyval.Storage({
         base: system.base_dir
      });
   }

   async load(path) {
      return null;
   }
}

module.exports = {
   MetaData,
}
