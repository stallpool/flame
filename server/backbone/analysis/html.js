const i_text = require('./text');

function is_tag_no_children(tag_name) {
   return ['meta', 'link', 'img', 'i', 'input', 'br', 'hr'].indexOf(tag_name) >= 0;
}

function is_space(ch) {
   return [' ', '\t', '\n', '\r'].indexOf(ch) >= 0;
}

function build_dom(tokens) {
   let n, i, x;
   n = tokens.length;
   tokens = tokens.map((x) => {return { val: x };});
   // first round mark '<' and '>'
   for (i = 0; i < n; i++) {
      x = tokens[i];
      if (x.val === '<') x.tag_start = i;
      else if (x.val === '>') x.tag_end = i;
   }
   // second round
   tokens = decorate(tokens);
   // third round
   let dom_root = connect(tokens);
   return dom_root;
}

function tree_without_parent(root) {
   let new_root = Object.assign({}, root);
   delete new_root.parent;
   let queue = [new_root];
   while (queue.length) {
      let cursor = queue.shift();
      if (!cursor.children) continue;
      cursor.children = cursor.children.map((x) => {
         let item = Object.assign({}, x);
         delete item.parent;
         queue.push(item);
         return item;
      });
   }
   return new_root;
}

function connect(decorated_tokens) {
   let tokenpos_to_textpos = [0], lastpos = 0;
   decorated_tokens.forEach((x) => {
      lastpos += x.val.length;
      tokenpos_to_textpos.push(lastpos);
   });
   let root = {
      parent: null,
      children: [],
      html: decorated_tokens.map((x) => x.val).join(''),
   };
   let stack = [root], cursor = root;
   let n, i;

   for (n = decorated_tokens.length, i = 0; i < n; i++) {
      let x = decorated_tokens[i];
      if (x.tag_name) {
         switch(x.tag_prefix) {
            case '/':
            // <div><span>hello world</div> ==autofix==> <div><span>hello world</span></div>
            while (x.tag_name !== cursor.tag_name) {
               if (cursor === root) break;
               let trucated_element = cursor;
               stack.pop();
               cursor = cursor.parent;
               trucated_element.position.b1 = tokenpos_to_textpos[x.tag_start];
               trucated_element.position.b2 = tokenpos_to_textpos[x.tag_start];
               continue;
            }
            if (x.tag_name === cursor.tag_name) {
               cursor.position.b1 = tokenpos_to_textpos[x.tag_start];
               cursor.position.b2 = tokenpos_to_textpos[x.tag_end];
               stack.pop();
               cursor = cursor.parent;
            }
            break;
            case '!':
            case '?':
            default:
            let new_element = {
               parent: cursor,
               children: [],
               tag_name: x.tag_name,
               attributes: x.attributes,
               position: {
                  // a1-a2 b1-b2
                  // self close -> a1=b1 a2=b2
                  a1: tokenpos_to_textpos[x.tag_start],
                  a2: tokenpos_to_textpos[x.tag_end],
               }
            };
            if (x.attributes) {
               new_element.id = x.attributes.id;
               new_element.classList = x.attributes.class?x.attributes.class.split(' '):[];
            }
            if (x.tag_type) new_element.tag_type = x.tag_type;
            if (is_tag_no_children(cursor.tag_name)) {
               // these elements should not have children
               // <meta>  <link>  <img>  <i>  <input>  <br>  <hr>
               // <meta/> <link/> <img/> <i/> <input/> <br/> <hr/>
               cursor = cursor.parent;
               stack.pop();
            } else if (cursor.tag_name === 'p' && new_element.tag_name === 'p') {
               // <p> should not have a child of <p>
               // <p>123    <p>456
               // <p>123</p><p>456</p>
               cursor = cursor.parent;
               stack.pop();
            }
            stack.push(new_element);
            cursor.children.push(new_element);
            cursor = new_element;
            if (x.tag_self_close) {
               new_element.position.b1 = new_element.position.a2;
               new_element.position.b2 = new_element.position.a2;
               stack.pop();
               cursor = new_element.parent;
            }
         }
         i = x.tag_end;
      } else {
         let last_children = cursor.children[cursor.children.length-1];
         let text_node;
         if (last_children && last_children.tag_type === 'text') {
            text_node = last_children;
            text_node.position.a2 = tokenpos_to_textpos[i+1];
            text_node.position.b2 = tokenpos_to_textpos[i+1];
         } else {
            text_node = {
               tag_type: 'text',
               parent: cursor,
               position: {
                  a1: tokenpos_to_textpos[i],
                  a2: tokenpos_to_textpos[i+1],
                  b1: tokenpos_to_textpos[i],
                  b2: tokenpos_to_textpos[i+1],
               }
            }
            if (is_tag_no_children(cursor.tag_name)) {
               cursor = cursor.parent;
               stack.pop();
            }
            cursor.children.push(text_node);
         }
      }
   }
   return root;
}

