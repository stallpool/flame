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
      panel: {
         line: dom('#p_mline'),
         mult: dom('#p_mmult'),
         advn: dom('#p_madvn')
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

var utils = {
   loading: {
      show: function () { ui.loading.classList.remove('hide'); },
      hide: function () { ui.loading.classList.add('hide'); }
   },
   switch_panel: function (name) {
      Object.keys(ui.app.nav).forEach(function (tabname) {
         ui.app.nav[tabname].classList.remove('active');
         ui.app.panel[tabname].classList.add('hide');
      });
      ui.app.nav[name].classList.add('active');
      ui.app.panel[name].classList.remove('hide');
   }
};

function init_app() {
   Object.keys(ui.app.nav).forEach(function (name) {
      init_tab(name);
   });
   utils.switch_panel('line');
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

function init_tab(name) {
   ui.app.nav[name].addEventListener('click', function () { utils.switch_panel(name) });
}

function goto_app_loading() {
   utils.loading.show();
   ui.app.self.classList.add('hide');
}

function goto_app_loaded() {
   utils.loading.hide();
   ui.app.self.classList.remove('hide');
}

function search_redirect(query) {
   if (!query) {
      window.location = '/explore.html';
      return;
   }
   window.location = '/search.html?q=' + escape(query);
}

var env = {};
login_and_start(env, goto_app_loading, init_app);
