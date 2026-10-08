import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

export const accounts = {
  admin: '11111111-1111-4111-8111-111111111111',
  manager: '22222222-2222-4222-8222-222222222222',
  vendor: '33333333-3333-4333-8333-333333333333',
  callCenter: '44444444-4444-4444-8444-444444444444',
  auditor: '55555555-5555-4555-8555-555555555555',
  unassigned: '66666666-6666-4666-8666-666666666666',
  warehouse: '77777777-7777-4777-8777-777777777777',
};

export async function testDatabase() {
  const db = new PGlite();
  // Supabase instala estos roles y auth.uid(). En tests locales los reproducimos.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
  `);
  for (const name of ['001_schema.sql', '002_operations.sql', 'seed.sql']) {
    const sql = await readFile(new URL(`../database/${name}`, import.meta.url), 'utf8');
    await db.exec(sql);
  }
  for (const id of Object.values(accounts)) await db.query('insert into auth.users(id) values($1)', [id]);
  await db.exec(`insert into public.perfiles(id_usuario,rol,id_sucursal) values
    ('${accounts.admin}','ADMIN',null), ('${accounts.manager}','GERENTE',1),
    ('${accounts.vendor}','VENDEDOR',1), ('${accounts.callCenter}','CALL_CENTER',null),
    ('${accounts.auditor}','AUDITOR',null), ('${accounts.warehouse}','BODEGA',2);`);
  return db;
}

export async function asUser(db, account, callback) {
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [accounts[account]]);
  try { return await callback(); }
  finally { await db.exec('reset role'); await db.exec("reset request.jwt.claim.sub"); }
}

export async function operation(db, action, data, key = crypto.randomUUID()) {
  const result = await db.query('select public.ejecutar_operacion($1,$2::jsonb,$3::uuid) as data', [action, JSON.stringify(data), key]);
  return result.rows[0].data;
}

// Adaptador solo de tests: ejecuta las consultas del modelo contra PostgreSQL local.
// No reemplaza la base por una lista de objetos; aquí sí se ejecutan SQL, RLS y triggers.
export function testSupabase(db) {
  return {
    rpc: async function (name, args) {
      const queries = {
        ejecutar_operacion: ['select ejecutar_operacion($1,$2::jsonb,$3::uuid) as data', [args.p_accion, JSON.stringify(args.p_datos), args.p_clave]],
        consultar_disponibilidad: ['select consultar_disponibilidad($1::jsonb) as data', [JSON.stringify(args.p_datos)]],
        reporte_empresa: ['select reporte_empresa($1::timestamptz,$2::timestamptz,$3::bigint) as data', [args.p_desde, args.p_hasta, args.p_sucursal]],
      };
      try {
        const result = await db.query(...queries[name]);
        return { data: result.rows[0].data, error: null };
      } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
    },
    from: function (table) {
      const state = { filters: [], params: [], mode: 'select', single: false, limit: null, from: 0, order: null };
      // Los nombres vienen de las rutas del proyecto. Aun en tests, solo aceptamos identificadores.
      function identifier(value) {
        if (!/^[a-z_]+$/.test(value)) throw new Error('Identificador de test inválido');
        return `"${value}"`;
      }
      const builder = {
        select: function () { return builder; },
        eq: function (field, value) { state.params.push(value); state.filters.push(`${identifier(field)}=$${state.params.length}`); return builder; },
        order: function (field) { state.order = identifier(field); return builder; },
        range: function (from, to) { state.from = from; state.limit = to - from + 1; return builder; },
        maybeSingle: function () { state.single = true; return builder; },
        single: function () { state.single = true; return builder; },
        insert: function (data) { state.mode = 'insert'; state.body = data; return builder; },
        update: function (data) { state.mode = 'update'; state.body = data; return builder; },
        then: function (resolve, reject) {
          async function execute() {
            try {
              let sql; let count;
              const where = state.filters.length ? ` where ${state.filters.join(' and ')}` : '';
              if (state.mode === 'select') {
                count = Number((await db.query(`select count(*) as count from public.${identifier(table)}${where}`, state.params)).rows[0].count);
                sql = `select * from public.${identifier(table)}${where}`;
                if (state.order) sql += ` order by ${state.order}`;
                if (state.limit !== null) sql += ` limit ${state.limit} offset ${state.from}`;
              } else {
                const fields = Object.keys(state.body);
                const placeholders = fields.map(function (field) { state.params.push(state.body[field]); return `$${state.params.length}`; });
                if (state.mode === 'insert') sql = `insert into public.${identifier(table)} (${fields.map(identifier).join(',')}) values (${placeholders.join(',')}) returning *`;
                else sql = `update public.${identifier(table)} set ${fields.map((field, i) => `${identifier(field)}=${placeholders[i]}`).join(',')}${where} returning *`;
              }
              const result = await db.query(sql, state.params);
              return { data: state.single ? (result.rows[0] || null) : result.rows, count, error: null };
            } catch (error) { return { data: null, error: { code: error.code, message: error.message } }; }
          }
          return execute().then(resolve, reject);
        },
      };
      return builder;
    },
  };
}
