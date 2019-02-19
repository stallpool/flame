'use strict';
//@include common.js
//@include component/search_list.js

var env = {};

var ui = {
   loading: dom('#p_loading'),
   app: {
      self: dom('#p_app'),
      nav: {
         line: dom('#nav_mline'),
         mult: dom('#nav_mmult'),
         advn: dom('#nav_madvn')
      },
      btn: {
         search: {
            line: dom('#btn_search')
         }
      },
      txt: {
         search: dom('#txt_search')
      }
   },
   search_list: new window.FlameSearchList(dom('#pnl_result'))
};

function ui_loading() {
   ui.loading.classList.remove('hide');
   ui.app.self.classList.add('hide');
}

function ui_loaded() {
   ui.loading.classList.add('hide');
   ui.app.self.classList.remove('hide');
}

function before_login() {
   ui_loading();
}

function register_events() {
   ui.app.nav.line.addEventListener('click', function () {
      window.open('index.html', '_self');
   });
}

function init_app() {
   register_events();
   ui_loaded();
   ui.app.txt.search.focus();
}

login_and_start(env, before_login, init_app);
