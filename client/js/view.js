'use strict';

// @include common.js
// @include monaco-editor/dev/vs/loader.js
// @include monaco-editor/flame/editor.js

var env = {};
var ui = {
   loading: dom('#p_loading'),
   app: {
      self: dom('#p_app'),
   },
   editor: new FlameEditor(dom('#container'))
};

require.config({ paths: {
   'vs': './js/monaco-editor/dev/vs',
   'flame': './js/monaco-editor/flame'
}});

function before_login() {
   ui.loading.classList.remove('hide');
   ui.app.self.classList.add('hide');
}

function init_app() {
   reload_on_hashchange();
}

// login_and_start(env, before_login, init_app, encode_url_for_login('view.html'));

ui.editor.resize();
ui.editor.create();