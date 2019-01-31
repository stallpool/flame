const i_ws = require('ws');
const i_auth = require('./auth');

const i_metasearch = require('./backbone/metasearch/generic');

function process_cmd(ws, m, env) {
   switch(m.cmd) {
      case 'metasearch.search':
      if (!m.query) return api.send_error(ws, 400, 'Bad Request');
      i_metasearch.websocket.search(env.uuid, ws, {
         username: env.username,
         query: m.query
      });
      break;
      case 'metasearch.search.cancel':
      i_metasearch.websocket.cancel(env.uuid, ws);
      break;
   }
}

const api = {
   send_error: (ws, code, text) => {
      ws.send(JSON.stringify({error: text, code: code}));
   },
   send: (ws, json) => {
      ws.send(JSON.stringify(json));
   },
   start_query: (ws, query, env) => {},
   stop_query: (ws, query, env) => {}
};

const service = {
   server: null,
   init: (server, path) => {
      service.server = new i_ws.Server({ server, path });
      service.server.on('connection', service.client);
   },
   client: (ws, req) => {
      let env = {
         authenticated: false,
         username: null,
         uuid: null,
         query: null,
         query_tasks: []
      };
      setTimeout(() => {
         // if no login in 5s, close connection
         if (!env.authenticated) {
            ws.close();
         }
      }, 5000);
      ws.on('message', (m) => {
         try {
            m = JSON.parse(m);
         } catch(e) {
            api.send_error(ws, 400, 'Bad Request');
            return;
         }
         if (m.cmd === 'auth') {
            if (!i_auth.check_login(m.username, m.uuid)) {
               api.send_error(ws, 401, 'Not Authenticated');
               return;
            }
            env.authenticated = true;
            env.username = m.username;
            env.uuid = m.uuid;
            return;
         }
         if (!env.authenticated) {
            api.send_error(ws, 401, 'Not Authenticated');
            return;
         }
         process_cmd(ws, m, env);
      });
      ws.on('close', () => {
      });
      ws.on('error', (error) => {
      });
   }
};

module.exports = service;