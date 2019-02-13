'use strict';

(function (window, document) {
   function lookup(list, elem, key) {
      if (!list) return -1;
      for (var i = 0, n = list.length; i < n; i++) {
         if (list[i][key] === elem) return i;
      }
      return -1;
   }

   function FlameBreadCrumb(dom, options) {
      if (!options) options = {};
      this.dom = dom;
      this.crumbs = [];
      this.path = options.path;
      this.bind(options.on_click);
      this.on_click = null;
   }
   FlameBreadCrumb.prototype = {
      layout: function (path) {
         if (path) this.path = path;
         if (!this.path) return false;
         var parent = this.dom;
         if (!parent) return false;
         this.crumbs.forEach(function (crumb) {
            parent.removeChild(crumb.dom);
            delete crumb.dom;
         });
         var crumbs = [];
         var parts = this.path.split('/');
         parts = parts.map(function (part) {
            if (!part) return null;
            var li, a;
            li = document.createElement('li');
            a = document.createElement('a');
            a.classList.add('nav-link');
            a.classList.add('disabled');
            a.appendChild(document.createTextNode('/'));
            li.appendChild(a);
            parent.appendChild(li);
            crumbs.push({
               dom: li
            });
            li = document.createElement('li');
            a = document.createElement('a');
            a.classList.add('nav-link');
            a.appendChild(document.createTextNode(part));
            li.appendChild(a);
            parent.appendChild(li);
            crumbs.push({
               dom: li,
               text: part
            });
         }).filter(function (item) { return !!item; });
         if (crumbs.length) {
            crumbs[crumbs.length-1].dom.children[0].classList.add('active');
         }
         this.crumbs = crumbs;
      },
      bind: function (fn) {
         if (this.on_click) return;
         var _this = this;
         this.on_click = function (ev) {
            if (ev.target.tagName.toLowerCase() !== 'a') return;
            var index = lookup(_this.crumbs, ev.target.parentNode, 'dom');
            if (index < 0) return;
            // skip last element
            if (_this.crumbs.length-1 === index) return;
            fn && fn(ev.target.parentNode, _this.crumbs, index);
         };
         this.dom.addEventListener('click', this.on_click);
      },
      reset: function () {
         var parent = this.dom;
         this.crumbs.forEach(function (crumb) {
            parent.removeChild(crumb.dom);
            delete crumb.dom;
         });
         this.crumbs = [];
      },
      dispose: function () {
         if (this.on_click) {
            this.dom.removeEventListener('click', this.on_click);
         }
      }
   };

   window.FlameBreadCrumb = FlameBreadCrumb;
})(window, document);