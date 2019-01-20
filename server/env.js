const base = __dirname;

const env = {
   base: base,
   debug: !!process.env.FLAME_DEBUG,
   auth_internal: false,
   search_path: process.env.FLAME_SEARCH_PATH,
   ldap_server: process.env.FLAME_LDAP_SERVER,
   keyval: {
      // store key value into file;
      // if null, only in memory
      filename: process.env.FLAME_KEYVAL_FILENAME || null
   },
   admins: process.env.FLAME_ADMINS?process.env.FLAME_ADMINS.split(','):[],
};

module.exports = env;