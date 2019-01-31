'use strict';
//@include common.js
//@include client.js

var ui = {
   loading: dom('#p_loading'),
   app: {
      self: dom('#p_app'),
      nav: {
         result: dom('#nav_result')
      },
      panel: {
         result: dom('#p_result'),
         qlist: dom('#p_qlist'),
         klist: dom('#p_klist')
      }
   },
   template: {
      ext: {
         frame: '<div class="card-ext"><table><tbody></tbody></table></div>',
         link: '<a></a><div></div></td>',
      }
   },
   constant: {
      uol_max_len: 100,
      desc_max_len: 200,
      sub_desc_max_len: 60,
   }
};
if (window.innerWidth < 400) {
   ui.constant.uol_max_len /= 3;
   ui.constant.desc_max_len /= 2;
}

function truncate_long_string(str, max_length) {
   if (!str) return str;
   if (str.length > max_length - 3) {
      return str.substring(0, max_length-3) + '...';
   }
   return str;
}
var visualizer = {
   link: function (obj) {
      obj.ui.title.appendChild(visualizer._common.title(obj.item.name, obj.item.uol));
      obj.ui.desc.appendChild(document.createTextNode(
         truncate_long_string(obj.item.desc, ui.constant.desc_max_len)
      ));
   },
   user: function (obj) {
      visualizer._common.icon_title_desc_factory(
         obj.ui, 'user-solid', obj.item.uol, obj.item.name, obj.item.desc
      );
      if (obj.item.email) {
         obj.ui.footer.appendChild(visualizer._common.footer_link(
            'Email', 'mailto:' + obj.item.email
         ));
         obj.ui.footer.classList.remove('hide');
      }
   },
   app: function (obj) {
      visualizer._common.icon_title_desc_factory(
         obj.ui, 'block-line', obj.item.uol, obj.item.name, obj.item.desc
      );
   },
   service: function (obj) {
      visualizer._common.icon_title_desc_factory(
         obj.ui, 'cloud-solid', obj.item.uol, obj.item.name, obj.item.desc
      );
   },
   card: function (obj) {
      visualizer._common.icon_title_desc_factory(
         obj.ui, 'block-quote-line', null, obj.item.name, obj.item.desc
      );
   },
   product: function (obj) {
      visualizer._common.icon_title_desc_factory(
         obj.ui, 'tag-line', obj.item.uol, obj.item.name, obj.item.desc
      );
   },
   project: function (obj) {
      visualizer._common.icon_title_desc_factory(
         obj.ui, 'plugin-line', obj.item.uol, obj.item.name, obj.item.desc
      );
   },
   metasearch_source: function (obj) {
      visualizer._common.icon_title_desc_factory(
         obj.ui, 'copy-line', obj.item.uol, obj.item.name, obj.item.desc
      );
      var matches = obj.item.matches;
      var table = document.createElement('table');
      var tbody = document.createElement('tbody');
      table.appendChild(tbody);
      matches.forEach(function (match) {
         var tr, td;
         tr = document.createElement('tr');
         td = document.createElement('td');
         td.appendChild(document.createTextNode(match.lineno));
         tr.appendChild(td);
         td = document.createElement('td');
         td.appendChild(document.createTextNode(match.text));
         tr.appendChild(td);
         tbody.appendChild(tr);
      });
      obj.ui.desc.appendChild(table);
   },
   _ext: {
      link: function (elem, item) {
         elem.innerHTML = ui.template.ext.link;
         var a = elem.children[0], div = elem.children[1];
         if (item.uol) a.href = item.uol;
         a.target = '_blank';
         a.appendChild(document.createTextNode(item.name));
         div.appendChild(document.createTextNode(
            truncate_long_string(item.desc, ui.constant.sub_desc_max_len)
         ));
      }
   },
   _common: {
      icon: (name) => {
         var img = document.createElement('img');
         img.src = 'images/' + name + '.svg';
         img.className = 'item-icon';
         return img;
      },
      title: (name, url) => {
         var a = document.createElement('a');
         a.className = 'item-url';
         a.target = '_blank';
         a.appendChild(document.createTextNode(name));
         if (url) {
            a.href = url;
            a.appendChild(document.createElement('br'));
            var span = document.createElement('span');
            span.appendChild(document.createTextNode(
               truncate_long_string(url, ui.constant.uol_max_len)
            ));
            span.style.display = 'inline-block';
            a.appendChild(span);
         }
         return a;
      },
      footer_link: function (name, url) {
         var a = document.createElement('a');
         a.className = 'btn btn-sm btn-default';
         a.href = url;
         a.appendChild(document.createTextNode(name));
         return a;
      },
      icon_title_desc_factory: function (ui, icon, uol, title, desc) {
         ui.title.appendChild(visualizer._common.icon(icon));
         ui.title.appendChild(visualizer._common.title(title, uol));
         if (desc) {
            ui.desc.appendChild(document.createTextNode(desc));
         }
      }
   }
};
/* begin Components */
(function () {
   ui.components = {};

   function klass_search() {
      this.ui = {
         txt: document.querySelector('#txt_search_line'),
         btn: document.querySelector('#search_line')
      };

      var query = utils.parse_search();
      if (!query.q) {
         window.location = '/explore.html';
         return;
      }
      var that = this;
      this.ui.txt.value = query.q;
      this.ui.txt.addEventListener('keyup', function (evt) {
         if (evt.keyCode === 13) {
            search_redirect(that.ui.txt.value);
         }
      });
      this.ui.btn.addEventListener('click', function (evt) {
         search_redirect(that.ui.txt.value);
      });
   }
   ui.components.SearchBox = klass_search;

   function klass_item_ext_cell(items /* [{type, name, uol, desc}] */, cellprow) {
      var r = [];
      for (var i = 0, n = items.length; i < n; i += cellprow) {
         var tr = document.createElement('tr');
         for (var j = 0; j < cellprow; j++) {
            var item = items[i + j];
            if (item) {
               var td = document.createElement('td');
               visualizer._ext[item.type || 'link'](td, item);
               tr.appendChild(td);
            }
         }
         r.push(tr);
      }
      return r;
   }
   function klass_item_ext(item_ui, subitems) {
      var dom = document.createElement('div');
      dom.innerHTML = ui.template.ext.frame;
      var tbody = dom.children[0].children[0].children[0];
      klass_item_ext_cell(
         subitems || [],
         window.innerWidth < 400?1:2
      ).forEach(function (tr) {
         tbody.appendChild(tr);
      });
      item_ui.ui.desc.parentNode.appendChild(dom);
   }
   function klass_item(item) {
      this.item = item;
      this.dom = document.createElement('div');
      this.dom.innerHTML = ui.template.item;
      this.dom.className = 'col-xs-12';
      this.ui = {
         title: this.dom.querySelector('#card_title'),
         desc: this.dom.querySelector('#card_desc'),
         footer: this.dom.querySelector('#card_footer')
      }
      var visualize_fn = visualizer[item.type || 'link'];
      visualize_fn && visualize_fn(this);
      if (item.ext && item.ext.items && item.ext.items.length) {
         let subitems = item.ext.items.filter((x) => {
            return x.type !== 'skip';
         });
         if (subitems.length) klass_item_ext(this, subitems);
      }
   }
   ui.components.SearchItem = klass_item;
})();
/* end Components */

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
   },
   parse_search: function () {
      var r = {};
      if (!window.location.search) return r;
      var q = window.location.search.substring(1).split('&');
      for (var i = 0, n = q.length; i < n; i ++) {
         var j = q[i].indexOf('=');
         var key, val;
         if (j < 0) {
            key = q[i];
            val = null;
         } else {
            key = q[i].substring(0, j);
            val = unescape(q[i].substring(j+1));
         }
         if (key in r) {
            if (Array.isArray(r[key])) {
               r[key].push(val);
            } else {
               r[key] = [r[key], val];
            }
         } else {
            r[key] = val;
         }
      }
      return r;
   }
};

