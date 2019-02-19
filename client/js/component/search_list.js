'use strict';

(function (window, document) {
   //@include client.js
   var constant = {
      uol_max_len: 100,
      desc_max_len: 200
   };

   var split_stops = /[\s`~!@#$%^&*()-_=+[\]{}\\|:;"'<,>./?]+/;
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

   function match_line_score(match, query, query_seq) {
      if (!query_seq) query_seq = query.split(split_stops);
      var item_seq = match.text.split(split_stops);
      if (!item_seq.length || !query_seq.length) return 0.0;
      // string: cpu: {}, mem: {} GB, disk: {}  GB
      //    log: cpu: 1 , mem: 4  GB, disk: 100 GB
      // LCS algorithm
      // / L(a i-1, b j-1) + 1, if a i = b j
      // \ max{ L(a i-1, b j), L(a i, b j-1) }, if a i != b j
      var a0 = [], a1 = [];
      var n = query_seq.length, m = item_seq.length;
      for (var i = m; i >= 0; i--) {
         a0.push(0);
         a1.push(0);
      }
      for (var i = 0; i < n; i++) {
         for (var j = 0; j < m; j++) {
            if (query_seq[i] === item_seq[j]) {
               a1[j+1] = a0[j] + 1;
            } else {
               a1[j+1] = Math.max(a1[j], a0[j+1]);
            }
         }
         a0 = a1;
      }
      var score = a1[m] / n;
      return score;
   }

   function search_line_score(match, query, query_token_map) {
      if (!query_token_map) {
         query_token_map = {};
         search_token_map(query_token_map, query.split(split_stops));
         search_token_map_normalize(query_token_map);
      }
      var item_token_map = {};
      search_token_map(item_token_map, match.text.split(split_stops));
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
      return line_score;
   }

   function search_score(item, query) {
      var query_token_map = {};
      var score = 0;
      search_token_map(query_token_map, query.split(split_stops));
      search_token_map_normalize(query_token_map);
      item.matches.forEach(function (match) {
         var line_score = search_line_score(match, query, query_token_map);
         if (line_score > score) score = line_score;
      });
      return score;
   }

   function generate_alert_html(alert_html, query) {
      var query_display = '';
      if (query) {
         query = truncate_long_string(query, 100);
         query = query.replace(/&/g, '&amp;');
         query = query.replace(/</g, '&lt;');
         query = query.replace(/>/g, '&gt;');
         query = query.replace(/\s/g, '&nbsp;');
         query_display = '<div>Search results for <strong>' + query + '</strong></div>';
      }
      var alert_display = '';
      if (alert_html) {
         alert_display = (
            '<div class="alert alert-info form-full"><div class="alert-items">' +
            '<div class="alert-item">' + alert_html + '</div>' +
            '</div></div>'
         );
      }
      return query_display + alert_display;
   }

   function Searcher(options) {
      this.options = options || {};
      this.reset();
   }
   Searcher.prototype = {
      reset: function () {
         if (this.ws) this.ws = null;
         this.items = [];
         this.status = {};
         this.queries = [];
         this.index = 0;
      },
      dispose: function () {
         if (this.ws) this.ws = null;
      },
      on_message: function (evt) {
         var _this = this;
         var data = JSON.parse(evt.data);
         if (data.result) {
            this.status[data.count] = true;
            var base_url = '#';
            var config = data.result.config;
            var update_items = [];
            data.result.items.forEach(function (item) {
               item.files.forEach(function (file) {
                  var obj = {
                     type: 'metasearch_source',
                     name: item.path + file.name,
                     uol: base_url + item.path + file.name,
                     matches: file.matches
                  };
                  var c = { item: obj };
                  update_items.push(c);
               });
            });
            if (this.options.on_complete_per_task) {
               this.options.on_complete_per_task(this, update_items);
            }
         } else {
            if (data.count) {
               for (var i = 0; i < data.count; i++) {
                  if (i in this.status) continue;
                  this.status[i] = false;
               }
               this.status._full = true;
               this.status._count = data.count;
            } else {
               this.status._full = true;
               this.status._count = -1;
            }
         }
         if (check_status_complete()) {
            if (this.options.on_complete_per_query) {
               this.options.on_complete_per_query(this);
            }
            this.one(this.queries, this.index + 1);
         }

         function check_status_complete() {
            if (!_this.status._full) return false;
            return Object.keys(_this.status).map(
               function (x) { return _this.status[x]}
            ).reduce(
               function (x, y) { return x&&y; }
            );
         }
      },
      one: function (queries, index) {
         if (queries.length <= index) {
            if (this.options.on_search_complete) {
               this.options.on_search_complete(this);
            }
            if (this.ws) this.ws.close();
            this.reset();
            console.log('Done.');
            return;
         }
         this.index = index;
         this.status = {};
         if (this.options.on_start_per_query) {
            this.options.on_start_per_query(this);
         }
         var skip = false;
         if (this.options.skip_query) {
            skip = !!this.options.skip_query(this);
         }
         if (skip) {
            if (this.options.on_complete_per_task) {
               this.options.on_complete_per_task(this, []);
            }
            if (this.options.on_complete_per_query) {
               this.options.on_complete_per_query(this);
            }
            this.one(queries, index + 1);
            return;
         }
         this.ws.send(JSON.stringify({
            cmd: 'metasearch.search',
            query: queries[index]
         }));
      },
      start: function (queries) {
         var _this = this;
         this.queries = queries;
         client.websocket.connect(env, {
            onmessage: function (evt) {
               _this.on_message(evt);
            }
         }).then(function (ws) {
            _this.ws = ws;
            if (_this.options.on_search_start) {
               _this.options.on_search_start(_this);
            }
            _this.one(queries, 0);
         });
      }
   };
   
   function do_search_for_line(query, search_list) {
      if (search_list.state.searching) {
         // TODO: cancel search first and then setTimeout
         search_list.cancel_search();
         setTimeout(do_search_for_line, 1000, query, search_list);
         return;
      }
      new Searcher({
         on_complete_per_task: function (searcher, update_items) {
            var query = searcher.queries[searcher.index];
            search_list.items.forEach(function (c) {
               search_list.dom.body.removeChild(c.dom);
            });
            update_items = update_items.map(function (c) {
               c.dom = build_item(c.item);
               if (!c.dom) return null;
               c.score = search_score(c.item, query);
               return c;
            }).filter(function (c) {
               return !!c;
            });
            search_list.items = search_list.items.concat(update_items);
            search_list.items = search_list.items.sort(function (a,b) { return b.score-a.score; });
            search_list.items = search_list.items.slice(0, 25);
            search_list.items.forEach((c) => {
               search_list.dom.body.appendChild(c.dom);
            });
         },
         on_search_start: function (searcher) {
            if (search_list.events.on_search_start) {
               search_list.events.on_search_start(searcher);
            }
            search_list.reset();
            search_list.state.searching = true;
            search_list.dom.info.innerHTML = generate_alert_html('Searching ...');
         },
         on_search_complete: function (searcher) {
            if (search_list.events.on_search_complete) {
               search_list.events.on_search_complete(searcher);
            }
            search_list.state.searching = false;
            var query = searcher.queries[searcher.index];
            if (search_list.items.length) {
               search_list.dom.info.innerHTML = generate_alert_html('', query);
            } else {
               search_list.dom.info.innerHTML = generate_alert_html('Nothing found.', query);
            }
         }
      }).start([query]);
   }

   function do_search_for_text(text, options, search_list) {
      var queries = text.split('\n').map(function (x) { return '| ' + x; });
      var search_result = {};
      new Searcher({
         on_complete_per_task: function (searcher, update_items) {
            if (search_result.dom) {
               search_list.dom.body.removeChild(search_result.dom);
               search_result = search_list.items.pop();
            }
            var query = searcher.queries[searcher.index].substring(2);
            search_result.name = query;
            search_result.type = 'metasearch_source';
            search_result.matches = search_result.matches || [];

            var query_seq = query.split(split_stops);
            update_items.forEach(function (x) {
               var matches = x.item.matches;
               matches.forEach(function (match) {
                  match.score = match_line_score(match, query, query_seq);
                  match.name = x.item.name;
                  search_result.matches.push(match);
               });
            });
            search_result.matches = search_result.matches.sort(function (a,b) { return b.score-a.score; });
            search_result.matches = search_result.matches.slice(0, 5);
            search_result.dom = build_item(search_result);
            if (search_list.dom) {
               search_list.dom.body.appendChild(search_result.dom);
               search_list.items.push(search_result);
            }
         },
         on_complete_per_query: function (searcher) {
            search_result = {};
         },
         on_start_per_query: function (searcher) {
         },
         skip_query: function (searcher) {
            var query = searcher.queries[searcher.index].substring(2);
            var match = (split_stops.exec(query) || [])[0];
            if (match === query) {
               return true;
            }
            return false;
         },
         on_search_start: function (searcher) {
            if (search_list.events.on_search_start) {
               search_list.events.on_search_start(searcher);
            }
            search_list.reset();
            search_list.state.searching = true;
            search_list.dom.info.innerHTML = generate_alert_html('Searching ...');
         },
         on_search_complete: function (searcher) {
            if (search_list.events.on_search_complete) {
               search_list.events.on_search_complete(searcher);
            }
            search_list.state.searching = false;
            if (search_list.items.length) {
               search_list.dom.info.innerHTML = generate_alert_html('');
            } else {
               search_list.dom.info.innerHTML = generate_alert_html('Nothing found.');
            }
         }
      }).start(queries);
   }

   /////////////////////////////////////////////////////////////////////////////

   function build_list() {
      var list = document.createElement('div');
      list.classList.add('tab-container');
      var header = document.createElement('div');
      header.classList.add('tab-row');
      var info = document.createElement('div');
      info.innerHTML = generate_alert_html('No search.');
      header.appendChild(info);
      var body = document.createElement('div');
      body.classList.add('tab-row-fit');
      body.style.overflowY = 'auto';
      list.appendChild(header);
      list.appendChild(body);
      return {
         self: list,
         body: body,
         info: info
      };
   }

   function build_item(item) {
      // item = {type, uol, name, desc, ...}
      if (!item) return null;
      switch(item.type) {
      case 'metasearch_source':
         return build_item_metasearch_source(item);
      }
      return null;
   }

   function build_item_metasearch_source(item) {
      var card = build_card('copy-line', item);
      var card_matches = build_item_metasearch_source_matches(item);
      if (card_matches) {
         card.text.appendChild(card_matches);
      }
      return card.self;
   }

   function build_item_metasearch_source_matches(item) {
      var matches = item.matches;
      if (!matches.length) return null;
      var table = document.createElement('table');
      var tbody = document.createElement('tbody');
      table.appendChild(tbody);
      matches.forEach(function (match) {
         var tr, td, a;
         tr = document.createElement('tr');
         td = document.createElement('td');
         td.classList.add('text-right');
         td.classList.add('lineno');
         td.appendChild(document.createTextNode(match.lineno + ' '));
         tr.appendChild(td);
         td = document.createElement('td');
         a = document.createElement('a');
         a.href = '#' + (match.name || item.name) + '?lineno=' + match.lineno;
         a.appendChild(document.createTextNode(match.text));
         td.appendChild(a);
         if (match.name) {
            var span = document.createElement('span');
            span.classList.add('match-line-filename');
            span.appendChild(document.createTextNode(' (' + match.name + ')'));
            td.appendChild(span);
         }
         tr.appendChild(td);
         tbody.appendChild(tr);
      });
      return table;
   }

   function truncate_long_string(str, max_length) {
      if (!str) return str;
      if (str.length > max_length - 3) {
         return str.substring(0, max_length-3) + '...';
      }
      return str;
   }

   function build_item_frame() {
      var card = document.createElement('div');
      card.classList.add('card');
      var card_body = document.createElement('div');
      card_body.classList.add('card-block');
      var card_title = document.createElement('card_title');
      card_title.classList.add('card-title');
      var card_text = document.createElement('card_text');
      card_text.classList.add('card-text');
      card_body.appendChild(card_title);
      card_body.appendChild(card_text);
      card.appendChild(card_body);
      return {
         self: card,
         body: card_body,
         title: card_title,
         text: card_text
      };
   }

   function build_icon(name) {
      var img = document.createElement('img');
      img.src = 'images/' + name + '.svg';
      img.className = 'item-icon';
      return img;
   }

   function build_url(name, url) {
      var a = document.createElement('a');
      a.className = 'item-url';
      a.appendChild(document.createTextNode(name));
      if (url) {
         if (!url.startsWith('#')) {
            a.target = '_blank';
         }
         a.href = url;
         a.appendChild(document.createElement('br'));
         var span = document.createElement('span');
         span.appendChild(document.createTextNode(
            truncate_long_string(url, constant.uol_max_len)
         ));
         span.style.display = 'inline-block';
         a.appendChild(span);
      }
      return a;
   }

   function build_card(icon, item) {
      var card = build_item_frame();
      if (icon) {
         card.title.appendChild(build_icon(icon));
      }
      card.title.appendChild(build_url(item.name, item.uol));
      if (item.desc) {
         card.text.appendChild(document.createTextNode(item.desc));
      }
      return card;
   }

   function FlameSearchList(dom, options) {
      this.ref_dom = dom;
      this.dom = build_list(dom);
      this.ref_dom.appendChild(this.dom.self);
      this.items = [];
      this.state = {
         searching: false
      };
      this.events = {};

      if (!options) options = {};
      if (options.on_search_start) {
         this.events.on_search_start = options.on_search_start;
      }
      if (options.on_search_complete) {
         this.events.on_search_complete = options.on_search_complete;
      }
      if (options.on_search_cancel) {
         this.events.on_search_cancel = options.on_search_cancel;
      }
      if (options.on_complete_per_query) {
         this.events.on_complete_per_query = options.on_complete_per_query;
      }
   }
   FlameSearchList.prototype = {
      start_search: function (query) {
         do_search_for_line(query, this);
      },
      start_multiple_search: function (text, options) {
         do_search_for_text(text, options, this);
      },
      cancel_search: function () {
         if (!this.state.ws) return;
         this.state.ws.send(JSON.stringify({
            cmd: 'metasearch.search.cancel'
         }));
         this.reset();
      },
      reset: function () {
         var _this = this;
         if (this.dom) {
            while (this.items.length) {
               var item = this.items.pop();
               this.dom.body.removeChild(item.dom);
            }
         }
      }
   };

   window.FlameSearchList = FlameSearchList;
})(window, document);
