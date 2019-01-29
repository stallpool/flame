'use strict';

// @include monaco-editor/dev/vs/loader.js

(function (window, document) {
   function FlameEditor (dom) {
      this.self = dom;
      this.api = null;
      this.global = null;
   }

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

   FlameEditor.prototype = {
      create: function (filename, text, options) {
         var _this = this;
         if (_this._content_loading) return e(_this._content_loading);
         if (!options) options = {};
         // readOnly: true
         require([
            'vs/editor/editor.main',
            'flame/monaco.contribution'
         ], function () {
            // _this.debug(_this); options.languages = 'customizedDebugLang';
            var lang =  guess_lang_from_ext(filename);
            if (!options.languages) options.languages = lang;
            if (!options.theme) options.theme = options.languages;
            _this.global = monaco;
            _this.api = monaco.editor.create(_this.self);
            _this.set_language(options.languages, options.theme);
            _this.api.setValue(text);
         });
      },
      resize: function () {
         this.self.style.height = Math.floor(
            window.innerHeight -
            this.self.parentNode.parentNode.offsetTop -
            this.self.offsetTop/2
         ) + 'px';
      },
      dispose: function () {
         if (!this.api) return;
         this.api.dispose();
      },
      on_content_ready: function (fn, self) {
         if (!self) self = this;
         if (!self.api) {
            return setTimeout(self.on_content_ready, 0, fn, self);
         }
         fn && fn();
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
         var contrib_gotodefinition = this.api.getContribution('editor.contrib.gotodefinitionwithmouse');
         contrib_gotodefinition.toUnhook.forEach(function (x) {
            if (!x || !x.onExecute) return;
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
      debug: function (editor) {
         monaco.languages.register({
            id: 'customizedDebugLang'
         });
         monaco.languages.setMonarchTokensProvider('customizedDebugLang', {
            stop: /[\s`~!@#$%^&*()-+=[\]{}\\|:;"'<>,./?]/,
            escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
            digits: /\d+(_+\d+)*/,
            hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,
            ipv4: /\d{2,3}.\d{2,3}.\d{2,3}.\d{2,3}/,
            tokenizer: {
               root: [
                  [/\[error.*/, "custom-error"],
                  [/\[notice.*/, "custom-notice"],
                  [/\[info.*/, "custom-info"],
                  [/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} [+]\d{4}/, "custom-date"],
                  [/\s\/[^\s]+/, "custom-file"],
                  [/(@ipv4)/, 'custom-ip'],
                  [/(@digits)[eE]([\-+]?(@digits))?/, 'custom-number'],
                  [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, 'custom-number'],
                  [/0[xX](@hexdigits)/, 'custom-hex'],
                  [/(@digits)/, 'custom-number'],
                  [/[a-zA-Z_$][\w$]*/, {
                     cases: {
                        '@default': 'custom-word'
                     }
                  }]
               ],
            }
         });
         // Define a new theme that constains only rules that match this language
         monaco.editor.defineTheme('customizedDebugLang', {
            base: 'vs',
            inherit: false,
            rules: [
               { token: 'custom-info', foreground: '808080' },
               { token: 'custom-error', foreground: 'ff0000', fontStyle: 'bold' },
               { token: 'custom-notice', foreground: 'FFA500' },
               { token: 'custom-date', foreground: '008800' },
               { token: 'custom-file', foreground: '008888' },
               { token: 'custom-ip', foreground: '0000FF' },
               { token: 'custom-number', foreground: 'CC0088' },
               { token: 'custom-hex', foreground: 'CC0088' },
               { token: 'custom-word', foreground: '000001' }
            ]
         });
         
         editor.on_definition_click(function () {
            console.log(arguments);
         });
      }
   };

   window.FlameEditor = FlameEditor;
})(window, document);