var env = {};

function goto_app_loading() {
   utils.loading.show();
   ui.app.self.classList.add('hide');
}

function goto_app_loaded() {
   utils.loading.hide();
   ui.app.self.classList.remove('hide');
}

function compile_template() {
   var t, html;
   t = document.querySelector('#p_card');
   html = t.innerHTML;
   remove_elem(t);
   ui.template.item = html;
}

function init_app() {
   ui.app.nav.result.addEventListener('click', function(evt) { utils.switch_panel('result'); });
   compile_template();
   reload_on_hashchange();
   var c = new ui.components.SearchBox();
   search_do(c.ui.txt.value);
}

function search_redirect(query) {
   if (!query) {
      window.location = '/question.html';
      return;
   }
   window.location = '/search.html?q=' + escape(query);
}

function generate_alert_html(html) {
   return '<div class="alert alert-info form-full"><div class="alert-items">' +
      '<div class="alert-item">' + html + '</div>' +
   '</div></div>';
}

function search_do(query) {
   goto_app_loading();
   ui.app.panel.qlist.innerHTML = '';
   ui.app.panel.klist.innerHTML = ''; // '<div class="col-xs-12"><h3>Knowledge</h3></div>';
   ui.app.panel.qlist.classList.add('hide');
   ui.app.panel.klist.classList.add('hide');
   /*client.search(query, env).then(function (obj) {
      var klist = obj.result;
      switch(1) {
      default:
         ui.app.panel.qlist.classList.remove('hide');
         if (!klist.length) {
            ui.app.panel.qlist.innerHTML = generate_alert_html(
               'Go to&nbsp; <a href="/explore.html">explore data</a>.'
            );
            break;
         }
         if (klist.length) {
            ui.app.panel.klist.classList.remove('hide');
            klist.forEach(function (item) {
               var c = new ui.components.SearchItem(item);
               ui.app.panel.klist.appendChild(c.dom);
            });
         }
      }
      goto_app_loaded();
   });*/
   search_do_with_websocket(query);
}

