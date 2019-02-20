const common_stops = [
   '~', '`', '!', '@', '#', '$', '%', '^', '&', '*', '(', ')',
   '-', /*'_'*/, '=', '+', '{', '}', '[', ']', '\\', '|', ':', ';',
   '"', '\'', ',', '.', '<', '>', '/', '?', ' ', '\t', '\r', '\n'
];

const lang = {
   en: {
      // https://www.talkenglish.com/vocabulary/top-50-prepositions.aspx
      common_prep: [
         'of', 'to', 'in', 'for', 'on', 'with', 'by', 'at', 'but', 'from', 'about',
         /*'like'*/, 'into', 'through', 'over', 'between', 'since', 'around', 'during',
         'without', 'util', 'against', 'within', 'among', 'beyond', 'throughout',
         'despite', 'towards', 'upon'
      ]
   }
}

const TextAPI = {
   tokenizer: {
      basic: (text, keep_stops, stops, lowercase) => {
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
         if (lowercase !== false) lowercase = true;
         if (lowercase) return output.map((x) => x.toLowerCase());
         return output;
      },
      camel: (text, lowercase) => {
         if (!text) return [];
         let output = text.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/);
         if (lowercase !== false) lowercase = true;
         if (lowercase) return output.map((x) => x.toLowerCase());
         return output;
      }
   },
   tokens: {
      lower: (tokens) => tokens.map((x) => x.toLowerCase()),
      upper: (tokens) => tokens.map((x) => x.toUpperCase()),
      remove: {
         term_contains_digit: (tokens) => tokens.filter((x) => !/\d/.test(x)),
         term_is_num: (tokens) => tokens.filter((x) => {
            if (/^\d+$/.test(x)) return false;
            if (/^(\d+)?.\d+$/.test(x)) return false;
            return true;
         }),
         term_is_prep: (tokens) => tokens.filter((x) => lang.en.common_prep.indexOf(x) < 0),
         term_is_too_long: (tokens, n) => tokens.filter((x) => x.length <= n),
      },
      count: (tokens) => {
         let countmap = {};
         tokens.forEach((token) => {
            if (token in countmap) {
               countmap[token] ++;
            } else {
               countmap[token] = 1;
            }
         });
         return Object.keys(countmap).map((token) => {
            return {
               token, n: countmap[token]
            };
         });
      },
   },
   is: {
      email: (text) => /^([a-zA-Z0-9_\-\.]+)@([a-zA-Z0-9_\-\.]+)\.([a-zA-Z]{2,5})$/.test(text)
   }
};

module.exports = TextAPI;