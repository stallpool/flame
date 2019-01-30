'use strict';

// @include common.js
// @include client.js
// @include component/breadcrumb.js
// @include monaco-editor/dev/vs/loader.js
// @include monaco-editor/flame/editor.js

var env = {};
var ui = {
   loading: dom('#p_loading'),
   app: {
      self: dom('#p_app'),
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
   })
};

require.config({ paths: {
   'vs': './js/monaco-editor/dev/vs',
   'flame': './js/monaco-editor/flame'
}});

function util_hash_path(hash) {
   return '/' + hash.project + hash.path;
}

function util_string_times(ch, n) {
   var r = '';
   while(n > 0) {
      r += ch;
      n --;
   }
   return r;
}

function util_lookup_token (token_list, offset) {
   if (!token_list) return null;
   if (!token_list.length) return null;
   var s = 0, e = token_list.length-1, m, x;
   while (e - s > 0) {
      m = ~~((s+e)/2);
      x = token_list[m];
      if (!x) return null;
      if (x.startOffset > offset ) {
         e = m;
         continue;
      }
      if (x.endOffset < offset) {
         s = m+1;
         continue;
      }
      if (x.startOffset <= offset && x.endOffset >= offset) {
         return x;
      }
      return null;
   }
   if (e === s && e >= 0 && e <= token_list.length) {
      x = token_list[e];
      if (x.startOffset <= offset && x.endOffset >= offset) {
         return x;
      }
   }
   return null;
}

function util_limit_path(path, length) {
   if (!path) return path;
   if (path.length <= length) return path;
   var isdir = path.charAt(path.length-1) === '/';
   path = path.split('/');
   var head_index = 0;
   var tail_index = path.length - (isdir?2:1);
   var head = path[head_index];
   if (!head) head = path[++head_index];
   if (tail_index - head_index <= 1) return path;
   var tail = path[tail_index];
   var hide = ' ... ';
   var r = [];
   path = path.slice(head_index+1, tail_index);
   length -= tail.length + head.length + hide.length;
   var n = path.length, i = n-1;
   for (; i >= 0 && length > 0; i--) {
      var one = path[i];
      length -= one.length;
      r.unshift(one);
   }
   if (i >= 0) {
      r.unshift(hide);
   }
   r.unshift(head);
   r.unshift('');
   r.push(tail);
   if (isdir) r.push('');
   return r.join('/');
}

function generate_directory_info(dir_item) {
   if (!dir_item.items || !dir_item.items.length) {
      return 'Empty Directory';
   }
   var base = util_hash_path(dir_item);
   var head = Object.keys(dir_item.items[0]);
   var count = head.map(function (cell) { return cell.length; }), items = [];
   var i = head.indexOf('name');
   head[i] = head[0];
   head[0] = 'name';
   dir_item.items.forEach(function (item) {
      var row = head.map(function (key) {
         if (key === 'name') item[key] = './' + item[key];
         return item[key] + ' ';
      });
      row.forEach(function (cell, index) {
         if (!count[index]) count[index] = 0;
         if (cell.length > count[index]) count[index] = cell.length;
      });
      items.push(row);
   });
   items.unshift(count.map(function (n) {
      return util_string_times('-', n);
   }));
   items.unshift(head);
   var text = items.map(function (row) {
      return row.map(function (cell, index) {
         return cell + util_string_times(' ', count[index] - cell.length);
      }).join('|');
   });
   var head_text = '[Ctrl+Click (Cmd+Click on Mac) to follow the link to file or directory]\n\n';
   var offset = head_text.length;
   var tokens = text.map(function (line, index) {
      if (index < 2) {
         offset += line.length+1;
         return null;
      }
      var filename = line.split(' ')[0];
      var full_filename = base + filename.substring(2);
      var r = {
         startOffset: offset,
         endOffset: offset + filename.length,
         hash: full_filename,
         description: util_limit_path(full_filename, 60)
      };
      offset += line.length+1;
      return r;
   }).filter(function (x) { return !!x; });
   return {
      info: {
         tokens: tokens
      },
      text: head_text + text.join('\n')
   }
}

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

function init_app() {
   reset_for_hashchange();
   load_code();
}

function reset_for_hashchange() {
   window.addEventListener('hashchange', function () {
      if (ui.editor.api) {
         ui.editor.api.getModel().dispose();
         ui.editor.api.dispose();
         require(['flame/mode'], function (flame_mode) {
            flame_mode.getFlameWorkerManager().then(function (manager) {
               manager.dispose();
               reload();
            }, function () {
               reload();
            });
         });
      } else {
         reload();
      }

      function reload() {
         ui_loading();
         load_code();
      }
   });
}

function error_file_not_found() {
   ui.loading.classList.remove('hide');
   ui.app.self.classList.add('hide');
   ui.loading.querySelector('#loading_text').innerHTML = '<strong>File Not Found!</storng>';
}

function load_code() {
   var hash = window.location.hash.substring(1).split('/');
   hash = {
      project: hash[1],
      path: '/' + hash.slice(2).join('/')
   };
   if (!hash.project || !hash.path) return error_file_not_found();
   var isdir = hash.path.charAt(hash.path.length-1) === '/';
   ui.breadcrumb.layout(util_hash_path(hash));
   if (!isdir) {
      client.browse.get_file(
         env, hash.project, hash.path
      ).then(function (result) {
         if (!result) return error_file_not_found();
         ui.app.self.classList.remove('hide');
         ui.editor.resize();
         ui.editor.create(result.path, result.text, {}, {
            readOnly: true
         });
         ui.editor.on_content_ready(function () {
            ui_loaded();
         });
      }, function () {
         error_file_not_found();
      });
   } else {
      client.browse.get_dir(
         env, hash.project, hash.path
      ).then(function (result) {
         if (!result) return error_file_not_found();
         ui.app.self.classList.remove('hide');
         ui.editor.resize();
         var directory_info = generate_directory_info(result);
         ui.editor.create(
            result.path + '.__dir__',
            directory_info.text,
            directory_info.info,
            { readOnly: true }
         );
         ui.editor.on_content_ready(function () {
            ui.editor.define_directory_lang();
            ui.editor.on_definition_click(function (evt) {
               var model = ui.editor.api.getModel();
               var offset = model.getOffsetAt(evt.target.position);
               var information = monaco.languages.FlameLanguage.Information.get();
               var token = util_lookup_token(information.tokens, offset);
               window.location.hash = '#' + token.hash;
            });
            ui_loaded();
         });
      }, function () {
         error_file_not_found();
      })
   }
}

login_and_start(env, before_login, init_app, encode_url_for_login('view.html'));