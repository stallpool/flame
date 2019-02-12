'use strict';

(function (window, document) {
   var config = {
      // margin fix -48, padding fix  5  5, border fix 1 1, overlap 3
      top_correction: 48 - 5 - 5 - 1 - 1 - 3,
      // margin fix  -1, padding fix 10 10, border fix 1
      left_correction: 1 - 10 - 10 - 1,
      // margin fix 10 10, padding fix 10 10
      width_correction: 10 + 10 + 10 + 10
   };

   function build_tab(base_dom) {
      var tab_div = document.createElement('div');
      tab_div.classList.add('dropdown-tab-frame')
      tab_div.style.position = 'fixed';
      tab_div.style.top = (base_dom.offsetTop + config.top_correction) + 'px';
      tab_div.style.left = (base_dom.offsetLeft + config.left_correction) + 'px';
      var tab_body = document.createElement('div');
      tab_body.classList.add('dropdown-tab');
      var width = window.innerWidth / 2;
      if (width > 800) width = 800; else if (width < 300) width = 300;
      var height = window.innerHeight - base_dom.offsetTop - base_dom.offsetHeight - 10;
      tab_body.style.width = width + 'px';
      tab_body.style.height = height + 'px';
      var tab_header = document.createElement('div');
      tab_header.classList.add('dropdown-tab-header');
      tab_header.classList.add('text-center');
      tab_header.style.width = (base_dom.offsetWidth + config.width_correction) + 'px';
      tab_header.appendChild(document.createTextNode(base_dom.textContent));
      var tab_content = document.createElement('div');
      tab_content.classList.add('dropdown-content');

      tab_body.appendChild(tab_header);
      tab_body.appendChild(tab_content);
      tab_div.appendChild(tab_body);
      return {
         self: tab_div,
         header: tab_header,
         content: tab_content
      };
   }

   function FlameDropdownTab(dom, options) {
      this.ref_dom = dom;
      this.dom = build_tab(dom);
      this.state = {
         pinned: {
            current: null,
            mouseenter: false,
            mouseleave: false,
         }
      };

      var _this = this;
      this.events = {
         on_mouseleave: function (evt) {
            if (_this.state.pinned.current) {
               _this.dom.self.style.opacity = 0.5;
            } else {
               _this.dom.self.style.display = 'none';
               _this.dom.self.style.opacity = 1;
            }
         },
         on_mouseenter: function (evt) {
            if (_this.state.pinned.current) {
               _this.dom.self.style.opacity = 1;
            }
         }
      };
   }
   FlameDropdownTab.prototype = {
      dispose: function () {
         this.dom.self.parentNode.removeChild(this.dom.self);
         this.dom.self.removeEventListener('mouseleave', this.events.on_mouseleave);
         this.dom.self.removeEventListener('mouseenter', this.events.on_mouseenter);
      },
      pin: function () {
         if (this.state.pinned.current === true) return;
         this.state.pinned.current = true;
         if (!this.state.pinned.mouseleave) {
            this.dom.self.addEventListener('mouseleave', this.events.on_mouseleave);
            this.state.pinned.mouseleave = true;
         }
         if (!this.state.pinned.mouseenter) {
            this.dom.self.addEventListener('mouseenter', this.events.on_mouseenter);
            this.state.pinned.mouseenter = true;
         }
      },
      unpin: function () {
         if (this.state.pinned.current === false) return;
         this.state.pinned.current = false;
         if (!this.state.pinned.mouseleave) {
            this.dom.self.addEventListener('mouseleave', this.events.on_mouseleave);
            this.state.pinned.mouseleave = true;
         }
         if (!this.state.pinned.mouseenter) {
            this.dom.self.addEventListener('mouseenter', this.events.on_mouseenter);
            this.state.pinned.mouseenter = true;
         }
      },
      is_pinned: function () {
         return !!this.state.pinned.current;
      }
   };

   window.FlameDropdownTab = FlameDropdownTab;
})(window, document);
