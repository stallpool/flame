const i_uuid = require('uuid');
const i_keyval = require('./keyval');
const i_env = require('./env');

const api = {
   authenticate: (username, password) => new Promise((resolve, reject) => {
      // no auth
      // ldap integration: api.authenticate = api.authenticate_for_ldap
      if (i_env.ldap_server) {
         return this.authenticate_for_ldap(username, password).then(resolve, reject);
      }
      resolve(keyval_setauth(username));
   }),
   check_login: (username, uuid) => {
      let meta = i_keyval.get(keyval_authkey(username, uuid));
      if (!meta) return null;
      return meta;
   },
   authenticate_for_ldap: (username, password) => new Promise((resolve ,reject) => {
      const i_ldap = require('ldapjs');
      let client = i_ldap.createClient({
         url: i_env.ldap_server
      });
      client.bind(username, password, (error) => {
         client.unbind();
         if (error) {
            reject({username, error});
         } else {
            resolve(keyval_setauth(username));
         }
      });
   }),
   clear: (username, uuid) => {
      return i_keyval.set(keyval_authkey(username, uuid));
   },
   keyval_setauth,
   keyval_authkey,
};

function keyval_authkey(username, uuid) {
   return `auth.${username}.${uuid}`;
}

function keyval_setauth(username, login_timestamp) {
   let keys = i_keyval.keys(`auth.${username}.*`);
   keys.forEach((key) => {
      i_keyval.set(key, null);
   });
   let meta = {
      login: login_timestamp || new Date().getTime()
   };
   let uuid = i_uuid.v4();
   i_keyval.set(keyval_authkey(username, uuid), meta);
   return {username, uuid};
}

module.exports = api;