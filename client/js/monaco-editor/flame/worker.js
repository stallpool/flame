define(["require", "exports", "vs/editor/common/modes"], function (require, exports, modes) {
   'use strict';
   Object.defineProperty(exports, "__esModule", { value: true });
   var FlameWorker = /** @class */ (function () {
       function FlameWorker(ctx, createData) {
           this._languageService = lang_service_api.createLanguageService(this);
           this._ctx = ctx;
       }
       // --- language service host ---------------
       FlameWorker.prototype.getScriptFileNames = function () {
           var models = this._ctx.getMirrorModels().map(function (model) { return model.uri.toString(); });
           return models.concat(Object.keys(this._extraLibs));
       };
       FlameWorker.prototype._getModel = function (fileName) {
           var models = this._ctx.getMirrorModels();
           for (var i = 0; i < models.length; i++) {
               if (models[i].uri.toString() === fileName) {
                   return models[i];
               }
           }
           return null;
       };
       FlameWorker.prototype.getScriptSnapshot = function (fileName) {
           var text;
           var model = this._getModel(fileName);
           if (model) {
               // a true editor model
               text = model.getValue();
           }
           else if (fileName in this._extraLibs) {
               // static extra lib
               text = this._extraLibs[fileName];
           }
           else {
               return;
           }
           return {
               getText: function (start, end) { return text.substring(start, end); },
               getLength: function () { return text.length; },
               getChangeRange: function () { return undefined; }
           };
       };
       // --- language features
       FlameWorker.prototype.getCompletionsAtPosition = function (model, position) {
           return Promise.resolve(this._languageService.getCompletionsAtPosition(model, position));
       };
       FlameWorker.prototype.getCompletionsEntryDetails = function (model, postion, label) {
          return Promise.resolve(this._languageService.getCompletionsEntryDetails(model, position, label));
       };
       FlameWorker.prototype.getQuickInfoAtPosition = function (model, position, token) {
           return Promise.resolve(this._languageService.getQuickInfoAtPosition(model, position, token));
       };
       FlameWorker.prototype.getDefinitionAtPosition = function (model, position, token) {
           return Promise.resolve(this._languageService.getDefinitionAtPosition(model, position, token));
       };
       return FlameWorker;
   }());
   exports.FlameWorker = FlameWorker;
   function create(ctx, createData) {
       return new FlameWorker(ctx, createData);
   }
   exports.create = create;

   // language service
   function SourceCode(model) {
      this.model = model;
      this.text = model.getValue();
      this.lang = model.getLanguageIdentifier() || {};
      this.lang = this.lang.language;
   }
   SourceCode.prototype = {
      check_update: function () {
         var text = this.model.getValue();
         if (this.text !== text) {
            this.text = text;
            this.tokenize();
         }
      },
      tokenize: function () {
         var _this = this;
         this.tokens = [];
         this.lineMap = [];
         if (this.lang) {
            var tokenizer = modes.TokenizationRegistry.get(this.lang);
            var state = tokenizer.getInitialState();
            var lines = this.text.split('\n');
            var text_offset = 0;
            lines.forEach(function (line) {
               _this.lineMap.push(text_offset);
               var r = tokenizer.tokenize(line, state, 0);
               if (r) {
                  r.tokens.forEach(function (token) {
                     token.offset += text_offset;
                     return token;
                  });
                  _this.tokens = _this.tokens.concat(r.tokens);
                  state = r.endState;
                  text_offset += line.length+1;
               } else {
                  throw 'Unknown parsing error.';
               }
            });
         }
         return this.tokens;
      },
      getOffset: function (lineNumber, column) {
         return this.lineMap[lineNumber-1] + column;
      },
      getText: function() {
         return this.text;
      },
      getTokens: function () {
         return this.tokens;
      },
      getTokenByOffset: function (offset) {
         var s = 0, e = this.tokens.length-1, m, t;
         while (1 < e - s) {
            m = ~~((s+e)/2);
            t = this.tokens[m];
            if (!t) return null;
            if (t.offset > offset) {
               e = m;
            } else if (t.offset < offset) {
               s = m;
            } else {
               return t;
            }
         }
         t = this.tokens[e];
         if (t.offset === offset) {
            return t;
         }
         t = this.tokens[s];
         if (e === s && t.offset !== offset) {
            return null;
         }
         return t;
      },
      formatTokenType: function (original_token_type) {
         var type = original_token_type.split('.')[0];
         if (type === 'source') return null;
         if (type.startsWith('custom-')) {
            return type.split('-').slice(1).join('');
         }
         return type;
      },
      getTokenType: function (token) {
         return this.formatTokenType(token.type);
      },
   };
   var source_code = null;
   function sync_host_data(model) {
      if (!source_code) {
         source_code = new SourceCode(model);
         source_code.tokenize();
      }
      if (!source_code) return false;
      source_code.check_update(model);
      return true;
   };
   function get_language_token_at_position(model, position) {
      var line = model.getLineTokens(position.lineNumber);
      var index = line.findTokenIndexAtOffset(position.column);
      var token = {
         start: line.getStartOffset(index),
         end: line.getEndOffset(index),
      };
      token.text = line.getLineContent().substring(token.start, token.end);
      token.offset = source_code.getOffset(position.lineNumber, token.start);
      token.ref = source_code.getTokenByOffset(token.offset);
      token.ref_type = source_code.getTokenType(token.ref);
      if (!token.ref_type) return null;
      return token;
   }

   var lang_service_api = {
      createLanguageService: function (host) {
         return {
            getCompletionsAtPosition: function (model, position) {
               return {
                  entries: [{
                     name: 'debug',
                     value: 'debug',
                     sortText: 0
                  }, {
                     name: 'hello world',
                     value: 'hello world',
                     sortText: 0
                  }]
               };
            }, // auto compute - list
            getCompletionEntryDetails: function (model, position, label) {
               return {
                  uri: model.uri,
                  position: position,
                  name: label,
                  displayParts: [{text: 'more description'}],
                  documentation: []
               };
            }, // auto complete - item detail
            getQuickInfoAtPosition: function (model, position) {
               if (!sync_host_data(model)) return null;
               var token = get_language_token_at_position(model, position);
               if (!token) return null;
   
               var displayed_text = '[' + token.ref_type + '] ' + token.text;
               return {
                  documentation: [],
                  tags: null,
                  textSpan: {
                     length: token.text.length,
                     start: token.offset
                  },
                  displayParts: [{text: displayed_text}]
               };
            }, // quick info
            getDefinitionAtPosition: function (model, position) {
               if (!sync_host_data(model)) return null;
               var token = get_language_token_at_position(model, position);
               if (!token) return null;
   
               return [{
                  containterName: 'debug',
                  kind: 'constructor',
                  name: '__constructor',
                  textSpan: {
                     start: 0,
                     length: token.text.length
                  }
               }];
            } // definition
         };
      }
   };
   exports.lang_service_api = lang_service_api;
});
