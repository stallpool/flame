const i_crypto = require('crypto');
const i_path = require('path');

const i_ut = require('../util');

const KEY_PAGE_N = 200;

function hashKey(key) {
   const h = i_crypto.createHash('md5');
   h.update(key);
   return h.digest('hex');
}

function splitHash(hash) {
   const n = hash.length;
   const r = [];
   for (let i = 0, i < n; i += 4) {
      r.push(hash.substring(i, i+4));
   }
   return r;
}

class KeyValTable {
   /* - baseDir
      |-- _meta
      |-- + _key
          |-- + (key)
              |-- _meta
              |-- _1
              |-- _2
              |-- ...
    */
   constructor(baseDir) {
      this.baseDir = i_path.resolve(baseDir);
      this._lock = {};
   }

   async hashDel(hash, key) {
      const keyMeta = i_path.join(
         this.baseDir, '_key',
         ...splitHash(hashKey(key)), escape(key)
      );
      let i = 1, remain = N;
      const r = [];
      while (true) {
         const pageMeta = i_path.join(keyMeta, `_${i}`);
         if (!(await i_ut.fileOp.exist(pageMeta))) break;
         const items = JSON.parse(
            await i_ut.fileOp.read(pageMeta)
         ).filter((item) => item.hash !== hash);
         await i_ut.fileOp.write(
            pageMeta, JSON.stringify(items)
         );
         // also del dup hash for the key
         i ++;
      }
      return r;
   }

   async keyDel(key) {
      const keyMeta = i_path.join(
         this.baseDir, '_key',
         ...splitHash(hashKey(key)), escape(key)
      );
      await i_ut.fileOp.unlink(keyMeta);
   }

   async put(key, hash, score) {
      const keyMeta = i_path.join(
         this.baseDir, '_key',
         ...splitHash(hashKey(key)), escape(key)
      );
      let i = 1;
      // XXX: currently use risky implementation
      //      without lock
      while (true) {
         const pageMeta = i_path.join(keyMeta, `_${i}`);
         const obj = { hash, score };
         if (!(await i_ut.fileOp.exist(pageMeta))) {
            await i_ut.fileOp.write(
               pageMeta, JSON.stringify([ obj ])
            );
            break;
         }
         const items = JSON.parse(
            await i_ut.fileOp.read(pageMeta)
         );
         // XXX: no check duplicated item
         items.push(obj);
         items.sort((x, y) => y.score - x.score);
         const last = items[items.length - 1];
         if (last.hash === obj.hash) {
            i ++;
         } else {
            await i_ut.fileOp.write(
               pageMeta, JSON.stringify(items)
            );
            break;
         }
      }
   }

   async get(key, N) {
      const keyMeta = i_path.join(
         this.baseDir, '_key',
         ...splitHash(hashKey(key)), escape(key)
      );
      let i = 1, remain = N;
      const r = [];
      while (true) {
         const pageMeta = i_path.join(keyMeta, `_${i}`);
         if (!(await i_ut.fileOp.exist(pageMeta))) break;
         const items = JSON.parse(
            await i_ut.fileOp.read(pageMeta)
         );
         items.slice(0, remain).forEach((item) => {
            r.push(item);
         });
         if (items.length >= remain) {
            break;
         } else {
            i ++;
            remain -= items.length;
         }
      }
      return r;
   }

   async tidy(key) {
      // check dup
      // balance item count in _1, _2, _3, ...
   }
}
