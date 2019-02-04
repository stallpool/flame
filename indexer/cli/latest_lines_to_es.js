const i_path = require('path');
const i_fs = require('fs');
const i_utils = require('../../server/utils');
const i_es = require('../../server/backbone/elasticsearch');


const usage = `[CLI] Make indexes for latest file lines into ElasticSearch.

   node latest_lines_to_es.js <dirPath> [Options]

Options:
   -h, --help      show this help information
   --host          set ElasticSearch client host; default http://127.0.0.1:9200
   -p, --parallel  set max parallel write request; default 5
`;


const es_index = {
   latest_lines: {
      name: 'latest_lines',
      type: 'a',
   },
   project_info: {
      name: 'project_info',
      type: 'a',
   }
};

const task = {
   options: {
      base_dir: null,
      client: null,
      es_max_request: 5,
   },
   projectlist: [],
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
      if (project && task.projectlist.indexOf(project) < 0) {
         task.projectlist.push(project);
         task.send_es_request_for_project({
            name: project,
            base_dir: i_path.join(task.options.base_dir, project)
         }).then(() => {
            setTimeout(task.execute, 0, cb);
         }, () => {
            setTimeout(task.execute, 0, cb);
         });
         return;
      }
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
      Promise.all(requests.map((x) => task.send_es_request_for_line(x))).then(
         () => {
            setTimeout(task.execute, 0, cb);
         },
         (err) => {
            console.log('[error] unknown error from es requests', err);
            setTimeout(task.execute, 0, cb);
         }
      );
   },
   send_es_request_for_project: (request) => new Promise((r, e) => {
      task.options.client.addoc({
         id: i_utils.Codec.base64.encode(request.name),
         index: es_index.project_info.name,
         type: es_index.project_info.type,
         doc: {
            name: request.name,
            path: request.base_dir
         }
      });
      r();
   }),
   send_es_request_for_line: (request) => new Promise((r, e) => {
      task.options.client.addoc({
         id: i_utils.Codec.base64.encode(request.id),
         index: es_index.latest_lines.name,
         type: es_index.latest_lines.type,
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
   let files = i_utils.Storage.list_files(base_dir).filter((filename) => {
      let extname = i_path.extname(filename);
      if ([
         '.js', '.ts', '.go', '.c', '.cc', '.cpp', '.cxx',
         '.h', '.hh', '.hpp', '.hxx', '.cs', '.css', '.html', '.htm',
         '.shtml', '.xhtml', '.jsp', '.asp', '.aspx', '.java', '.md',
         '.fs', '.lua', '.m', '.mm', '.php', '.py', '.r', '.rb',
         '.xml', '.json', '.yaml', '.sql', '.txt', '.sh', '.bat',
         '.cmd', '.xml', '.json'
      ].indexOf(extname) < 0) {
         if (!filename.toLowerCase().endsWith('/readme')) {
            return false;
         }
      }
      if (filename.indexOf('/.') >= 0) return false;
      // /base/path/project_name/file/path
      //           ^            | at least 2 '/'
      if (filename.substring(base_dir.length).split('/').length <= 2) return false;
      return true;
   });
   task.options.es_max_request = es_max_request;
   task.options.base_dir = base_dir;
   task.options.client = new i_es.Client(es_host);
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