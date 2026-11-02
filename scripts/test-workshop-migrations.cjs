// Replay the repository's workshop migrations in a disposable PostgreSQL cluster.
// Requires PostgreSQL tools in PATH, or PGBIN pointing to their directory.
// No Supabase project, Edge Function, provider API, or live database is contacted.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'black-begonia-workshop-pg-'));
const data = path.join(scratch, 'data');
const executable = name => process.env.PGBIN ? path.join(process.env.PGBIN, name) : name;
const read = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/^\uFEFF/, '');
const feature = '20261102000000_workshop_external_checkout.sql';
let server;
let port;

function run(name, args, input) {
  const result = spawnSync(executable(name), args, {
    cwd: root, encoding: 'utf8', input, windowsHide: true, timeout: 120_000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${name} failed: ${result.error?.message ?? ''}\n${result.stderr}\n${result.stdout}`);
  }
  return result.stdout;
}
function sql(source, database = 'postgres') {
  return run('psql', ['-X', '-h', '127.0.0.1', '-p', String(port), '-U', 'postgres', '-d', database,
    '-v', 'ON_ERROR_STOP=1', '-At', '-f', '-'], source);
}
function bodyFunction(name, returns, language) {
  return `create function public.${name}() returns ${returns} language ${language} security definer set search_path='' as $$\n${read(`supabase/schemas/public/functions/${name}.sql`)}\n$$;`;
}

async function main() {
  port = await new Promise(resolve => {
    const listener = net.createServer();
    listener.listen(0, '127.0.0.1', () => {
      const selected = listener.address().port;
      listener.close(() => resolve(selected));
    });
  });
  run('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--no-locale', '--encoding=UTF8']);
  const serverLog = fs.openSync(path.join(scratch, 'postgres.log'), 'w');
  server = spawn(executable('postgres'), ['-D', data, '-h', '127.0.0.1', '-p', String(port)], {
    cwd: root, windowsHide: true, stdio: ['ignore', serverLog, serverLog],
  });
  server.on('error', error => { console.error(error.message); });
  for (let attempt = 0; attempt < 100; attempt++) {
    const ready = spawnSync(executable('pg_isready'), ['-h', '127.0.0.1', '-p', String(port)], { windowsHide: true });
    if (ready.status === 0) break;
    if (attempt === 99 || server.exitCode !== null) throw new Error('Disposable PostgreSQL did not start.');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Supabase supplies auth/storage infrastructure outside this repository's
  // migration history. Use its interfaces locally; load CRM tables and helpers
  // from the actual schema files, including profile email/FK requirements.
  sql(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema storage; create schema extensions; create schema vault;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'$$;
    create type public.crm_user_role as enum ('admin','staff');
    ${bodyFunction('set_updated_at', 'trigger', 'plpgsql')}
    ${read('supabase/schemas/public/tables/profiles.sql')}
    ${read('supabase/schemas/public/tables/user_roles.sql')}
    ${bodyFunction('is_internal_crm_user', 'boolean', 'sql')}
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    create table vault.decrypted_secrets(name text,decrypted_secret text);
    grant usage on schema public,auth,storage to anon,authenticated,service_role;
  `);
  const migrations = fs.readdirSync(path.join(root, 'supabase/migrations'))
    .filter(name => name.includes('_workshop_') && name < feature).sort();
  for (const migration of migrations) {
    sql(read(`supabase/migrations/${migration}`));
    console.log(`Applied ${migration}`);
  }
  // The later CRM calendar migration installs an outbox trigger on workshop
  // writes. Include its real table/functions so create/edit/publish also exercise
  // that integration, without invoking a worker or an external calendar API.
  sql(`${read('supabase/schemas/public/tables/crm_m365_calendar_outbox.sql')}
    ${read('supabase/schemas/public/functions/enqueue_crm_calendar_source.sql')}
    ${read('supabase/schemas/public/functions/enqueue_crm_calendar_source_change.sql')}
    create trigger trg_crm_calendar_workshops after insert or update or delete on public.workshop_occurrences
      for each row execute function public.enqueue_crm_calendar_source_change();
  `);
  const publicSignature = sql("select proargnames[1] from pg_proc where oid='public.get_public_workshop_occurrence(text)'::regprocedure;").trim();
  assert.equal(publicSignature, 'p_occurrence_slug', 'Replay must include the September public RPC wrapper.');
  const preservedQuery = `select pg_get_functiondef(oid) from pg_proc where pronamespace='public'::regnamespace
    and proname in ('archive_workshop_occurrence','delete_workshop_occurrence','transition_workshop_occurrence',
      'cancel_workshop_occurrence','complete_and_archive_workshop_occurrence','manage_workshop_reschedule',
      'manage_workshop_financials','manage_workshop_refund_order','reconcile_workshop_stripe_event',
      'attach_workshop_stripe_checkout','queue_workshop_communication','enqueue_confirmed_workshop_booking_message',
      'get_public_workshop_occurrence_route','get_workshop_booking_status') order by oid;`;
  const before = sql(preservedQuery);
  sql('create database workshop_atomic template postgres;');

  const migration = read(`supabase/migrations/${feature}`);
  // Reproduce the reported parameter-name conflict before verifying recovery
  // from the partial state created by the original SQL-editor migration.
  const originalPath = process.argv[2];
  if (originalPath) {
    assert.throws(() => sql(fs.readFileSync(path.resolve(originalPath), 'utf8')),
      /cannot change name of input parameter "p_occurrence_slug"/);
    assert.equal(sql("select count(*) from information_schema.columns where table_schema='public' and table_name='workshop_occurrences' and column_name='external_checkout_url';").trim(), '1');
    console.log('Reproduced original error and partial SQL-editor application.');
  }
  const beforeRetry = sql(preservedQuery);
  sql(migration);
  sql(migration);
  assert.equal(sql(preservedQuery), beforeRetry, 'Feature migration must preserve unrelated lifecycle implementations.');
  assert.equal(sql("select proargnames[1] from pg_proc where oid='public.get_public_workshop_occurrence(text)'::regprocedure;").trim(), publicSignature);

  // A deliberately invalid variant proves failed deployment cannot leave new
  // columns, constraints, or function changes behind when run in SQL Editor.
  const broken = migration.replace('get_public_workshop_occurrence(p_occurrence_slug text)',
    'get_public_workshop_occurrence(p_incompatible_slug text)');
  assert.throws(() => sql(broken, 'workshop_atomic'), /cannot change name of input parameter/);
  assert.equal(sql("select count(*) from information_schema.columns where table_schema='public' and table_name='workshop_occurrences' and column_name='external_checkout_url';", 'workshop_atomic').trim(), '0');
  sql(migration, 'workshop_atomic');
  assert.equal(sql(preservedQuery, 'workshop_atomic'), before, 'Clean migration must preserve existing lifecycle implementations.');

  // Assertions are shared with the normal pgTAP suite. Only the TAP reporter
  // calls are omitted because a plain PostgreSQL installation lacks pgTAP.
  const integration = read('supabase/tests/workshop_external_checkout.sql')
    .replace(/^select no_plan\(\);\r?\n/gm, '')
    .replace(/^select pass\(.*\);\r?\n/gm, '')
    .replace(/^select \* from finish\(\);\r?\n/gm, '');
  sql(integration);
  sql(integration, 'workshop_atomic');
  console.log(`PASS: ${migrations.length} existing workshop migrations; calendar outbox; feature apply/retry; atomic failure; lifecycle preservation; checkout integration assertions.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  if (server?.pid && server.exitCode === null) {
    try { run('pg_ctl', ['-D', data, '-w', '-m', 'immediate', 'stop']); }
    catch { server.kill(); }
    await new Promise(resolve => server.exitCode === null ? server.once('exit', resolve) : resolve());
  }
  // Only remove the fresh, uniquely named temporary cluster created above.
  const tempRoot = path.resolve(os.tmpdir()) + path.sep;
  const resolvedScratch = path.resolve(scratch);
  if (resolvedScratch.startsWith(tempRoot) && path.basename(resolvedScratch).startsWith('black-begonia-workshop-pg-')) {
    fs.rmSync(resolvedScratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