var ws_results = [];
var ws_split_stops = /[\s`~!@#$%^&*()-_=+[\]{}\\|:;"'<,>./?]+/;
function search_token_map(token_map, tokens) {
   tokens.forEach(function (token) {
      if (!token) return;
      if (!token_map[token]) token_map[token] = 0;
      token_map[token] ++;
   });
}
function search_token_map_normalize(token_map) {
   var tokens = Object.keys(token_map);
   var counts = tokens.map(function (token) { return token_map[token]; });
   if (!counts.length) return;
   if (counts.length === 1) {
      token_map[tokens[0]] = 1;
      return;
   }
   var max = counts.reduce(function (x,y) { return Math.max(x,y); });
   if (!max) max = 1;
   tokens.forEach(function (token, index) {
      token_map[token] = counts[index] / max;
   });
}
function search_score(item, query) {
   var query_token_map = {};
   var score = 0;
   search_token_map(query_token_map, query.split(ws_split_stops));
   search_token_map_normalize(query_token_map);
   item.matches.forEach(function (match) {
      var item_token_map = {};
      search_token_map(item_token_map, match.text.split(ws_split_stops));
      search_token_map_normalize(item_token_map);
      var line_score = 0;
      Object.keys(query_token_map).forEach(function (token) {
         var subscore = 1;
         if (token in item_token_map) {
            // hit
            subscore *= 1 + item_token_map[token] * query_token_map[token] / 2;
         } else {
            // missing
            subscore *= 1 - query_token_map[token] / 2;
         }
         line_score += subscore;
      });
      if (line_score > score) score = line_score;
   });
   return score;
}
function search_do_with_websocket(query) {
   var status = {};
   ws_results.forEach(function (c) {
      ui.app.panel.klist.removeChild(c.dom);
   });
   ws_results = [];
   ui.app.panel.qlist.innerHTML = generate_alert_html('Searching ...');
   client.websocket.connect(env, {
      onmessage: function (ev) {
         var data = JSON.parse(ev.data);
         if (data.result) {
            ws_results.forEach(function (c) {
               ui.app.panel.klist.removeChild(c.dom);
            });
            status[data.count] = true;
            var base_url = window.location.protocol + '//' + window.location.host + '/view.html#'
            var config = data.result.config;
            data.result.items.forEach(function (item) {
               item.files.forEach(function (file) {
                  console.log('debug:', data.result.base + '/' + config.xref + item.path + file.name);
                  var obj = {
                     type: 'metasearch_source',
                     name: item.path + file.name,
                     uol: base_url + item.path + file.name,
                     matches: file.matches
                  };
                  var c = new ui.components.SearchItem(obj);
                  c.score = search_score(obj, query);
                  ws_results.push(c);
               });
            });
            ws_results = ws_results.sort(function (a,b) { return b.score-a.score; });
            ws_results = ws_results.slice(0, 25);
            ws_results.forEach((c) => {
               ui.app.panel.klist.appendChild(c.dom);
            });
         } else {
            if (data.count) {
               for (var i = 0; i < data.count; i++) {
                  if (i in status) continue;
                  status[i] = false;
               }
               status['_full'] = true;
               status['_count'] = data.count;
            } else {
               status['_full'] = true;
               status['_count'] = -1;
            }
         }
         if (check_status_complete()) {
            console.log('Done.');
            if (ws_results.length) {
               ui.app.panel.qlist.innerHTML = '';
            } else {
               ui.app.panel.qlist.innerHTML = generate_alert_html('Nothing found.');
            }
            ev.target.close();
         }
      }
   }).then((ws) => {
      goto_app_loaded();
      ui.app.panel.qlist.classList.remove('hide');
      ui.app.panel.klist.classList.remove('hide');
      ws.send(JSON.stringify({
         cmd: 'metasearch.search',
         query: query
      }));
   });

   function check_status_complete() {
      if (!status._full) return false;
      return Object.keys(status).map(
         function (x) { return status[x]}
      ).reduce(
         function (x, y) { return x&&y; }
      );
   }
}

login_and_start(env, goto_app_loading, init_app, encode_url_for_login('search.html'));
