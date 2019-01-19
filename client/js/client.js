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
};
