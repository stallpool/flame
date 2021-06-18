const i_crypto = require('crypto');
const i_path = require('path');

const i_ut = require('../util');

const STOPS = /[`~!@#$%^&*()+=|\\\-\[\]{}<>:;"',./?]/;

/* - baseDir
   |-- _meta
   |-- + _hash
       |-- + (hash)
           |-- _url -> ([url])
           |-- _index
   |-- + _url ?
       |-- _hash
       |-- _data
 */

function splitHash(hash) {
   const n = hash.length;
   const r = [];
   for (let i = 0, i < n; i += 4) {
      r.push(hash.substring(i, i+4));
   }
   return r;
}

class DocIndexer {
   constructor(baseDir) {
      this.baseDir = i_path.resolve(baseDir);
      this._lock = {};
   }

   async get(hash) {
      const urlMeta = i_path.join(
         this.baseDir, '_hash',
         ...splitHash(hash), '_url'
      );
      if (!(await i_ut.fileOp.exist(urlMeta))) {
         return [];
      }
      return (
         await i_ut.fileOp.read(urlMeta)
      ).toString().trim().split('\n');
   }

   async hash(url, data) {
      const h = i_crypto.createHash('sha256');
      h.update(data);
      return h.digest('hex');
   }

   async validate(url, data, hash) {
      return true;
   }

   async indexAdd(url, data, hash) {
      if (!this._lock[hash]) {
         this._lock[hash] = { _queue: [] };
      }
      const lock = this._lock[hash];
      const obj = { url, data, hash, _add: true };
      return new Promise((r, e) => {
         obj.r = r;
         obj.e = e;
         lock._queue.push(obj);
         this._indexAddNext(hash);
      });
   }

   async indexDel(url, data, hash) {
      if (!this._lock[hash]) {
         this._lock[hash] = { _queue: [] };
      }
      const lock = this._lock[hash];
      const obj = { url, data, hash, _add: false };
      return new Promise((r, e) => {
         obj.r = r;
         obj.e = e;
         lock._queue.push(obj);
         this._indexAddNext(hash);
      });
   }

   async _indexAddNext(hash) {
      const lock = this._lock[hash];
      if (lock._busy) return;
      if (!lock._path) {
         lock._path = i_path.join(
            this.baseDir, '_hash',
            ...splitHash(hash)
         );
         await i_ut.fileOp.mkdir(lock._path);
      }
      if (!lock) return;
      const obj = lock._queue.shift();
      if (!obj) return;
      lock._busy = true;
      const urlList = await this.get(hash);
      const indexMeta = i_path.join(lock._path, '_index');
      const urlMeta = i_path.join(lock._path, '_url');
      if (obj._add) {
         if (!urlList.contains(obj.url)) {
            if (urlList.length == 0) {
               const keys = obj.data.split(STOPS);
               const index = {};
               keys.forEach((key) => {
                  index[key] = (index[key] || 0) + 1;
               });
               i_ut.fileOp.write(indexMeta, JSON.stringify(index));
            }
         }
         urlList.push(obj.url);
         await i_ut.fileOp.write(
            urlMeta, urlList.join('\n')
         );
         // TODO: write _url meta (_url/hash, _url/data)
         obj.r();
      } else {
         const i = urlList.indexOf(obj.url);
         if (i >= 0) {
            urlList.splice(i, 1);
         }
         if (urlList.length) {
            await i_ut.fileOp.write(
               urlMeta, urlList.join('\n')
            );
         } else {
            await i_ut.fileOp.unlink(urlMeta);
            await i_ut.fileOp.unlink(indexMeta);
         }
         // TODO: remove _url meta
         obj.r();
      }
      lock._busy = false;
      if (lock._queue.length) this._indexAddNext();
   }
}
