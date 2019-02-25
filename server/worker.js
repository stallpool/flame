const i_keyval = require('./keyval');
const i_env = require('./env');
const i_metasearch = require('./backbone/metasearch/generic');

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
   let system = i_keyval.get(i_metasearch.name);
   if (system && system.registry) {
      Object.values(system.registry).forEach((item) => {
         i_metasearch.register_client(
            item.metatype,
            item.base_url,
            item.version,
            item.security_mode,
            item.auth
         );
      });
   }
   setInterval(() => {
      let obj = i_keyval.get(i_metasearch.name);
      let backup_registry = null;
      if (obj && obj.registry) {
         backup_registry = Object.assign({}, obj.registry);
         Object.values(obj.registry).forEach((registry) => {
            delete registry.client;
            delete registry.projects;
         });
      }
      i_keyval.save(i_env.keyval.filename);
      if (obj && backup_registry) {
         obj.registry = backup_registry;
         i_keyval.set(i_metasearch.name, obj);
      }
   }, 10000);
}

module.exports = {
   cronCleanAuthToken,
   cronDumpKeyVal
};