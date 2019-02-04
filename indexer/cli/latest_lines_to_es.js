const i_path = require('path');
const i_fs = require('fs');
const i_utils = require('../../server/utils');

const usage = `[CLI] Make indexes for latest file lines into ElasticSearch.

   node latest_lines_to_es.js <dirPath> [Options]

Options:
   -h, --help      show this help information
   --host          set ElasticSearch client host; default http://127.0.0.1:9200
   -p, --parallel  set max parallel write request; default 5
`;

const es_index_name = 'latest_lines';
const es_type_name = 'a';

const task = {
   options: {
      base_dir: null,
      client: null,
      es_max_request: 5,
   },
   filelist: [],
   currentfile: null,
   linelist: [],
   execute: (cb) => {
      if (!task.filelist.length && !task.linelist.length) {
         if (task.currentfile) {
            console.log(`[index] "${task.currentfile}" complete`);
         }
         console.log('[done]');
         cb && cb();
         return;
      }
      if (!task.linelist.length) {
         if (task.currentfile) {
            console.log(`[index] "${task.currentfile}" complete`);
         }
         let new_task_file = task.filelist.shift();
         task.currentfile = new_task_file;
         task.linelist = i_fs.readFileSync(
            new_task_file
         ).toString().split('\n').map(
            (line) => {
               if (!line.trim()) return null;
               // line too long
               if (line.length > 512) return null;
               return line;
            }
         );
         console.log(`[index] "${new_task_file}" start`);
         // TODO: if this file is indexed, remove and re-index
         setTimeout(task.execute, 0, cb);
         return;
      }

      let filename = task.currentfile.substring(
         task.options.base_dir.length
      );
      let idprefix = filename;
      filename = filename.split('/');
      let project = filename[1];
      let filepath = '/' + filename.slice(2).join('/');
      let requests = [];
      let n = task.options.es_max_request;
      while(n--) {
         let i = task.linelist.length;
         if (i <= 0) break;
         let line = task.linelist.pop();
         if (!line) {
            continue;
         }
         requests.push({
            id: `${idprefix}<#${i}>`,
            lineno: i,
            line,
            project,
            path: filepath,
         });
      }
      if (!requests.length) {
         setTimeout(task.execute, 0, cb);
         return;
      }
      Promise.all(requests.map((x) => task.send_es_request(x))).then(
         () => {
            setTimeout(task.execute, 0, cb);
         },
         (err) => {
            console.log('[error] unknown error from es requests', err);
            setTimeout(task.execute, 0, cb);
         }
      );
   },
   send_es_request: (request) => new Promise((r, e) => {
      task.options.client.addoc({
         id: i_utils.Codec.base64.encode(request.id),
         index: es_index_name,
         type: es_type_name,
         doc: {
            lineno: request.lineno,
            project: request.project,
            path: request.path,
            line: request.line,
         }
      });
      r();
   }),
};

function main(argv) {
   let base_dir = i_path.resolve(argv._argv[0]);
   let es_host = argv['--host'] || 'http://127.0.0.1:9200';
   let es_max_request = parseInt(argv['-p'] || argv['--parallel'] || '5');
   process.env.FLAME_ELASTICSEARCH = es_host;
   let i_es = require('../../server/backbone/elasticsearch');
   let files = i_utils.Storage.list_files(base_dir).filter((filename) => {
      let extname = i_path.extname(filename);
      if ([
         '.js', '.ts', '.go', '.c', '.cc', '.cpp', '.cxx',
         '.h', '.hh', '.hpp', '.hxx', '.cs', '.css', '.html', '.htm',
         '.shtml', '.xhtml', '.jsp', '.asp', '.aspx', '.java', '.md',
         '.fs', '.lua', '.m', '.mm', '.php', '.py', '.r', '.rb',
         '.xml', '.json', '.yaml'
      ].indexOf(extname) < 0) return false;
      if (filename.indexOf('/.') >= 0) return false;
      // /base/path/project_name/file/path
      //           ^            | at least 2 '/'
      if (filename.substring(base_dir.length).split('/').length <= 2) return false;
      return true;
   });
   task.options.es_max_request = es_max_request;
   task.options.base_dir = base_dir;
   task.options.client = i_es;
   task.filelist = files;
   task.execute(() => {
      process.exit();
   });
}


let argv = i_utils.CLI.parse();
if (argv['-h'] || argv['--help'] || !argv._argv.length) {
   console.log(usage);
} else {
   if (argv['--host']) {
      process.env.FLAME_ELASTICSEARCH = argv['--host'];
   }
   main(argv);
}