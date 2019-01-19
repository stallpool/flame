'use strict';

var vqofenv = {
   hostname: window.location.hostname
};

function dom(selector) {
   return document.querySelector(selector);
}

function ajax(options, done_fn, fail_fn) {
   var xhr = new XMLHttpRequest(),
      payload = null;
   xhr.open(options.method || 'POST', options.url + (options.data ? uriencode(options.data) : ''), true);
   xhr.addEventListener('readystatechange', function (evt) {
      if (evt.target.readyState === 4 /*XMLHttpRequest.DONE*/) {
         if (~~(evt.target.status / 100) === 2) {
            done_fn && done_fn(evt.target.response);
         } else {
            fail_fn && fail_fn(evt.target.status);
         }
      }
   });
   if (options.json) {
      xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
      payload = JSON.stringify(options.json);
   }
   xhr.send(payload);
}

function html(url, done_fn, fail_fn) {
   var xhr = new XMLHttpRequest(),
      payload = null;
   xhr.open('GET', url, true);
   xhr.addEventListener('readystatechange', function (evt) {
      if (evt.target.readyState === 4 /*XMLHttpRequest.DONE*/) {
         if (~~(evt.target.status / 100) === 2) {
            done_fn && done_fn(evt.target.response || '<!-- empty -->');
         } else {
            fail_fn && fail_fn(evt.target.status);
         }
      }
   });
   xhr.send(null);
}

function get_cookie() {
   var items = document.cookie;
   var r = {};
   if (!items) return r;
   items.split(';').forEach(function (one) {
      var p = one.indexOf('=');
      if (p < 0) r[one.trim()] = null;
      else r[one.substring(0, p).trim()] = one.substring(p + 1).trim();
   });
   return r;
}

function set_cookie(key, value) {
   document.cookie = key + '=' + escape(value) + ';domain=' + vqofenv.hostname;
}

function erase_cookie(key) {
   document.cookie = key + '=0;expires=Thu, 01 Jan 1970 00:00:01 GMT';
}

function reload_on_hashchange() {
   window.addEventListener('hashchange', function () {
      window.location.reload(true);
   });
}

function encode_url_for_login(path) {
   var r = '/login.html#' + path + ':';
   if (window.location.hash) {
      r += window.location.hash.substring(1);
   }
   if (window.location.search) {
      r += window.location.search;
   }
   return r;
}

function remove_elem(elem) {
   elem.parentNode.removeChild(elem);
}

function dispose_component(component) {
   var elem = component.dom;
   remove_elem(elem);
   component.dom = null;
   component.ui = null;
}

function login_and_start(env, before_init, init_app, redirect_url) {
   if (!redirect_url) redirect_url = '/login.html';
   before_init && before_init();
   var cookie = get_cookie();
   env.user = {
      username: cookie.vqof_username,
      uuid: cookie.vqof_uuid
   };
   if (!env.user.username || !env.user.uuid) {
      window.location = redirect_url;
      return;
   }
   ajax({
      url: '/api/auth/check',
      json: {
         username: env.user.username,
         uuid: env.user.uuid
      }
   }, function () {
      init_app();
   }, function () {
      window.location = redirect_url;
   });
}