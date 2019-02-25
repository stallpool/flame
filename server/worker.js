const i_keyval = require('./keyval');
const i_env = require('./env');

const LOGIN_TIMEOUT = 7 * 24 * 3600 * 1000;

function cronCleanAuthToken() {
   setInterval(() => {
      i_keyval.keys('auth.*').forEach((key) => {
         let auth_obj = i_keyval.get(key);
         if (new Date().getTime() - auth_obj.login > LOGIN_TIMEOUT) {
            i_keyval.set(key, null);
         }
      });
   }, 3600*1000);
}

function cronDumpKeyVal() {
   if (!i_env.keyval.filename) return;
   i_keyval.load(i_env.keyval.filename);
   setInterval(() => {
      i_keyval.save(i_env.keyval.filename)
   }, 10000);
}

module.exports = {
   cronCleanAuthToken,
   cronDumpKeyVal
};