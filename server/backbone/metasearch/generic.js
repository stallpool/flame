const i_keyval = require('../../keyval');
const i_utils = require('../../utils');
const i_metasearch = {
   opengrok_1_x: require('./opengrok_1_x'),
   elasticsearch_6_x: require('./elasticsearch_6_x'),
};

/***** follow the interface to define new type of metasearch integration
 * 
 * interface MetaSearchResult {
 *    ready() {
 *       return result is available (e.g. logged in) in true/false;
 *    }
 * 
 *    extract_directory() {
 *       extract result into list
 *       `items` is a list of file/directory items { name, ... };
 *       return { path, items }
 *    }
 * 
 *    extract_projects() {
 *       extract result into projects
 *       return a list of projects 'string'
 *    }
 * 
 *    extract_items(options) {
 *       extract result into search result item
 *       return {
 *          items: [{
 *             path,
 *             files: [{
 *                name,
 *                matches: [{
 *                   lineno, text
 *                }]
 *             }]
 *          }]
 *       }
 *    }
 * }
 * 
 * interface MetaSearchClient {
 *    constructor(base_url, _mode, _version) {
 *    }
 * 
 *    check_authed() {
 *       return new Promise((r, e) => {
 *          // make sure extract_projects works in result
 *          r(new MetaSearchResult());
 *       });
 *    }
 * 
 *    login(username, password) {
 *       return new Promise((r, e) => {
 *          // make sure extract_projects works
 *          r(new MetaSearchResult());
 *       });
 *    }
 * 
 *    search(options) {
 *       return new Promise((r, e) => {
 *          r(new MetaSearchResult());
 *       });
 *    }
 * 
 *    xref_dir(options) {
 *       options = { path }
 *       return new Promise((r, e) => {
 *          r(new MetaSearchResult());
 *       });
 *    }
 * 
 *    xref_file(options) {
 *       options = { path };
 *       return new Promise((r, e) => {
 *          r(new MetaSearchResult());
 *       });
 *    }
 * }
 */

const keyval_key = 'api.metasearch.state';
const system = {
   project_n_group: 40,
   registry: {}
};
Object.assign(system, i_keyval.get(keyval_key));

function create_metasearch_client(metatype, base_url, security_mode, version) {
   switch (metatype) {
      case 'opengrok':
         return new i_metasearch.opengrok_1_x.Client(base_url, security_mode, version);
      case 'elasticsearch':
         return new i_metasearch.elasticsearch_6_x.Client(base_url, security_mode, version);
   }
}
function get_host_by_project_name(project) {
   let hosts = Object.values(system.registry);
   if (!hosts.length) return null;
   let host = hosts.filter((x) => x.projects.indexOf(project) >= 0)[0];
   return host;
}
const api = {
   admin: {
      list: (req, res, options) => {
         let obj = Object.values(system.registry).map((registry) => {
            return {
               base_url: registry.base_url,
               security_mode: registry.security_mode,
               projects: registry.projects,
            };
         });
         i_utils.Web.rjson(res, obj);
      },
      register: (req, res, options) => {
         let metatype = options.json.metatype;
         let base_url = options.json.base_url;
         let security_mode = options.json.security_mode || 'noauth';
         let auth = options.json.auth;
         let version = options.json.version;

         if (!metatype || !base_url) return i_utils.Web.e400(res);
         if (!i_keyval.get(keyval_key)) i_keyval.set(keyval_key, system);
         let registry = {
            metatype,
            base_url,
            security_mode,
            auth: auth || {},
            projects: [],
            client: create_metasearch_client(
               metatype, base_url, security_mode, version
            ),
         };
         system.registry[base_url] = registry;
         registry.client.check_authed().then((result) => {
            if (result.ready()) {
               registry.projects = result.extract_projects();
            } else {
               registry.client.login(auth.username, auth.password).then((result) => {
                  registry.projects = result.extract_projects();
               });
            }
            res.end('ok');
         }, (err) => {
            res.end('err');
         });
      },
      unregister: (req, res, options) => {
         let base_url = options.json.base_url;

         if (!base_url) return i_utils.Web.e400(res);
         if (!i_keyval.get(keyval_key)) i_keyval.set(keyval_key, system);
         // TODO: remove all related project indexes
         delete system.registry[base_url];
      },
   },
   browse: {
      path: (req, res, options) => {
         let project = options.json.project;
         let path = options.json.path;

         if (!project || !path) return i_utils.Web.e400(res);
         let host = get_host_by_project_name(project);
         // TODO: acl host, project, username
         if (!host) return i_utils.Web.e404(res);
         host.client.xref_dir({
            path: `/${project}${path}`
         }).then((result) => {
            result = result.extract_directory();
            i_utils.Web.rjson(res, {
               project, path,
               items: result ? result.items : []
            });
         });
      },
      file: (req, res, options) => {
         let project = options.json.project;
         let path = options.json.path;

         if (!project || !path) return i_utils.Web.e400(res);
         let host = get_host_by_project_name(project);
         // TODO: acl host, project, username
         if (!host) return i_utils.Web.e404(res);
         host.client.xref_file({
            path: `/${project}${path}`
         }).then((result) => {
            // TODO: check if result is binary or text
            i_utils.Web.rjson(res, {
               project, path,
               text: result.text
            });
         });
      },
   },
};
i_utils.Web.require_admin_login_batch(api.admin);
i_utils.Web.require_login_batch(api.browse);

