function c_xref(options, keyval) {
   let global_symbol = {};
   return new Promise((r, e) => {
      keyval.getKey(options.project).then((project_info) => {
         let file_list = project_info.file_list.filter(
            (x) => x.endsWith('.c') || x.endsWith('.h')
         );
         c_xref_compile(options, keyval, global_symbol, file_list, file_list.slice(), () => {
            return c_xref_link(options, keyval, global_symbol, file_list, file_list.slice(), () => r());
         });
      });
   });
}

function c_xref_compile(options, keyval, global_symbol, global_file_list, file_list, cb) {
   if (!file_list.length) {
      return cb && cb();
   }
   let path = file_list.pop();
   path = `${options.base}/${options.project}${path}`;
   console.log('compile', path);
   keyval.getKey([options.project, path, 'raw_tokens']).then((file_info) => {
      if (!file_info) return next();
      let export_ref = file_info.export_ref;
      let path = file_info.path;
      export_ref.forEach((ref) => {
         let name = ref.name;
         let symbol = {
            path,
            startOffset: ref.startOffset,
            endOffset: ref.endOffset,
            declare: !!ref.declare,
         };
         if (name in global_symbol) {
            global_symbol[`-${name}`].push(symbol);
         } else {
            global_symbol[`-${name}`] = [symbol];
         }
      });
      next();
   }, () => {
      next();
   });

   function next() {
      c_xref_compile(options, keyval, global_symbol, global_file_list, file_list, cb);
   }
}

function c_xref_link(options, keyval, global_symbol, global_file_list, file_list, cb) {
   if (!file_list.length) {
      return cb && cb();
   }
   let project_path = file_list.pop();
   let path = `${options.base}/${options.project}${project_path}`;
   console.log('link', path);
   keyval.getKey([options.project, path, 'raw_tokens']).then((file_info) => {
      if (!file_info) return next();
      let tokens = [];
      let include_ref = file_info.include_ref;
      let export_ref = file_info.export_ref;
      let path = file_info.path;
      export_ref.forEach((ref) => {
         if (ref.symbol_list) {
            ref.symbol_list.forEach((subref) => {
               add_ref(path, subref, global_symbol, tokens);
            });
         }
         if (ref.declare) {
            add_ref(path, ref, global_symbol, tokens);
         }
      });
      include_ref.forEach((ref) => {
         find_include(path, ref, global_file_list, tokens);
      });
      tokens = tokens.sort((a, b) => a.startOffset - b.startOffset);
      keyval.putKey([options.project, project_path, 'info'], { tokens }).then(() => {
         next();
      }, () => {
         next();
      });
   }, () => {
      next();
   });

   function add_ref(path, ref, global_symbol, output) {
      let g = global_symbol[`-${ref.name}`]
      if (!g) return;
      let links = g.filter((x) => !x.declare);
      if (!links.length) return;
      // XXX: currently use the first hit
      let link = links[0];
      let item = {
         startOffset: ref.startOffset,
         endOffset: ref.endOffset,
         description: `function ${ref.name}`,
         uol: (
            (path === link.path?'':`#${link.path.substring(options.base.length)}`)
            + '?offset=' + link.startOffset + '&n=' + (link.endOffset-link.startOffset)
         )
      };
      output.push(item);
   }

   function find_include(path, ref, global_file_list, output) {
      let name = ref.name.split('/');
      // XXX: currently match one
      let match = global_file_list.filter(
         (x) => x.endsWith(`/${name[name.length-1]}`)
      )[0];
      if (!match) return;
      output.push({
         startOffset: ref.startOffset,
         endOffset: ref.endOffset,
         description: `include ${ref.name}`,
         uol: `#/${options.project}${match}`
      });
   }

   function next() {
      c_xref_link(options, keyval, global_symbol, global_file_list, file_list, cb);
   }
}

module.exports = {
   c_xref,
};