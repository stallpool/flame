'use strict';

// @include common.js
// @include client.js
// @include component/breadcrumb.js
// @include monaco-editor/dev/vs/loader.js
// @include monaco-editor/flame/editor.js

var env = {};
var ui = {
   loading: dom('#p_loading'),
   app: dom('#p_app'),
   nav: {
      search: dom('#nav_mline')
   },
   editor: new FlameEditor(dom('#editor_container')),
   breadcrumb: new FlameBreadCrumb(dom('#nav_breadcrum'), {
      on_click: function (elem, crumbs, index) {
         var new_hash = '#/' + crumbs.slice(0, index+1).map(
            function (x) { return x.text; }
         ).filter(
            function (x) { return !!x }
         ).join('/') + '/';
         window.location.hash = new_hash;
      }
   }),
};

require.config({ paths: {
   'vs': './js/monaco-editor/dev/vs',
   'flame': './js/monaco-editor/flame'
}});


function ui_loading() {
   ui.loading.classList.remove('hide');
   ui.app.classList.add('hide');
}

function ui_loaded() {
   ui.loading.classList.add('hide');
   ui.app.classList.remove('hide');
}

function before_login() {
   ui_loading();
}

function init_app() {
   register_events();
   load_contents();
}

function register_events() {
   reset_for_hashchange();
   on_window_resize();
}

function on_window_resize() {
   window.addEventListener('resize', function () {
      if (ui.editor.api) {
         ui.editor.resize();
         ui.editor.api.layout();
      }
   });
}

function reset_for_hashchange() {
   window.addEventListener('hashchange', function () {
      return;
      ui.breadcrumb.reset();
      if (ui.editor.api) {
         ui.editor.api.getModel().dispose();
         ui.editor.api.dispose();
         ui.editor.api = null;
      }
      ui_loading();
      load_contents();
   });
}

function error_file_not_found() {
   ui.loading.classList.remove('hide');
   ui.app.classList.add('hide');
   ui.loading.querySelector('#loading_text').innerHTML = '<strong>File Not Found!</storng>';
}

function load_contents() {
   ui.app.classList.remove('hide');
   ui.editor.resize();
   ui.editor.create(
      'test.js',
      'function main() {}',
      { },
      { }
      // { readOnly: true }
   );
   ui.editor.on_content_ready(function () {
      ui_loaded();
   });
}

login_and_start(env, before_login, init_app, encode_url_for_login('view.html'));