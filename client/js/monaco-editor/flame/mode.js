var __extends = (this && this.__extends) || (function () {
   var extendStatics = function (d, b) {
      extendStatics = Object.setPrototypeOf ||
         ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
         function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
      return extendStatics(d, b);
   };
   return function (d, b) {
      extendStatics(d, b);
      function __() { this.constructor = d; }
      d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
   };
})();
define(["require", "exports"], function (require, exports) {
   'use strict';
   Object.defineProperty(exports, "__esModule", { value: true });
   var flameWorker;
   var flameWorkerManager;
   function setupFlame(defaults, lang, information) {
      flameWorker = setupMode(defaults, lang, information);
   }
   exports.setupFlame = setupFlame;
   function getFlameWorker() {
      return new Promise(function (resolve, reject) {
         if (!flameWorker) {
            return reject("Flame mode is not registered!");
         }
         resolve(flameWorker);
      });
   }
   exports.getFlameWorker = getFlameWorker;
   function getFlameWorkerManager() {
      return new Promise(function (resolve, reject) {
         if (!flameWorkerManager) {
            return reject("Flame mode is not registered!");
         }
         resolve(flameWorkerManager);
      });
   }
   exports.getFlameWorkerManager = getFlameWorkerManager;
   function setupMode(defaults, modeId, information) {
      var client = new WorkerManager(modeId, defaults, information);
      flameWorkerManager = client;
      var worker = function (first) {
         var more = [];
         for (var _i = 1; _i < arguments.length; _i++) {
            more[_i - 1] = arguments[_i];
         }
         return client.getLanguageServiceWorker.apply(client, [first].concat(more));
      };
      monaco.languages.registerCompletionItemProvider(modeId, new SuggestAdapter(worker));
      monaco.languages.registerHoverProvider(modeId, new QuickInfoAdapter(worker));
      monaco.languages.registerDefinitionProvider(modeId, new DefinitionAdapter(worker));
      return worker;
   }

   function displayPartsToString(displayParts) {
      if (displayParts) {
         return displayParts.map(function (displayPart) { return displayPart.text; }).join("");
      }
      return "";
   }
   //#endregion
   var Adapter = /** @class */ (function () {
      function Adapter(_worker) {
         this._worker = _worker;
      }
      Adapter.prototype._positionToOffset = function (uri, position) {
         var model = monaco.editor.getModel(uri);
         return model.getOffsetAt(position);
      };
      Adapter.prototype._offsetToPosition = function (uri, offset) {
         var model = monaco.editor.getModel(uri);
         return model.getPositionAt(offset);
      };
      Adapter.prototype._textSpanToRange = function (uri, span) {
         var p1 = this._offsetToPosition(uri, span.start);
         var p2 = this._offsetToPosition(uri, span.start + span.length);
         var startLineNumber = p1.lineNumber, startColumn = p1.column;
         var endLineNumber = p2.lineNumber, endColumn = p2.column;
         return { startLineNumber: startLineNumber, startColumn: startColumn, endLineNumber: endLineNumber, endColumn: endColumn };
      };
      return Adapter;
   }());
   exports.Adapter = Adapter;
   var SuggestAdapter = /** @class */ (function (_super) {
      __extends(SuggestAdapter, _super);
      function SuggestAdapter() {
         return _super !== null && _super.apply(this, arguments) || this;
      }
      Object.defineProperty(SuggestAdapter.prototype, "triggerCharacters", {
         get: function () {
            return ['.'];
         },
         enumerable: true,
         configurable: true
      });
      SuggestAdapter.prototype.provideCompletionItems = function (model, position, _context) {
         var wordInfo = model.getWordUntilPosition(position);
         var offset = this._positionToOffset(resource, position);
         return this._worker(model.uri).then(function (worker) {
            return worker.getCompletionsAtPosition(model.uri.toString(), offset);
         }).then(function (info) {
            if (!info) {
               return;
            }
            var suggestions = info.entries.map(function (entry) {
               return {
                  uri: resource,
                  position: position,
                  label: entry.name,
                  insertText: entry.value,
                  sortText: entry.sortText
               };
            });
            return {
               suggestions: suggestions
            };
         });
      };
      SuggestAdapter.prototype.resolveCompletionItem = function (model, position, item) {
         var _this = this;
         var offset = this._positionToOffset(model.uri, position);
         return this._worker(model.uri).then(function (worker) {
            return worker.getCompletionEntryDetails(item.uri.toString(), offset, item.label);
         }).then(function (details) {
            if (!details) {
               return item;
            }
            return {
               uri: model.uri,
               position: item.position,
               label: details.name,
               detail: displayPartsToString(details.displayParts),
               documentation: {
                  value: displayPartsToString(details.documentation)
               }
            };
         });
      };
      return SuggestAdapter;
   }(Adapter));
   exports.SuggestAdapter = SuggestAdapter;
   // --- hover ------
   var QuickInfoAdapter = /** @class */ (function (_super) {
      __extends(QuickInfoAdapter, _super);
      function QuickInfoAdapter() {
         return _super !== null && _super.apply(this, arguments) || this;
      }
      QuickInfoAdapter.prototype.provideHover = function (model, position) {
         var _this = this;
         var offset = this._positionToOffset(model.uri, position);
         return this._worker(model.uri).then(function (worker) {
            return worker.getQuickInfoAtPosition(model.uri.toString(), offset);
         }).then(function (info) {
            if (!info) {
               return;
            }
            // contents support partial markdown
            // like ``` code ```, ()[link] ...
            var contents = [
               { value: displayPartsToString(info.displayParts) }
            ];
            var document = info.document;
            if (document) contents.push({ value: document });
            return {
               range: _this._textSpanToRange(model.uri, info.textSpan),
               contents: contents
            };
         });
      };
      return QuickInfoAdapter;
   }(Adapter));
   exports.QuickInfoAdapter = QuickInfoAdapter;
   // --- definition ------
   var DefinitionAdapter = /** @class */ (function (_super) {
      __extends(DefinitionAdapter, _super);
      function DefinitionAdapter() {
         return _super !== null && _super.apply(this, arguments) || this;
      }
      DefinitionAdapter.prototype.provideDefinition = function (model, position) {
         var _this = this;
         var offset = this._positionToOffset(model.uri, position);
         return this._worker(model.uri).then(function (worker) {
            return worker.getDefinitionAtPosition(model.uri.toString(), offset);
         }).then(function (entries) {
            if (!entries) {
               return;
            }
            var result = [];
            for (var _i = 0, entries_1 = entries; _i < entries_1.length; _i++) {
               var entry = entries_1[_i];
               result.push({
                  uri: model.uri,
                  range: _this._textSpanToRange(model.uri, entry.textSpan)
               });
            }
            return result;
         });
      };
      return DefinitionAdapter;
   }(Adapter));
   exports.DefinitionAdapter = DefinitionAdapter;
   /*---------------------------------------------------------------------------------------------
    *  Copyright (c) Microsoft Corporation. All rights reserved.
    *  Licensed under the MIT License. See License.txt in the project root for license information.
    *--------------------------------------------------------------------------------------------*/
   var WorkerManager = /** @class */ (function () {
      function WorkerManager(modeId, defaults, information) {
         var _this = this;
         this._information = information;
         this._modeId = modeId;
         this._defaults = defaults;
         this._worker = null;
         this._idleCheckInterval = setInterval(function () { return _this._checkIfIdle(); }, 30 * 1000);
         this._lastUsedTime = 0;
         this._configChangeListener = this._defaults.onDidChange(function () { return _this._stopWorker(); });
      }
      WorkerManager.prototype._stopWorker = function () {
         if (this._worker) {
            this._worker.dispose();
            this._worker = null;
         }
         this._client = null;
      };
      WorkerManager.prototype.dispose = function () {
         clearInterval(this._idleCheckInterval);
         this._configChangeListener.dispose();
         this._stopWorker();
      };
      WorkerManager.prototype._checkIfIdle = function () {
         if (!this._worker) {
            return;
         }
         var maxIdleTime = this._defaults.getWorkerMaxIdleTime();
         var timePassedSinceLastUsed = Date.now() - this._lastUsedTime;
         if (maxIdleTime > 0 && timePassedSinceLastUsed > maxIdleTime) {
            this._stopWorker();
         }
      };
      WorkerManager.prototype._getClient = function () {
         var _this = this;
         this._lastUsedTime = Date.now();
         if (!this._client) {
            this._worker = monaco.editor.createWebWorker({
               moduleId: '/js/monaco-editor/flame/worker',
               label: this._modeId,
               // passed in to the create() method
               createData: {
                  lang: this._modeId,
                  information: this._information
               }
            });
            var p = this._worker.getProxy();
            this._client = p;
         }
         return this._client;
      };
      WorkerManager.prototype.getLanguageServiceWorker = function () {
         var _this = this;
         var resources = [];
         for (var _i = 0; _i < arguments.length; _i++) {
            resources[_i] = arguments[_i];
         }
         var _client;
         return this._getClient().then(function (client) {
            _client = client;
         }).then(function (_) {
            return _this._worker.withSyncedResources(resources);
         }).then(function (_) { return _client; });
      };
      return WorkerManager;
   }());
   exports.WorkerManager = WorkerManager;
});
