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
   user: {}, // user
   websocket: {
      connect: function (env, retried) {
         var url;
         if (window.location.protocol === 'https:') {
            url = 'wss://' + window.location.host;
         } else {
            url = 'ws://' + window.location.host;
         }
         url += '/ws';
         var ws = new WebSocket(url,);
         ws.addEventListener('open', function (ev) {
            ws.send(JSON.stringify({
               cmd: 'auth',
               username: env.user.username,
               uuid: env.user.uuid
            }));
         });
         ws.addEventListener('error', function (ev) {
            console.log('error', ev);
         });
         ws.addEventListener('close', function (ev) {
            console.log('close', ev);
            if (ev.code !== 1005) {
               if (retried >= 3) {
                  console.error('WebSocket is closed abnormally; crashed...');
                  return;
               }
               console.warn('WebSocket is closed abnormally; reconnecting ...')
               client.websocket.connect(env, (retried||0)+1);
               return;
            }
         });
         ws.addEventListener('message', function (ev) {
            console.log('message', ev);
         });
         return ws;
      }
   } // websocket
};
