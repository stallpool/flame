class IStorage {
   constructor(config) {
      // config: {
      //    base: it can be a url for storage
      // }
      this.config = config;
   }

   /**
    * key string/array
    * e.g. key = 'hello', value = 'world'
    * e.g. key = ['file', '/bin/cp'], value = true
    */

   get(key) {
      return new Promise((r) => r(null));
   }

   put(key, value) {
      return new Promise((r) => r());
   }
}

module.exports = {
   IStorage,
}