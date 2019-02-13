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

   function search_score(item, query) {
      var query_token_map = {};
      var score = 0;
      search_token_map(query_token_map, query.split(split_stops));
      search_token_map_normalize(query_token_map);
      item.matches.forEach(function (match) {
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
   
   function search_do_with_websocket(query, search_list) {
      if (search_list.state.searching) {
         // TODO: cancel search first and then setTimeout
         search_list.cancel_search();
         setTimeout(search_do_with_websocket, 1000, query, search_list);
         return;
      }
      var status = {};
      search_list.state.searching = true;
      search_list.items.forEach(function (c) {
         search_list.dom.body.removeChild(c.dom);
      });
      search_list.items = [];

      search_list.dom.info.innerHTML = generate_alert_html('Searching ...', query);
      client.websocket.connect(env, {
         onmessage: function (ev) {
            var data = JSON.parse(ev.data);
            if (data.result) {
               search_list.items.forEach(function (c) {
                  search_list.dom.body.removeChild(c.dom);
               });
               status[data.count] = true;
               var base_url = '#';
               var config = data.result.config;
               data.result.items.forEach(function (item) {
                  item.files.forEach(function (file) {
                     var obj = {
                        type: 'metasearch_source',
                        name: item.path + file.name,
                        uol: base_url + item.path + file.name,
                        matches: file.matches
                     };
                     var c = {
                        score: 0,
                        dom: build_item(obj)
                     };
                     if (!c.dom) return;
                     c.score = search_score(obj, query);
                     search_list.items.push(c);
                  });
               });
               search_list.items = search_list.items.sort(function (a,b) { return b.score-a.score; });
               search_list.items = search_list.items.slice(0, 25);
               search_list.items.forEach((c) => {
                  search_list.dom.body.appendChild(c.dom);
               });
            } else {
               if (data.count) {
                  for (var i = 0; i < data.count; i++) {
                     if (i in status) continue;
                     status[i] = false;
                  }
                  status._full = true;
                  status._count = data.count;
               } else {
                  status._full = true;
                  status._count = -1;
               }
            }
            if (check_status_complete()) {
               search_list.state.searching = false;
               console.log('Done.');
               if (search_list.items.length) {
                  search_list.dom.info.innerHTML = generate_alert_html('', query);
               } else {
                  search_list.dom.info.innerHTML = generate_alert_html('Nothing found.', query);
               }
               ev.target.close();
               if (search_list.events.on_search_complete) {
                  search_list.events.on_search_complete();
               }
            }
         }
      }).then((ws) => {
         if (search_list.events.on_search_start) {
            search_list.events.on_search_start(ws);
         }
         search_list.state.ws = ws;
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

   /////////////////////////////////////////////////////////////////////////////

   function build_list(base_dom) {
      var list = document.createElement('div');
      list.classList.add('tab-container');
      var header = document.createElement('div');
      header.classList.add('tab-row');
      var info = document.createElement('div');
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
         a.href = '#' + item.name + '?lineno=' + match.lineno;
         a.appendChild(document.createTextNode(match.text));
         td.appendChild(a);
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
      if (!url.startsWith('#')) {
         a.target = '_blank';
      }
      a.appendChild(document.createTextNode(name));
      if (url) {
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
   }
   FlameSearchList.prototype = {
      start_search: function (query) {
         search_do_with_websocket(query, this);
      },
      cancel_search: function () {
         if (!this.state.ws) return;
         this.state.ws.send(JSON.stringify({
            cmd: 'metasearch.search.cancel'
         }));
      },
   };

   window.FlameSearchList = FlameSearchList;
})(window, document);
