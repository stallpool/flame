const i_path = require('path');
const i_monarch = require('monarch.js');

const tokenizer_set = {
   bat: require('./lang/bat/tokenizer'),
   cpp: require('./lang/cpp/tokenizer'),
   csharp: require('./lang/csharp/tokenizer'),
   css: require('./lang/css/tokenizer'),
   go: require('./lang/go/tokenizer'),
   html: require('./lang/html/tokenizer'),
   java: require('./lang/java/tokenizer'),
   javascript: require('./lang/javascript/tokenizer'),
   lua: require('./lang/lua/tokenizer'),
   'objective-c': require('./lang/objective-c/tokenizer'),
   perl: require('./lang/perl/tokenizer'),
   python: require('./lang/python/tokenizer'),
   ruby: require('./lang/ruby/tokenizer'),
   shell: require('./lang/shell/tokenizer'),
   sql: require('./lang/sql/tokenizer'),
   swift: require('./lang/swift/tokenizer'),
   typescript: require('./lang/typescript/tokenizer'),
   xml: require('./lang/xml/tokenizer'),
};
Object.keys(tokenizer_set).forEach((lang) => {
   tokenizer_set[lang] = i_monarch.Tokenizer(lang, tokenizer_set);
});

const ext_map = {
   bat: ['.bat'],
   cpp: ['.h', '.c', '.cc', '.hh', '.cpp', '.hpp', '.cxx', '.hxx'],
   csharp: ['.cs'],
   css: ['.css'],
   go: ['.go'],
   html: ['.html', '.htm', '.xhtml'],
   java: ['.java'],
   javascript: ['.js'],
   lua: ['.lua'],
   'objective-c': ['.m', '.mm'],
   perl: ['.pl'],
   python: ['.py'],
   ruby: ['.rb'],
   shell: ['.sh'],
   sql: ['.sql'],
   swift: ['.swift'],
   typescript: ['.ts'],
   xml: ['.xml', '.svg']
};

const ext_reversed_map = {};
Object.keys(ext_map).forEach((lang) => {
   let exts = ext_map[lang];
   exts.forEach((ext) => {
      ext_reversed_map[ext] = lang;
   });
});

const common_stops = [
   '~', '`', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
   '-', '_', '=', '+', '{', '}', '[', ']', '\\', '|', ':', ';',
   '"', '\'', ',', '.', '<', '>', '/', '?', ' ', '\t', '\r', '\n'
];

function tokenize_basic (text, keep_stops, stops) {
   if (!text) return [];
   let output = [];
   let n = text.length;
   let last = 0;
   if (!stops) stops = common_stops;
   for (let i = 0; i < n; i++) {
      let ch = text.charAt(i);
      let ch_code = ch.charCodeAt(0);
      if (stops.indexOf(ch) >= 0) {
         if (last < i) {
            output.push(text.substring(last, i));
         }
         if (keep_stops) output.push(ch);
         last = i + 1;
      } else if (ch_code < 0 || ch_code > 127) {
         // hello你好 ==> [hello, 你, 好]
         if (last < i) {
            output.push(text.substring(last, i));
         }
         // multiple lang
         output.push(ch);
         last = i + 1;
      }
   }
   if (last < n) output.push(text.substring(last));
   return output;
}

function tokenize_camelcase() {
   if (!text) return [];
   let output = text.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
   if (lowercase !== false) lowercase = true;
   if (lowercase) return output.map((x) => x.toLowerCase());
   return output;
}

function translate_moarch_tokens(text, tokens) {
   //     origin token = { offset, type, language }
   // translated token = { value, type, language }
   for (let n = tokens.length-1, i = 0; i < n; i++) {
      tokens[i].end_offset = tokens[i+1].offset;
   }
   tokens[tokens.length-1].end_offset = text.length;
   let results = [];
   tokens.forEach((token) => {
      let value = text.substring(token.offset, token.end_offset);
      return {
         type: token.type,
         language: token.language,
         value: text.substring(token.offset, token.end_offset)
      };
   });
   return results;
}

function translate_basic_tokens(text, tokens) {
   //     origin token = string
   // translated token = { value }
   return tokens.map((token) => {
      return {
         value: token
      };
   });
}

function get_lang_by_filename(filename) {
   let extname = i_path.extname(filename);
   return ext_reversed_map(extname) || null;
}

function tokenize (text, lang) {
   let tokens = null;
   if (tokenizer_set[lang]) {
      tokens = tokenizer_set[lang](text);
      tokens = translate_moarch_tokens(text, tokens);
   } else {
      tokens = tokenize_basic(text, true);
      tokens = translate_basic_tokens(text, tokens);
   }
   return tokens;
}

const api = {
   language: {
      by_filename: get_lang_by_filename
   },
   tokenize,
   tokenize_basic,
   tokenize_camelcase,
};

module.exports = api;