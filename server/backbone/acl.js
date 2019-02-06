const i_keyval = require('../keyval');
const i_utils = require('../utils');

/**
 * simple in-memory acl (dump/load in json)
 * 
 * acl.project.<project> = {
 *    user: { include: [] / exclude: [] }
 *       - user: {} init
 *       - user.include after grant_access_to
 *       - user.exlucde after revoke_access_to
 *       - e.g.
 *          - grant_access_to(p1, u1) => only u1 has access to p1
 *          - revoke_access_to(p1, u1) => everyone except u1 has access
 *          - grant_access_to(p1, u1), revoke_access_to(p1, u1) => everyone has access
 *          - grant_access_to(p1, u1), revoke_access_to(p1, u2) => only u1 has access
 *          - revoke_access_to(p1, u1), grant_access_to(p1, u2) => only u2 has access
 * }
 * acl.user.<username> = {
 *    project: { exclude: [] }
 * }
 */

const acl_project_key_prefix = 'acl.project.';
const acl = {
   update_user_acl: (username) => {
      let acl_pkeys = i_keyval.keys('acl.project.*');
      let acl_user = { project: { exclude: [] } };
      acl_pkeys.forEach((acl_pkey) => {
         let acl_project = i_keyval.get(acl_pkey);
         if (acl_project.include) {
            if (acl_project.include.indexOf(username) < 0) {
               acl_user.project.exclude.push(
                  acl_pkey.substring(acl_project_key_prefix.length)
               );
               return;
            }
         }
         if (acl_project.exclude) {
            if (acl_project.exclude.indexOf(username) >= 0) {
               acl_user.project.exclude.push(
                  acl_pkey.substring(acl_project_key_prefix.length)
               );
               return;
            }
         }
      });
      let acl_ukey = `acl.user.${username}`;
      i_keyval.set(acl_ukey, acl_user);
      return acl_user;
   },
   get_user_acl: (username) => {
      let acl_ukey = `acl.user.${username}`;
      let acl_user = i_keyval.get(acl_ukey);
      if (!acl_user) {
         acl.update_user_acl(username);
         acl_user = i_keyval.get(acl_ukey);
      }
      let r = { exclude: [] };
      if (!acl_user) return r;
      if (!acl_user.project) return r;
      return acl_user.project;
   },
   grant_access_to: (project, username) => new Promise((r, e) => {
      let acl_pkey = `acl.project.${project}`;
      let acl_project = i_keyval.get(acl_pkey);
      if (!acl_project) {
         acl_project = {};
         i_keyval.set(acl_pkey, acl_project);
      }
      let index;
      let pending_update_users = [];
      if (acl_project.exclude) {
         index = acl_project.exclude.indexOf(username);
         if (index >= 0) {
            acl_project.exclude.splice(index, 1);
            if (!acl_project.exclude.length) {
               delete acl_project.exclude;
            }
            acl.update_user_acl(username);
            return r(true);
         }
         pending_update_users = acl_project.exclude;
      }
      delete acl_project.exclude;
      if (acl_project.include) {
         index = acl_project.include.indexOf(username);
         if (index < 0) {
            acl_project.include.push(username);
            acl.update_user_acl(username);
         }
      } else {
         acl_project.include = [username];
         acl.update_user_acl(username);
      }
      pending_update_users.forEach((username) => {
         acl.update_user_acl(username);
      });
      return r(true);
   }),
   revoke_access_to: (project, username) => new Promise((r, e) => {
      let acl_pkey = `acl.project.${project}`;
      let acl_project = i_keyval.get(acl_pkey);
      if (!acl_project) {
         acl_project = {};
         i_keyval.set(acl_pkey, acl_project);
      }
      let index;
      if (acl_project.include) {
         index = acl_project.include.indexOf(username);
         if (index >= 0) {
            acl_project.include.splice(index, 1);
            if (!acl_project.include.length) {
               delete acl_project.include;
            }
            acl.update_user_acl(username);
            return r(true);
         }
         return r(true);
      }
      if (acl_project.exclude) {
         index = acl_project.exclude.indexOf(username);
         if (index < 0) {
            acl_project.exclude.push(username);
            acl.update_user_acl(username);
         }
      } else {
         acl_project.exclude = [username];
         acl.update_user_acl(username);
      }
      return r(true);
   })
};

const api = {
   admin: {
      get_access: (req, res, options) => {
         let target_username = options.json.target_username;
         if (!target_username) return i_utils.Web.e400(res);
         i_utils.Web.rjson(res, acl.get_user_acl(target_username));
      },
      grant_access_to: (req, res, options) => {
         let project = options.json.project;
         let target_username = options.json.target_username;
         if (!project || !target_username) return i_utils.Web.e400(res);
         acl.grant_access_to(project, target_username).then(() => {
            i_utils.Web.rjson(res, acl.get_user_acl(target_username));
         });
      },
      revoke_access_to: (req, res, options) => {
         let project = options.json.project;
         let target_username = options.json.target_username;
         if (!project || !target_username) return i_utils.Web.e400(res);
         acl.revoke_access_to(project, target_username).then(() => {
            i_utils.Web.rjson(res, acl.get_user_acl(target_username));
         });
      },
   }
};
i_utils.Web.require_admin_login_batch(api.admin);

module.exports = {
   api, internal_api: acl
};