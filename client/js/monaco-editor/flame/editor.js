'use strict';

// @include monaco-editor/dev/vs/loader.js

(function (window, document) {
   function guess_lang_from_ext(path) {
      var langs = monaco.languages.getLanguages();
      var ext = path.split('.');
      if (ext.length > 1) ext = ext.pop(); else ext = null;
      if (!ext) return null;
      ext = '.' + ext;
      var lang = langs.filter(function (lang) {
         if (!lang.extensions) return false;
         return lang.extensions.indexOf(ext) >= 0;
      })[0];
      if (!lang) return null;
      return lang.id;
   }

   function FlameTextModelService (options) {
      this.options = options;
   }
   FlameTextModelService.prototype = {
      createModelReference: function (uri) {
         return this.getModel(uri);
      },
      registerTextModelContentProvider: function () {
         return { dispose: function () {} };
      },
      hasTextModelContentProvider: function (schema) {
         return true;
      },
      getModel: function (uri) {
         var _this = this;
         return new Promise(function (r) {
            var model = monaco.editor.getModel(uri);
            if (!model) {
               // e.g. monaco.editor.createModel('', 'javascript', uri);
               if (_this.options && _this.options.fetchText) {
                  _this.options.fetchText(uri).then(
                     function (text) {
                        r(monaco.editor.createModel(text, '', uri));
                     },
                     function () {
                        r(null);
                     }
                  );
                  return;
               }
            }
            r(model);
         });
      }
   };

   // TODO: deep customize hover widget
   // contribution: editor.contrib.hover
   //       action: editor.action.showHover
   // registerEditorContribution, registerEditorAction
   function FlameEditor (dom) {
      this.self = dom;
      this.api = null;
      this.global = null;
      this.hook = {};
      this._backup = {};
   }
   FlameEditor.prototype = {
      create: function (filename, text, information, options) {
         var _this = this;
         if (_this._content_loading) return e(_this._content_loading);
         if (!options) options = {};
         // readOnly: true
         require([
            'vs/editor/editor.main',
            'flame/monaco.contribution'
         ], function () {
            var lang =  guess_lang_from_ext(filename);
            var theme = options.theme || options.language || lang;
            var modelService = new FlameTextModelService({
               fetchText: function (uri) {
                  if (_this.hook.on_content_load) return _this.hook.on_content_load(uri);
                  return Promise.resolve(null);
               }
            });
            _this.global = monaco;
            _this.api = monaco.editor.create(_this.self, options, {
               textModelService: modelService,
               automaticLayout: true,
            });
            patch_minimap_touch(_this.api);
            modelService.createModelReference(monaco.Uri.parse(filename)).then(function (model) {
               if (!model) model = monaco.editor.createModel(text, lang, monaco.Uri.parse(filename));
               _this.api.setModel(model);
               _this.set_language(lang, theme);
            }, function () {
               // TODO: deal with loading fail
            });
         });

         function patch_minimap_touch(editor) {
            var minimap = editor._modelData.view.viewParts.filter((x) => x._slider)[0];
            if (!minimap) return;
            var vscode_dom = require('vs/base/browser/dom');
            minimap._sliderTouchStartListener = vscode_dom.addStandardDisposableListener(
               minimap._slider.domNode, 'touchstart', function(evt) {
                  evt.preventDefault();
                  var touch = evt.touches[0];
                  if (!touch) return;
                  if (!minimap._lastRenderData) return;
                  minimap._slider.toggleClassName('active', true);
                  var initialMousePosition = touch.clientY;
                  var initialSliderState = minimap._lastRenderData.renderedLayout;
                  var monitor_move = vscode_dom.addStandardDisposableListener(document.body, 'touchmove', function (e) {
                     var touch = e.touches[0];
                     if (!touch) return;
                     var mouseDelta = touch.clientY - initialMousePosition;
                     minimap._context.viewLayout.setScrollPositionNow({
                        scrollTop: initialSliderState.getDesiredScrollTopFromDelta(mouseDelta)
                     });
                  });
                  var monitor_stop = vscode_dom.addStandardDisposableListener(document.body, 'touchend', function (e) {
                     minimap._slider.toggleClassName('active', false);
                     monitor_move.dispose();
                     monitor_stop.dispose();
                  });
               }
            );
         }
      },
      resize: function () {
         this.self.parentNode.style.height = Math.floor(
            window.innerHeight -
            this.self.parentNode.parentNode.parentNode.offsetTop -
            this.self.parentNode.offsetTop/2
         ) + 'px';
         this.self.style.height = Math.floor(
            window.innerHeight -
            this.self.parentNode.parentNode.parentNode.offsetTop -
            this.self.parentNode.offsetTop/2
         ) + 'px';
      },
      dispose: function () {
         if (!this.api) return;
         if (this._backup.on_definition_click) this._backup.on_definition_click = null;
         this.api.dispose();
      },
      on_content_ready: function (fn, self) {
         if (!self) self = this;
         if (!self.api) {
            return setTimeout(self.on_content_ready, 0, fn, self);
         }
         fn && fn();
      },
      on_content_load: function (fn) {
         this.hook.on_content_load = fn;
      },
      on_definition_click: function (fn) {
         // hack way to take control on definition click (ctrl+click, cmd+click)
         /* in fn(ev):
            ev: {
               hasSideBySideModifier,
               hasTriggerModifier,
               isNoneOrSingleMouseDown,
               target: {
                  detail: {horizontalDistanceToText, isAfterLines},
                  element (dom),
                  // `startColumn <= mouseColumn <= endColumn` to check if click on a word
                  mouseColumn,
                  position: {lineNumber, column},
                  range: {startLineNumber, startColumn, endLineNumber, endColumn},
                  type
               },
            }
         */
         if (!this.api) return;
         var _this = this;
         var contrib_gotodefinition = this.api.getContribution('editor.contrib.gotodefinitionwithmouse');
         contrib_gotodefinition.toUnhook.forEach(function (x) {
            if (!x || !x.onExecute) return;
            if (!_this._backup.on_definition_click) {
               _this._backup.on_definition_click = x._onExecute._listeners._first.element;
            }
            x._onExecute._listeners._first.element = fn;
         });
      },
      set_language: function (lang, theme) {
         if(!this.api) return;
         var model = this.api.getModel();
         lang = lang || '__unkown__';
         monaco.editor.setModelLanguage(model, lang);
         monaco.editor.setTheme(theme || lang);
      },
      set_text: function (text) {
         this.api.setValue(text);
      },
      set_position: function (line_no, column) {
         this.api.revealPositionInCenter({
            lineNumber: line_no,
            column: column
         });
      },
      set_selection: function (start_line_no, start_column, end_line_no, end_column) {
         this.api.setSelection({
            startLineNumber: start_line_no,
            startColumn: start_column,
            endLineNumber: end_line_no,
            endColumn: end_column
         });
      },
      define_directory_lang: function () {
         var lang = 'flameInternalDirectory';
         var lang_item = monaco.languages.getLanguages().filter(
            function (x) { return x.id == lang; }
         )[0];
         if (!lang_item) {
            monaco.languages.register({
               id: lang,
               extensions: ['.__dir__']
            });
            monaco.languages.setMonarchTokensProvider(lang, {
               tokenizer: {
                  root: [
                     [/\.\/[^\s]+[\s]/, 'custom-file']
                  ]
               }
            });
            monaco.editor.defineTheme(lang, {
               base: 'vs',
               inherit: false,
               rules: [
                  { token: 'custom-file', foreground: '008888' }
               ]
            });
         }
         this.set_language(lang, lang);
      },
      show: function () {
         this.self.style.display = 'block';
      },
      hide: function () {
         this.self.style.display = 'none';
      }
   };

   window.FlameTextModelService = FlameTextModelService;
   window.FlameEditor = FlameEditor;
})(window, document);

