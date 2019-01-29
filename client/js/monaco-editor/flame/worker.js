define(["require", "exports"], function (require, exports) {
   'use strict';
   Object.defineProperty(exports, "__esModule", { value: true });
   var FlameWorker = /** @class */ (function () {
      function FlameWorker(ctx, env) {
         this._languageService = lang_service_api.createLanguageService(this);
         this._ctx = ctx;
         this._lang = env.lang;
         this._information = env.information;
      }
      // --- language service host ---------------
      FlameWorker.prototype.getLanguageIdentifier = function () { return this._lang; };
      FlameWorker.prototype.getScriptFileNames = function () {
         var models = this._ctx.getMirrorModels().map(function (model) { return model.uri.toString(); });
         return models;
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
         } else return null;
         return {
            getText: function (start, end) { return text.substring(start, end); },
            getLength: function () { return text.length; },
            getChangeRange: function () { return undefined; }
         };
      };
      // --- language features
      FlameWorker.prototype.getCompletionsAtPosition = function (fileName, offset) {
         var model = this._getModel(fileName);
         return Promise.resolve(this._languageService.getCompletionsAtPosition(model, offset));
      };
      FlameWorker.prototype.getCompletionsEntryDetails = function (fileName, offset, label) {
         var model = this._getModel(fileName);
         return Promise.resolve(this._languageService.getCompletionsEntryDetails(model, offset, label));
      };
      FlameWorker.prototype.getQuickInfoAtPosition = function (fileName, offset) {
         var model = this._getModel(fileName);
         return Promise.resolve(this._languageService.getQuickInfoAtPosition(model, offset));
      };
      FlameWorker.prototype.getDefinitionAtPosition = function (fileName, offset) {
         var model = this._getModel(fileName);
         return Promise.resolve(this._languageService.getDefinitionAtPosition(model, offset));
      };
      FlameWorker.prototype.getInformation = function () {
         return this._information;
      }
      return FlameWorker;
   }());
   exports.FlameWorker = FlameWorker;
   function create(ctx, createData) {
      return new FlameWorker(ctx, createData);
   }
   exports.create = create;

   // language service

   function lookup_token (token_list, offset) {
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

   var lang_service_api = {
      createLanguageService: function (worker) {
         return {
            getCompletionsAtPosition: function (model, offset) {
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
            getQuickInfoAtPosition: function (model, offset) {
               var info = worker.getInformation();
               if (!info) return null;
               var token = lookup_token(info.tokens, offset);
               if (!token) return null;
               return {
                  documentation: [],
                  tags: null,
                  textSpan: {
                     start: token.startOffset,
                     length: token.endOffset - token.startOffset
                  },
                  displayParts: [{ text: token.description }]
               };
            }, // quick info
            getDefinitionAtPosition: function (model, offset) {
               return null;
   
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
