'use strict';
//@include common.js

var client = {
   search: function (query, env) {
      return new Promise(function (a, r) {
         var robj = {};
         internal_search(a, r, robj);
      });

      function collect(a, obj, name, list) {
         obj[name] = list;
         if (obj.list) {
            return a({
               result: obj.list,
            });
         }
      }

      function internal_search(a, r, robj) {
         ajax({
            url: '/api/v1/search',
            method: 'POST',
            json: {
               username: env.user.username,
               uuid: env.user.uuid,
               query: query
            }
         }, function (list) {
            list = JSON.parse(list);
            collect(a, robj, 'list', list);
         }, function () {
            collect(a, robj, 'list', []);
         });
      }
   }, // search
   browse: {
      get_project_list: function (env, options) {
         return new Promise(function (r, e) {
            if (!options) options = {};
            var json = {
               username: env.user.username,
               uuid: env.user.uuid
            };
            if (options.match) json.m = options.match;
            if (options.query) json.q = options.query;
            ajax({
               url: '/api/metasearch/browse/project',
               method: 'POST',
               json: json
            }, function (result) {
               r(JSON.parse(result));
            }, function () {
               r(null);
            });
         });
      }, // get_project_list
      get_file: function (env, project, path) {
         return new Promise(function (r, e) {
            ajax({
               url: '/api/metasearch/browse/file',
               method: 'POST',
               json: {
                  username: env.user.username,
                  uuid: env.user.uuid,
                  project: project,
                  path: path
               }
            }, function (result) {
               r(JSON.parse(result));
            }, function () {
               r(null);
            });
         });
      }, // get_file
      get_dir: function (env, project, path) {
         return new Promise(function (r, e) {
            ajax({
               url: '/api/metasearch/browse/path',
               method: 'POST',
               json: {
                  username: env.user.username,
                  uuid: env.user.uuid,
                  project: project,
                  path: path
               }
            }, function (result) {
               r(JSON.parse(result));
            }, function () {
               r(null);
            });
         });
      }
   },
   user: {}, // user
   websocket: {
      connect: function (env, options, retried) {
         return new Promise(function (r, e) {
            var url;
            if (window.location.protocol === 'https:') {
               url = 'wss://' + window.location.host;
            } else {
               url = 'ws://' + window.location.host;
            }
            url += '/ws';
            var ws = new WebSocket(url,);
            if (!options) options = {};
            ws.addEventListener('open', options.onopen || function (ev) {
               ws.send(JSON.stringify({
                  cmd: 'auth',
                  username: env.user.username,
                  uuid: env.user.uuid
               }));
               r(ws);
            });
            ws.addEventListener('error', options.onerror || function (ev) {
               console.log('error', ev);
            });
            ws.addEventListener('close', options.onclose || function (ev) {
               console.log('close', ev);
               if (ev.code !== 1005) {
                  if (retried >= 3) {
                     console.error('WebSocket is closed abnormally; crashed...');
                     return;
                  }
                  console.warn('WebSocket is closed abnormally; reconnecting ...')
                  client.websocket.connect(env, options, (retried||0)+1);
                  return;
               }
            });
            ws.addEventListener('message', options.onmessage || function (ev) {
               console.log('message', ev);
            });
         });
      }
   } // websocket
};