function websocket_send(ws, json) {
   try {
      ws.send(JSON.stringify(json));
   } catch (e) { }
}

const websocket = {
   acl_filter: (registry, username) => {
      // TODO: filter by username
      var projects = registry.projects;
      return projects;
   },
   generate_tasks: (username) => new Promise((r, e) => {
      let tasks = [];
      Object.values(system.registry).forEach((registry) => {
         let projects = websocket.acl_filter(registry, username);
         let project_n = projects.length;
         if (!project_n) return;
         let group_n = Math.ceil(project_n / system.project_n_group);
         for (let i = 0; i < group_n; i++) {
            tasks.push({
               client: registry.client,
               projects: projects.slice(
                  i * system.project_n_group,
                  (i + 1) * system.project_n_group
               )
            });
         }
      })
      // TODO: filter by username
      r(tasks);
   }),
   rank_tasks: (tasks, query) => new Promise((r, e) => {
      // sample: randomly rank projects;
      tasks = tasks.slice();
      let t, i, j, k, n = tasks.length, m = ~~(n / 2);
      for (i = 0; i < m; i++) {
         j = ~~(Math.random() * n);
         k = ~~(Math.random() * n);
         t = tasks[j];
         tasks[j] = tasks[k];
         tasks[k] = t;
      }
      r(tasks);
   }),
   task_map: (uuid, tasks, query) => new Promise((r, e) => {
      let config_obj = websocket.task_config[uuid];
      if (!config_obj) return e(uuid);
      let i = 0;
      tasks.forEach((task) => {
         task.uuid = uuid;
         task.query = query;
         // scheduler algorithm:
         // existing   A   B   C   A   C   A C C
         //  comming D   D   D   D   D   D
         //       => D A D B D C D A D C D A C C
         if (i >= websocket.task_queue.length) {
            websocket.task_queue.push(task);
            i++;
         } else {
            websocket.task_queue.splice(i, 0, task);
            i += 2;
         }
      });
      r();
   }),
   trigger_task_execute: () => {
      let task = websocket.task_queue.shift();
      if (!task) return;
      let uuid = task.uuid;
      let config = websocket.task_config[uuid];
      if (!config) return next();
      task.client.search({
         fullsearch: task.query,
         project: task.projects,
      }).then((result) => {
         let obj = result.extract_items();
         dec_and_update(config);
         websocket_send(config.ws, {
            uuid: config.uuid,
            result: obj,
            count: config.count,
         });
         next(config);
      }, (err) => {
         // TODO: error handle
         dec_and_update(config);
         next(config);
      });

      function dec_and_update(config) {
         config.count--;
         if (config) {
            if (!config.count) {
               config.status.val = 'complete';
            }
         }
      }
      function next() {
         if (websocket.task_queue.length) {
            setTimeout(websocket.trigger_task_execute);
         }
      }
   },
   task_config: {},
   task_queue: [],
   search: (uuid, ws, options) => new Promise((r, e) => {
      let config = {
         uuid, ws, status: { val: 'pending' }, count: 0
      };
      websocket.task_config[uuid] = config;
      websocket.generate_tasks(options.username).then((tasks) => {
         if (tasks.length) {
            websocket_send(config.ws, {
               result: null,
               count: tasks.length,
            });
         } else {
            config.status.val = 'complete';
            websocket_send(config.ws, {
               result: null,
               count: 0,
            });
            return r();
         }
         websocket.rank_tasks(tasks, options.query).then((tasks) => {
            config.count = tasks.length;
            websocket.task_map(uuid, tasks, options.query).then(() => {
               config.status.val = 'planned';
               websocket.trigger_task_execute();
               r();
            }, e); // map
         }, e); // rank
      }, e); // filter
   }),
   cancel: (uuid) => new Promise((r, e) => {
      let config = websocket.config[uuid];
      if (!config) return e(uuid);
      delete websocket.config[uuid];
      websocket.task_queue = websocket.task_queue.filter(
         (task) => task.uuid !== uuid
      );
      r();
   })
};

module.exports = {
   api, websocket
};
