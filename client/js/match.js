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
         search: dom('#btn_search'),
         back: dom('#btn_back')
      },
      txt: {
         search: dom('#txt_search')
      },
      panel: {
         search: dom('#pnl_search'),
         result: dom('#pnl_result')
      }
   },
   search_list: new window.FlameSearchList(dom('#search_result'))
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

   ui.app.btn.back.addEventListener('click', function () {
      ui.app.panel.result.classList.add('hide');
      ui.app.panel.search.classList.remove('hide');
   });

   ui.app.btn.search.addEventListener('click', function () {
      if (!ui.app.txt.search.value) {
         ui.app.txt.search.focus();
         return;
      }
      ui.search_list.start_multiple_search(
         ui.app.txt.search.value,
         { base_url: 'view.html#' }
      );
      ui.app.panel.search.classList.add('hide');
      ui.app.panel.result.classList.remove('hide');
   });
}

function init_app() {
   register_events();
   ui_loaded();
   ui.app.txt.search.focus();
}

login_and_start(env, before_login, init_app);
