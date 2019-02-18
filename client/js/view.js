'use strict';

// @include common.js
// @include client.js
// @include component/breadcrumb.js
// @include component/dropdown_tab.js
// @include component/search_list.js
// @include monaco-editor/dev/vs/loader.js
// @include monaco-editor/flame/editor.js

var env = {};
var ui = {
   loading: dom('#p_loading'),
   app: dom('#p_app'),
   nav: {
      search: dom('#nav_mline')
   },
   btn: {
      search: dom('#btn_search')
   },
   txt: {
      search: dom('#txt_search')
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
   search_tab: null,
   search_list: null,
};
ui.search_tab = new FlameDropdownTab(ui.nav.search);
ui.search_tab.unpin();
ui.search_list = new FlameSearchList(ui.search_tab.dom.content);

require.config({ paths: {
   'vs': './js/monaco-editor/dev/vs',
   'flame': './js/monaco-editor/flame'
}});

function util_parse_path(path) {
   var search = path;
   var parsed = {};
   if (!search) return parsed;
   search = search.split('?');
   parsed.path = search[0];
   search = search[1];
   if (!search) return parsed;
   search = search.split('&');
   if (!search.length) return parsed;
   var map = {};
   parsed.map = map;
   search.forEach(function (one) {
      var index = one.indexOf('=');
      var key, value;
      if (index < 0) {
         key = one;
         value = '';
      } else {
         key = one.substring(0, index);
         value = one.substring(index+1);
      }
      key = decodeURIComponent(key);
      value = decodeURIComponent(value);
      if (key in map) {
         if (map[key].length) {
            map[key].push(value);
         } else {
            map[key] = [map[key], value];
         }
      } else {
         map[key] = value;
      }
   });
   return parsed;
}

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
      if (length < 0) break;
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
      var filename = line.split('|')[0].trim();
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
   on_hover_on_line_number();

   ui.btn.search.addEventListener('click', function (evt) {
      if (evt.target.tagName.toLowerCase() !== 'label') return;
      on_search(ui.txt.search.value);
   });
   ui.txt.search.addEventListener('keyup', function (evt) {
      if (evt.keyCode === 13) {
         return on_search(ui.txt.search.value);
      }
   });
   ui.txt.search.addEventListener('focus', function (evt) {
      ui.txt.search.selectionStart = 0;
      ui.txt.search.selectionEnd = ui.txt.search.value.length;
   });
   ui.nav.search.addEventListener('mouseenter', function (evt) {
      ui.search_tab.layout();
      ui.search_tab.show();
   });

   document.body.addEventListener('click', function (evt) {
      var href = evt.target.getAttribute('data-href');
      if (!href) return;
      window.location.hash = href;
   });
}
function on_search(query) {
   if (!query) return;
   window.location = '##' + encodeURIComponent(query);
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
      ui.breadcrumb.reset();
      if (ui.editor.api) {
         ui.editor.api.getModel().dispose();
         ui.editor.api.dispose();
         ui.editor.api = null;
         require(['flame/mode'], function (flame_mode) {
            flame_mode.getFlameWorkerManager().then(function (manager) {
               manager.dispose();
               monaco.languages.FlameLanguage.Information.reset();
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
         load_contents();
      }
   });
}

function on_hover_on_line_number() {
   var container = dom('#editor_container');
   var line_number = 1;
   var last_target = null;
   container.addEventListener('mousemove', function (evt) {
      var target = evt.target;
      if (
         target.parentNode &&
         target.parentNode.classList.contains('margin-view-overlays')
      ) {
      } else if (
         target.parentNode.parentNode &&
         target.parentNode.parentNode.classList.contains('margin-view-overlays')
      ) {
      } else {
         target = null;
      }
      if (!target) {
         if (last_target) {
            mouse_leave(evt, line_number);
            line_number = 1;
            last_target = null;
         }
         return;
      }
      if (target === last_target) return;
      if (last_target) mouse_leave(evt, line_number);
      line_number = parseInt(target.textContent);
      last_target = target;
      mouse_enter(evt, line_number);
   });
   container.addEventListener('mouseleave', function (evt) {
      if (!last_target) return;
      mouse_leave(evt, line_number);
      line_number = 1;
      last_target = null;
   });

   function mouse_enter(evt, line_number) {
      // console.log('enter', line_number);
   }
   function mouse_leave(evt, line_number) {
      // console.log('leave', line_number);
   }
}

function error_file_not_found() {
   ui.loading.classList.remove('hide');
   ui.app.classList.add('hide');
   ui.loading.querySelector('#loading_text').innerHTML = '<strong>File Not Found!</storng>';
}

function do_search() {
   var hash = window.location.hash;
   hash = hash.substring(2);
   hash = decodeURIComponent(hash);
   if (!hash) return error_file_not_found();
   ui_loaded();
   ui.search_tab.pin();
   if (!ui.search_list.events.on_search_start) {
      ui.search_list.events.on_search_start = function () {
         ui.search_tab.layout();
         ui.search_tab.set_opacity(1);
         ui.search_tab.show();
      };
   }
   ui.search_list.start_search(hash);
}

function load_to_add_more_info(output, info) {
   if (!output || !info) return;
   output.project = info.project;
   return output;
}

function load_for_file(options) {
   client.browse.get_file(
      env, options.project, options.path
   ).then(function (result) {
      if (!result) return error_file_not_found();
      ui.app.classList.remove('hide');
      ui.editor.resize();
      ui.editor.create(
         result.path,
         result.text,
         load_to_add_more_info(result.info || {}, options),
         { readOnly: true }
      );
      ui.editor.on_content_ready(function () {
         ui_loaded();
         if (options.flags && options.flags.lineno) {
            var lineno = parseInt(options.flags.lineno);
            ui.editor.api.revealLineInCenter(lineno || 0);
            ui.editor.api.setPosition({
               lineNumber: lineno,
               column: 0
            });
         }
         ui.editor.on_definition_click(function (evt) {
            var model = ui.editor.api.getModel();
            var offset = model.getOffsetAt(evt.target.position);
            var information = monaco.languages.FlameLanguage.Information.get();
            var token = util_lookup_token(information.tokens, offset);
            if (!token) {
               // infile cross reference jump
               ui.editor._backup.on_definition_click(evt);
               return;
            }
            window.location.hash = '#' + token.hash;
         });
      });
   }, function () {
      error_file_not_found();
   });
}

function load_for_directory(options) {
   client.browse.get_dir(
      env, options.project, options.path
   ).then(function (result) {
      if (!result) return error_file_not_found();
      ui.app.classList.remove('hide');
      ui.editor.resize();
      var directory_info = generate_directory_info(result);
      directory_info.info.is_dir = true;
      ui.editor.create(
         result.path + '.__dir__',
         directory_info.text,
         load_to_add_more_info(directory_info.info, options),
         { readOnly: true }
      );
      ui.editor.on_content_ready(function () {
         ui.editor.define_directory_lang();
         ui.editor.on_definition_click(function (evt) {
            var model = ui.editor.api.getModel();
            var offset = model.getOffsetAt(evt.target.position);
            var information = monaco.languages.FlameLanguage.Information.get();
            var token = util_lookup_token(information.tokens, offset);
            if (!token) return;
            window.location.hash = '#' + token.hash;
         });
         ui_loaded();
      });
   }, function () {
      error_file_not_found();
   })
}

function load_contents() {
   var hash = window.location.hash;
   if (hash && hash.startsWith('##')) {
      return do_search();
   }
   ui.search_tab.unpin();
   hash = hash.substring(1).split('/');
   hash = {
      project: hash[1],
      path: '/' + hash.slice(2).join('/')
   };
   if (!hash.project || !hash.path) return error_file_not_found();
   var isdir = hash.path.charAt(hash.path.length-1) === '/';
   var hash_path = util_parse_path(hash.path);
   hash.path = hash_path.path;
   hash.flags = hash_path.map;
   ui.breadcrumb.layout(util_hash_path(hash));
   if (isdir) {
      load_for_directory(hash);
   } else {
      load_for_file(hash);
   }
}

login_and_start(env, before_login, init_app, encode_url_for_login('view.html'));