function decorate(tokens) {
   let n, i, x, r;
   let x1, j, k;
   let name, val;
   n = tokens.length;
   for (i = 0; i < n; i++) {
      x = tokens[i];
      if ('tag_end' in x) delete x.tag_end;
      if (!('tag_start' in x)) continue;
      j = i + 1;
      x1 = tokens[j];
      if (x1) {
         // < div> ==> &lt; div&gt;
         if (is_space(x1.val)) {
            delete x.tag_start;
            continue;
         }
         // <!-- <!doctype <?xml </div
         if (['!', '?', '/'].indexOf(x1.val) >= 0) {
            // TODO: support <![CDATA[ ... ]]>
            x.tag_prefix = x1.val;
            x1 = tokens[++j];
            if (x1 && x1.val === '-') {
               x1 = tokens[++j];
               if (x1 && x1.val === '-') {
                  // comment
                  j += 2; // skip -- to avoid accept <-->
                  while (j < n) {
                     x1 = tokens[j];
                     if (x1.tag_start) delete x1.tag_start;
                     if (x1.tag_end) {
                        if (tokens[j-1].val === '-' && tokens[j-2].val === '-') {
                           x.tag_end = x1.tag_end;
                           x.tag_type = 'comment';
                           x.tag_name = '--';
                           x.tag_self_close = true;
                           delete x1.tag_end;
                           break;
                        }
                        delete x1.tag_end;
                     }
                     j ++;
                  }
                  i = j;
                  continue;
               }
            } // check <!-- <?--
            // <!doctype ...> ==autofix==> <!doctype ... />
         } // check <! <? </
         // <!doctype, <div, <?xml
         k = get_name(tokens, j);
         name = token_to_string(tokens, j, k);
         // XXX: need toLowerCase()?
         x.tag_name = name.toLowerCase();
         j = k;
         // check /> and >
         while (j < n) {
            x1 = tokens[j];
            if (x1.val === '/') {
               x.tag_self_close = true;
               // assume next is > for />
               j ++;
               x1 = tokens[j];
               if (x1) {
                  x.tag_end = x1.tag_end;
                  delete x1.tag_end;
               } else {
                  x.tag_end = n;
               }
               break;
            } else if (x1.val === '>') {
               x.tag_end = x1.tag_end;
               delete x1.tag_end;
               if (['!', '?'].indexOf(x.tag_prefix) >= 0) {
                  x.tag_self_close = true;
               } else {
                  x.tag_self_close = false;
               }
               break;
            }
            j = find_non_space(tokens, j);
            k = get_name(tokens, j);
            name = token_to_string(tokens, j, k);
            k = find_non_space(tokens, k);
            x1 = tokens[k];
            if (x1 && x1.val === '=') {
               k = find_non_space(tokens, k+1);
               j = get_value(tokens, k);
               val = token_to_string(tokens, k, j);
               if (['"', "'"].indexOf(val.charAt(0)===0)) {
                  let tail = val.indexOf(val.charAt(0), 1);
                  val = val.substring(1, tail);
               }
               j = find_non_space(tokens, j);
            } else {
               val = '';
               j = k;
            }
            if (!x.attributes) x.attributes = {};
            x.attributes[name] = val;
         } // tag_attribute + tag_end
         // if <script>, find nearest next </script>; skip <script/>
         if (x.tag_name === 'script' && !x.tag_prefix && !x.tag_self_close) {
            j = x.tag_end + 1;
            while (j < n) {
               x = tokens[j];
               if ('tag_end' in x) delete x.tag_end;
               if ('tag_start' in x) {
                  x1 = tokens[j+1];
                  if (x1 && x1.val === '/') {
                     x1 = tokens[j+2];
                     if (x1 && x1.val === 'script') {
                        x1 = tokens[j+3];
                        if (x1 && x1.val === '>') {
                           break;
                        }
                     }
                  }
                  delete x.tag_start;
               }
               j++;
            } // scan for </script>
         }
      } // check x1
   } // loop
   return tokens;
}

function token_to_string(tokens, i, j) {
   return tokens.slice(i, j).map((x) => x.val).join('');
}

function get_name(tokens, i) {
   let n = tokens.length, x;
   while (i < n) {
      x = tokens[i];
      if (is_space(x.val)) return i;
      if (['>', '=', '/'].indexOf(x.val) >= 0) return i;
      i ++;
   }
   return n;
}

function get_value(tokens, i) {
   let n = tokens.length, x;
   x = tokens[i];
   if (x.val === '"' || x.val === "'") {
      return get_string(tokens, i, x.val);
   } else {
      while (i < n) {
         x = tokens[i];
         if (is_space(x.val)) return i;
         // <div a=0>  <img src=xxx/>
         if (['>', '/'].indexOf(x.val) >= 0) return i;
         i ++;
      }
      return n;
   }
}

