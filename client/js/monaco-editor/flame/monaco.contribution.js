define(["require", "exports", "vs/editor/editor.main"], function (require, exports) {
   'use strict';
   var registered = false;
   var hoverProvider = {
      provideHover: function (model, position, token) {
         return Promise.resolve(null);
      }
   };
   var definitionProvider = {
      provideDefinition: function (model, position, token) {
         return Promise.resolve(null);
      }
   };

   if (!registered) {
      registered = true;
      // --- Registration to monaco editor ---
      var lang = monaco.languages.getLanguages().map(function (x) { return x.id; });
      lang.push('flameInternalDirectory');
      lang.forEach(function (lang) {
         monaco.languages.onLanguage(lang, function () {
            monaco.languages.registerHoverProvider(lang, hoverProvider);
            monaco.languages.registerDefinitionProvider(lang, definitionProvider);
         });
      }); // foreach; register worker to language
   }
});
