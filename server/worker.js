const i_keyval = require('./keyval');

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

module.exports = {
   cronCleanAuthToken
};