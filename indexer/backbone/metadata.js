class MetaDataService {
   constructor(storage) {
      this.storage = storage;
   }

   joinKeys(tags) {
      if (Array.isArray(tags)) {
         return tags.join('\t');
      } else {
         return tags;
      }
   }

   _getKey (key) {
      return new Promise((r, e) => {
         this.storage.get(key).then((data) => {
            if (!data) return e(data);
            let result = data.toString();
            if (!result) return r(null);
            try {
               result = JSON.parse(result);
            } catch(e) {
               return e(data);
            }
            r(result);
         }, e);
      });
   }

   getKey(tags) {
      let key = this.joinKeys(tags);
      return this._resolveKeyRedirect(key);
   }

   _resolveKeyRedirect(key) {
      return new Promise((r, e) => {
         this._getKey(key).then((json) => {
            if (!json) return r(json);
            if (typeof(json) === 'string') {
               this._resolveKeyRedirect(json).then(r, e);
            } else {
               r(json);
            }
         }, e);
      });
   }

   resolveKeyRedirect(tags) {
      let key = this.joinKeys(tags);
      return this._resolveKeyRedirect(key);
   }

   _putKey(key, json) {
      return new Promise((r, e) => {
         let data;
         try {
            data = JSON.stringify(json);
         } catch(e) {
            return e(json);
         }
         this.storage.put(key, data).then(r, e);
      });
   }

   putKey(tags, json) {
      let key = this.joinKeys(tags);
      return this._putKey(key, json);
   }

   _delKey(key) {
      return this.storage.del(key);
   }

   delKey(tags) {
      let key = this.joinKeys(tags);
      return this._delKey(key);
   }

   linkKey(tags1, tags2) {
      let key1 = this.joinKeys(tags1);
      let key2 = this.joinKeys(tags2);
      return this.putKey(key1, key2);
   }

   solidateLinkedKey(tags) {
      let key = this.joinKeys(tags);
      return new Promise((r, e) => {
         this._resolveKeyRedirect(key).then((data) => {
            this._putKey(key, data);
            r(data);
         }, e);
      });
   }
}

module.exports = {
   MetaDataService,
};