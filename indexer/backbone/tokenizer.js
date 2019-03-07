const i_fs = require('fs');
const i_path = require('path');
const i_lazac_common = require('../../lazac/parser/common');
const i_parser = {
   c: require('../../lazac/parser/lang/c'),
   cpp: require('../../lazac//parser/lang/cpp'),
   java: require('../../lazac//parser/lang/java'),
   csharp: require('../../lazac//parser/lang/csharp'),
   go: require('../../lazac//parser/lang/go'),
   javascript: require('../../lazac//parser/lang/javascript'),
   python: require('../../lazac//parser/lang/python'),
   ruby: require('../../lazac//parser/lang/ruby'),
};

function c_tokens(raw_tokens) {
   let tokens = {
      language: 'c',
      include_ref: [],
      export_ref: [],
   };
   // include_ref: { name, startOffset, endOffset }
   // export_ref: { name, symbol_list: [{name, startOffset, endOffset}], startOffset, endOffset }
   raw_tokens.forEach((token) => {
      if (token.token !== '#include') return;
      let ref = {};
      let xtoken;
      if (token.name[1] - token.name[0] === 1) {
         xtoken = raw_tokens[token.name[0]];
         ref.startOffset = xtoken.startOffset + 1;
         ref.endOffset = xtoken.endOffset - 1;
         ref.name = xtoken.token.substring(1, xtoken.token.length - 1);
      } else {
         xtoken = raw_tokens[token.name[0]];
         ref.startOffset = xtoken.endOffset;
         xtoken = raw_tokens[token.name[1] - 1];
         ref.endOffset = xtoken.startOffset;
         ref.name = raw_tokens.slice(
            token.name[0]+1, token.name[1]-1
         ).map((x) => x.token).join('').trim();
      }
      tokens.include_ref.push(ref);
   });
   let current_function = null;
   raw_tokens.forEach((token, i) => {
      if (current_function && current_function.endIndex <= i) {
         current_function = null;
      }
      if (token.tag === 'keyword') return;
      if (i_lazac_common.stops.indexOf(token.token.charAt(0)) >= 0) return;
      if (token.tag === 'function') {
         let xtoken = raw_tokens[token.name[0]];
         let symbol_list = [];
         let ref = {
            startOffset: xtoken.startOffset,
            endOffset: xtoken.endOffset,
            name: xtoken.token,
            symbol_list,
         };
         current_function = {
            startIndex: token.startIndex,
            endIndex: token.endIndex,
            symbol_list,
         };
         xtoken = raw_tokens[token.endIndex];
         if (xtoken.token === ';') ref.declare = true;
         tokens.export_ref.push(ref);
      } else if (current_function) {
         current_function.symbol_list.push({
            startOffset: token.startOffset,
            endOffset: token.endOffset,
            name: token.token,
         });
      }
   });
   return tokens;
}

function convert_index_to_offset(raw_tokens) {
   let last_offset = 0;
   raw_tokens.forEach((token) => {
      token.startOffset = last_offset;
      if (token.token) {
         token.endOffset = token.startOffset + token.token.length;
         last_offset = token.endOffset;
      } else {
         token.endOffset = token.startOffset + token.comment.length;
         last_offset = token.endOffset;
      }
   });
}

function tokenize(filename) {
   return new Promise((r) => {
      console.log('parse', filename);
      let tokens = null;
      let text = i_fs.readFileSync(filename).toString();
      let ext = i_path.extname(filename);
      switch (ext) {
         case '.c':
         case '.h':
            tokens = i_parser.c.parse(text);
            convert_index_to_offset(tokens);
            tokens = c_tokens(tokens);
            tokens.path = filename;
            break;
         /*
         case '.cc':
         case '.hh':
         case '.cpp':
         case '.hpp': tokens = i_parser.cpp.parse(text); break;
         case '.java': tokens = i_parser.java.parse(text); break;
         case '.cs': tokens = i_parser.csharp.parse(text); break;
         case '.go': tokens = i_parser.go.parse(text); break;
         case '.js': tokens = i_parser.javascript.parse(text); break;
         case '.py': tokens = i_parser.python.parse(text); break;
         case '.rb': tokens = i_parser.ruby.parse(text); break;
         */
         default: tokens = {};
      }
      r(tokens);
   }).catch((e) => console.log(filename));
}

module.exports = {
   tokenize,
};