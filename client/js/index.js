'use strict';
//@include common.js

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
            line: dom('#search_line')
         }
      },
      txt: {
         search: {
            line: dom('#txt_search_line')
         }
      }
   }
};

function register_events() {
   ui.app.nav.mult.addEventListener('click', function () {
      window.open('match.html', '_self');
   });
}

function init_app() {
   register_events();
   ui.app.txt.search.line.addEventListener('keyup', function (evt) {
      if (evt.keyCode === 13) {
         search_redirect(ui.app.txt.search.line.value);
      }
   });
   ui.app.btn.search.line.addEventListener('click', function (evt) {
      search_redirect(ui.app.txt.search.line.value);
   });
   goto_app_loaded();
   ui.app.txt.search.line.focus();
}

function goto_app_loading() {
   ui.loading.classList.remove('hide');
   ui.app.self.classList.add('hide');
}

function goto_app_loaded() {
   ui.loading.classList.add('hide');
   ui.app.self.classList.remove('hide');
}

function search_redirect(query) {
   if (!query) {
      window.open('view.html#/', '_self');
      return;
   }
   window.open('view.html##' + encodeURIComponent(query), '_self');
}

var env = {};
login_and_start(env, goto_app_loading, init_app);
