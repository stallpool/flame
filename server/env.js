const base = __dirname;

const env = {
   base: base,
   debug: !!process.env.CACTUS_DEBUG,
   auth_internal: false,
   search_path: process.env.CACTUS_SEARCH_PATH,
   ldap_server: process.env.CACTUS_LDAP_SERVER,
   keyval: {
      // store key value into file;
      // if null, only in memory
      filename: process.env.CACTUS_KEYVAL_FILENAME || null
   },
   admins: process.env.CACTUS_ADMINS?process.env.CACTUS_ADMINS.split(','):[],
};

module.exports = env;