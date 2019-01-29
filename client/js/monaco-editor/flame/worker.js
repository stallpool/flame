define(["require", "exports"], function (require, exports) {
   'use strict';
   Object.defineProperty(exports, "__esModule", { value: true });
   var FlameWorker = /** @class */ (function () {
      function FlameWorker(ctx, env) {
         this._languageService = lang_service_api.createLanguageService(this);
         this._ctx = ctx;
         this._lang = env.lang;
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
      FlameWorker.prototype.getCompletionsAtPosition = function (fileName, position) {
         var model = this._getModel(fileName);
         return Promise.resolve(this._languageService.getCompletionsAtPosition(model, position));
      };
      FlameWorker.prototype.getCompletionsEntryDetails = function (fileName, position, label) {
         var model = this._getModel(fileName);
         return Promise.resolve(this._languageService.getCompletionsEntryDetails(model, position, label));
      };
      FlameWorker.prototype.getQuickInfoAtPosition = function (fileName, position) {
         var model = this._getModel(fileName);
         return Promise.resolve(this._languageService.getQuickInfoAtPosition(model, position));
      };
      FlameWorker.prototype.getDefinitionAtPosition = function (fileName, position) {
         var model = this._getModel(fileName);
         return Promise.resolve(this._languageService.getDefinitionAtPosition(model, position));
      };
      return FlameWorker;
   }());
   exports.FlameWorker = FlameWorker;
   function create(ctx, createData) {
      return new FlameWorker(ctx, createData);
   }
   exports.create = create;

   // language service
   function SourceCode(model, worker) {
      this.model = model;
      this.worker = worker;
      this.text = model.getValue();
      this.lang = worker.getLanguageIdentifier() || null;
   }
   SourceCode.prototype = {
      check_update: function () {
         var text = this.model.getValue();
         if (this.text !== text) {
            this.text = text;
         }
      },
   };
   var source_code = null;
   function sync_host_data(model, worker) {
      if (!source_code) {
         source_code = new SourceCode(model, worker);
      }
      if (!source_code) return false;
      source_code.check_update(model);
      return true;
   };
   function get_language_token_at_position(model, position) {
      return null;
   }

   var lang_service_api = {
      createLanguageService: function (worker) {
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
               if (!sync_host_data(model, worker)) return null;
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
               if (!sync_host_data(model, worker)) return null;
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
