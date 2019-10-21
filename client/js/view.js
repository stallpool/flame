'use strict';

// @include common.js
// @include client.js
// @include component/breadcrumb.js
// @include component/treeview.js
// @include monaco-editor/dev/vs/loader.js
// @include monaco-editor/flame/editor.js

var env = {};
var ui = {
   loading: dom('#p_loading'),
   app: dom('#p_app'),
   nav: {
      menu: dom('#btn_menu')
   },
   editor: new FlameEditor(dom('#editor_container')),
   container: {
      editor: dom('#panel_editor'),
      search: dom('#panel_search'),
      explore: dom('#panel_explore'),
      treeview: dom('#project_tree_view_container'),
      menu: dom('#panel_menu')
   },
   list: {
      search: new FlameSearchList(dom('#result_search')),
      explore: {
         project_list: dom('#explore_project_list')
      }
   },
   btn: {
      explore_with_match: dom('#explore_with_match')
   },
   txt: {
      explore_match: dom('#explore_match')
   },
   treeview: new FlameTreeView(dom('#project_tree_view')),
   breadcrumb: new FlameBreadCrumb(dom('#nav_breadcrum'), {
      on_click: function (elem, crumbs, index) {
         var new_hash = '#/' + crumbs.slice(0, index+1).map(
            function (x) { return x.text; }
         ).filter(
            function (x) { return !!x }
         ).join('/');
         if (new_hash.charAt(new_hash.length-1) !== '/') {
            new_hash += '/';
         }
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

   ui.btn.explore_with_match.addEventListener('click', function () {
      var match = ui.txt.explore_match.value || undefined;
      load_contents_for_explore(match);
   });

   ui.txt.explore_match.addEventListener('keyup', function (evt) {
      if (evt.keyCode === 13) {
         var match = ui.txt.explore_match.value || undefined;
         load_contents_for_explore(match);
      }
   });

   document.body.addEventListener('click', function (evt) {
      var target = evt.target;
      if (target.classList.contains('nav-menu')) {
         if (ui.container.menu.style.display === 'block') {
            ui.container.menu.style.display = 'none';
            return;
         }
         ui.container.menu.style.display = 'block';
         ui.container.menu.style.left = '20px';
         ui.container.menu.style.top = (target.offsetTop + target.offsetHeight - 25) + 'px';
      } else {
         ui.container.menu.style.display = 'none';
      }
      if (target.getAttribute('data-href')) {
         console.log(target.getAttribute('data-href'));
      }
   });
}

function on_window_resize() {
   window.addEventListener('resize', function () {
      if (ui.editor.api) {
         ui.editor.resize();
         ui.editor.api.layout();
      }
      ui.treeview.resize();
   });
}

function reset_for_hashchange() {
   window.addEventListener('hashchange', function () {
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

function util_parse_hash() {
   var hash = window.location.hash;
   var parts = hash.split('#');
   var hash_obj = {};
   hash_obj.hash = '#' + parts[1];
   hash_obj.search = parts.slice(2).join('#');
   return hash_obj;
}

function load_contents() {
   ui.app.classList.remove('hide');
   ui.treeview.resize();
   ui.editor.resize();

   ui.editor.on_content_load(function _load (uri) {
      var project = uri.authority;
      var path = uri.path;
      return new Promise(function (r, e) {
         client.browse.get_file(env, project, path).then(
            function (res) { r(res && res.text); },
            function () { r(null); }
         );
      });
   });

   var suburl = util_parse_hash();
   var hash = suburl.hash;
   ui.container.editor.style.display = 'none';
   ui.container.explore.style.display = 'none';
   ui.container.search.style.display = 'none';
   ui.breadcrumb.reset();
   if (suburl.search) {
      // search
      load_contents_for_search(decodeURIComponent(suburl.search));
   } else if (hash === '#/') {
      // explore projects
      load_contents_for_explore();
   } else if (hash.startsWith('#/')) {
      // browse
      load_contents_for_browse(hash);
      ui.treeview.expand();
   }
}

function load_contents_for_search(text) {
   ui.list.search.reset();
   ui.list.search.build_text('Searching ...');
   client.search(text, env).then(function (data) {
      let hits = data.result.hits || [];
      if (hits.length) {
         ui.list.search.build_text('', text);
      } else {
         ui.list.search.build_text('Nothing found.');
      }
      ui.list.search.build_list(hits);
      ui.container.search.style.display = 'block';
   }, function () {
      ui.list.search.build_text('Nothing found.');
      ui.container.search.style.display = 'block';
   });
   ui_loaded();
}

function load_contents_for_browse(hash) {
   var parts = hash.substring(2).split('/');
   var project = parts[0];
   var path = '/' + parts.slice(1).join('/');
   ui.editor.create('flame://' + project + path, '', { }, { /* readOnly: true */ });
   ui.editor.on_content_ready(function () {
      ui.container.editor.style.display = 'block';
      ui_loaded();
      ui.breadcrumb.layout('/' + project + path);
      ui.editor.api.layout();
   });
}

function load_contents_for_explore(match) {
   ui_loading();
   client.browse.get_project_list(env, { match: match }).then(function (res) {
      if (!res || !res.items) return;
      reset_component(ui.list.explore.project_list);
      res.items.forEach(function (project_name) {
         var div = document.createElement('div');
         var a = document.createElement('a');
         a.href = '#/' + project_name + '/';
         a.classList.add('btn');
         a.classList.add('btn-link');
         set_text_component(a, project_name);
         div.classList.add('col-lg-3');
         div.classList.add('col-md-4');
         div.classList.add('col-sm-6');
         div.classList.add('col-lg-6');
         div.appendChild(a);
         ui.list.explore.project_list.appendChild(div);
      });
      ui.container.explore.style.display = 'block';
      ui_loaded();
      ui.txt.explore_match.focus();
      ui.txt.explore_match.selectionStart = 0;
      ui.txt.explore_match.selectionEnd = match?match.length:0;
   });
}

login_and_start(env, before_login, init_app, encode_url_for_login('view.html'));