function get_string(tokens, i, pair_ch) {
   let n = tokens.length, x;
   i ++;
   while (i < n) {
      x = tokens[i];
      if (x.val === pair_ch) {
         x = tokens[i-1];
         if (x.val !== '\\') {
            return i+1;
         }
      }
      i ++;
   }
   return n;
}

function find_non_space(tokens, pos) {
   let n, i, x;
   n = tokens.length;
   for (i = pos; i < n; i++) {
      x = tokens[i];
      if (is_space(x.val)) continue;
      return i;
   }
   return n;
}

function select(doc, selector) {
   let elements = [doc];
   let selectors = selector.split(' ');
   let flags = {
      gt: false
   };
   selectors.forEach((selector) => {
      if (!selector) return;
      if (selector === '>') {
         flags.gt = true;
         return;
      }
      selector = split_selector(selector);
      selector.flag_gt = flags.gt;
      elements = sub_select(elements, selector);
      if (flags.gt) flags.gt = false;
   });
   return elements;
};

function sub_select(elements, selector /* str */) {
   let list = [];
   elements.forEach((element) => {
      search(element, selector, list);
   });
   return list;
}
function split_selector(selector) {
   // preprocess: ignore [] and :
   // e.g. a[value=1], a:before
   selector = selector.split('[')[0].split(':')[0];
   let t, tag = null, id = null, klass = null;
   t = selector.split('#');
   if (t.length === 2) {
      tag = t[0];
      id = t[1];
   } else {
      tag = t[0];
      id = null;
   }
   if (!tag) tag = null;
   tag = tag && tag.split('.');
   id = id && id.split('.');
   if (tag && tag.length > 1) {
      klass = tag[1];
   } else if (id && id.length > 1) {
      klass = id[1];
   }
   tag = tag && tag[0];
   id = id && id[0];
   return {
      tag, id, klass
   }
}
function search(element, selector, list) {
   if (!element || !element.children) return;
   element.children.forEach((node) => {
      let match = true;
      if (selector.tag && node.tag_name !== selector.tag) {
         match = false;
      }
      if (selector.id && node.id !== selector.id) {
         match = false;
      }
      if (!node.classList) {
         match = false;
      }
      if (selector.klass && node.classList && node.classList.indexOf(selector.klass) < 0) {
         match = false;
      }
      if (!match) {
         if (!selector.flag_gt) search(node, selector, list);
         return;
      }
      if (node.tag_type === 'text' || node.tag_type === 'comment') return;
      if (!node.children) return;
      if (list.indexOf(node) < 0) list.push(node);
      if (!selector.flag_gt) search(node, selector, list);
   });
}

const api = {
   parse: (html) => {
      let tokens = i_text.tokenizer.basic(html, true, undefined, false);
      return build_dom(tokens);
   },
   parse_without_parent_info: (html) => {
      return tree_without_parent(api.parse(html));
   },
   select: (html_elem, selector) => {
      if (!html_elem) return [];
      let todo = Array.isArray(html_elem)?html_elem:[html_elem];
      let unique = new Set();
      todo.forEach((elem) => {
         select(elem, selector).forEach((sub_elem) => {
            unique.add(sub_elem);
         });
      });
      return Array.from(unique);
   },
   dom: {
      to_text: (origin, html_elem) => {
         if (!html_elem) return '';
         if (!html_elem.children) {
            if (html_elem.tag_type === 'text') {
               let p = html_elem.position;
               let start = p.a1, end = p.a2;
               if (start > end) return '';
               return origin.substring(start, end);
            }
            return '';
         }
         if (
            html_elem.tag_type === 'comment' ||
            ['script', 'style', 'doctype'].indexOf(html_elem.tag_name) >= 0
         ) return '';
         return html_elem.children.map(
            (child) => api.dom.to_text(origin, child)
         ).join(' ');
      },
      to_inner_html: (origin, html_elem) => {
         if (!html_elem) return '';
         let p = html_elem.position;
         let start = p.a2+1, end = p.b1;
         if (start > end) return '';
         return origin.substring(start, end);
      }
   },
   __sample__
};

function __sample__() {
   console.log(
      JSON.stringify(
         api.parse_without_parent_info(process.argv[2]),
         null, 3
      )
   );

   console.log(
      JSON.stringify(
         api.select(
            api.parse_without_parent_info(process.argv[2]), '#hello'
         ).map(
            (x) => {
               let text = api.dom.to_text(process.argv[2], x);
               let html = api.dom.to_inner_html(process.argv[2], x);
               x = Object.assign({}, x);
               x.text = text;
               x.html = html;
               return x;
            }
         ).map((x) => {
            delete x.children;
            delete x.position;
            return x;
         }), null, 3
      )
   );
}

module.exports = api;
