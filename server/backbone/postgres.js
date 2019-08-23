const i_pg = require('pg');

const system = {
   dbconfig: {
      host: process.env.PGHOST || '127.0.0.1',
      port: parseInt(process.env.PGPORT) || 5432,
      user: process.env.PGUSER || 'postgres',
      database: process.env.PGDATABASE || 'postgres',
      password: process.env.PGPASSWORD || null,
   },
};

function check_table_exists(client) {
   return new Promise((r) => {
      client.query({
         text: 'SELECT table_name FROM information_schema.tables WHERE table_schema = $1',
         values: ['public']
      }).then((res) => {
         return r(res.rows.map((x) => x.table_name));
      });
   });
}

function create_table(client, tablename, tableconf) {
   if (tableconf.id === false) {
      delete tableconf.id;
   } else {
      tableconf['id'] = 'SERIAL PRIMARY KEY';
   }
   let columns = Object.keys(tableconf).map((key) => `${key} ${tableconf[key]}`).join(', ');
   return client.query(`CREATE TABLE ${tablename} (${columns})`);
}

function insert_into(client, tablename, columns, values) {
   let fields = columns.join(', ');
   let dolars = values.map((_, i) => `$${i+1}`).join(', ');
   return client.query({
      text: `INSERT INTO ${tablename} (${fields}) VALUES (${dolars}) RETURNING *`,
      values: values
   });
}

function delete_from(client, tablename, where) {
   return client.query(`DELETE FROM ${tablename} ${where?('WHERE ' + where):''}`);
}

function update(client, tablename, columns, values, where) {
   let n = columns.length;
   let fields = []
   for (let i = 0; i < n; i++) {
      fields.push(`${columns[i]}=$${i+1}`);
   }
   let sql = `UPDATE ${tablename} SET ${fields.join(', ')} ${where?('WHERE ' + where):''} RETURNING *`;
   return client.query({
      text: sql,
      values: values
   });
}

function filter(client, tablename, columns, where, customized_clause) {
   let fields = columns?columns.join(', '):null;
   return client.query(
      `SELECT ${fields || '*'} FROM ${tablename} ${where?('WHERE ' + where):''} ${customized_clause || ''}`
   );
}

class Postgres {
   constructor(options) {
      // options = { host, port, database, user, password, ... }
      this.reset(options);
   }

   reset (options) {
      if (!options) options = {};
      options = Object.assign({}, system.dbconfig, options);
      this.client = new i_pg.Pool(options);
   }

   async raw(sql) {
      let instance, result;
      try {
         instance = await this.client.connect();
         result = await instance.query(sql);
      } catch(err) {
         console.error('[psql.raw]', err);
      } finally {
         if (instance) instance.release();
      }
      return result;
   }

   async create_table (tablename, tableconf) {
      let instance, result;
      try {
         instance = await this.client.connect();
         result = await create_table(instance, tablename, tableconf);
      } catch(err) {
         console.error('[psql.create_table]', err);
      } finally {
         if (instance) instance.release();
      }
      return result;
   }

   async insert_into (tablename, columns, values) {
      let instance, result;
      try {
         instance = await this.client.connect();
         result = await insert_into(instance, tablename, columns, values);
      } catch(err) {
         console.error('[psql.insert_into]', err);
      } finally {
         if (instance) instance.release();
      }
      return result;
   }

   async delete_from (tablename, where) {
      let instance, result;
      try {
         instance = await this.client.connect();
         result = await delete_from(instance, tablename, where);
      } catch(err) {
         console.error('[psql.delete_from]', err);
      } finally {
         if (instance) instance.release();
      }
      return result;
   }

   async update (tablename, columns, values, where) {
      let instance, result;
      try {
         instance = await this.client.connect();
         result = await update(instance, tablename, columns, values, where);
      } catch(err) {
         console.error('[psql.update]', err);
      } finally {
         if (instance) instance.release();
      }
      return result;
   }

   async filter (tablename, columns, where, customized_clause) {
      // tablename, columns, where | tablename, where
      if (typeof(columns) === 'string') {
         customized_clause = where;
         where = columns;
         columns = null;
      }
      let instance, result;
      try {
         instance = await this.client.connect();
         result = await filter(instance, tablename, columns, where, customized_clause);
      } catch(err) {
         console.error('[psql.filter]', err);
      } finally {
         if (instance) instance.release();
      }
      return result;
   }

   dispose () {
      if (this.client) this.client.end();
      this.client = null;
   }
}

module.exports = {
   Postgres
};
