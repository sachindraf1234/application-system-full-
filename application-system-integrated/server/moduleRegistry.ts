// Registry of external GitHub-repo modules that are vendored under <repo>/modules/.
// - Reports status for the "module" sections in the main app.
// - Starts/stops runnable Python web modules (only when MODULES_ENABLED=true).
// - Proxies a running module's web UI under /module/<id>/ (same origin, so no CORS).
// Secrets are never returned by the API: only the NAMES of missing environment variables.
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router, Request, Response } from 'express';
import { parse as parseDotenv } from 'dotenv';
import crypto from 'crypto';

const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODULES_DIR = path.resolve(APP_DIR, '..', 'modules');
const LOG_LIMIT = 200;

type ModuleKind = 'web' | 'cli' | 'incomplete';

interface ModuleDef {
  id: string;
  name: string;
  repo: string;
  kind: ModuleKind;
  description: string;
  dir: string;                 // folder name inside modules/
  port?: number;               // web modules only
  command?: string[];          // web modules: argv, run inside dir
  cwd?: string;                // web modules: subfolder of dir to run from
  entry?: string;              // web modules: file that must exist (default run.py)
  dryRun?: boolean;            // true = cannot message real people/services; allowed on the public preview
  requiredEnv?: string[];      // names only; values come from env or module .env
  commands?: string[];         // cli modules: how to run it
  reason?: string;             // incomplete modules: why it cannot run
  uiPath?: string;             // web modules: page shown in the section, relative to the module root (default '/')
}

const DEFINITIONS: ModuleDef[] = [
  {
    id: 'insurance-agent',
    name: 'Insurance AI Agent',
    repo: 'sachindraf1234/insurance-agent',
    kind: 'web',
    description: 'Travel-insurance email automation (Allianz / LOLC): OCR, Excel generation, mail sending and reply watcher.',
    dir: 'insurance-agent',
    port: 5010,
    command: ['python3', 'run.py'],
    requiredEnv: ['MAIL_ADDRESS', 'MAIL_PASSWORD'],
  },
  {
    id: 'slbfe-automation',
    name: 'SLBFE Training & FBR Checker',
    repo: 'sachindraf1234/training-and-fbr-checking-system',
    kind: 'web',
    description: 'Two independent Playwright checkers: Pre-Departure Training (all applicants) and Family Background Report (females only).',
    dir: 'slbfe-automation',
    cwd: 'slbfe_automation_suite',
    entry: 'combined_dashboard.html',
    port: 5030,
    command: ['python3', '-m', 'http.server', '5030', '--bind', '0.0.0.0'],
    uiPath: '/combined_dashboard.html',
    commands: [
      'pip install -r system1_training/requirements.txt',
      'python3 run_dashboard.py            # interactive menu',
      'python3 run_dashboard.py --html     # build combined_dashboard.html',
    ],
  },
  {
    id: 'transarabian-agent',
    name: 'Trans Arabian WhatsApp Agent',
    repo: 'sachindraf1234/transarabian-agent',
    kind: 'web',
    description: 'WhatsApp bot test harness (DRY RUN). Replies are recorded in a local outbox; nothing is sent to WhatsApp.',
    dir: 'transarabian-agent',
    cwd: 'server',
    entry: 'app.py',
    port: 5020,
    command: ['python3', 'app.py'],
    uiPath: '/static/console.html',
    dryRun: true,
  },
];

interface RunState {
  child: ChildProcess | null;
  stopping: boolean;
  startedAt: string | null;
  exitCode: number | null;
  error: string | null;
  log: string[];
}

const runs = new Map<string, RunState>();

function getRun(id: string): RunState {
  let r = runs.get(id);
  if (!r) {
    r = { child: null, stopping: false, startedAt: null, exitCode: null, error: null, log: [] };
    runs.set(id, r);
  }
  return r;
}

function pushLog(state: RunState, chunk: Buffer) {
  for (const line of chunk.toString('utf8').split(/\r?\n/)) {
    if (!line) continue;
    state.log.push(line.length > 500 ? line.slice(0, 500) + '…' : line);
  }
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
}

function isAlive(state: RunState): boolean {
  return !!state.child && state.child.exitCode === null && state.child.signalCode === null;
}

function moduleDir(def: ModuleDef) {
  return path.join(MODULES_DIR, def.dir);
}

// Environment for a module = process env + the module's own gitignored .env file.
function moduleEnv(def: ModuleDef): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') env[k] = v;
  const envFile = path.join(moduleDir(def), '.env');
  if (fs.existsSync(envFile)) {
    Object.assign(env, parseDotenv(fs.readFileSync(envFile)));
  }
  return env;
}

function missingEnv(def: ModuleDef): string[] {
  const env = moduleEnv(def);
  return (def.requiredEnv || []).filter((k) => !env[k] || !env[k].trim());
}

function sourceReady(def: ModuleDef): boolean {
  const dir = moduleDir(def);
  if (!fs.existsSync(dir)) return false;
  if (def.kind === 'web') return fs.existsSync(path.join(dir, def.cwd || '', def.entry || 'run.py'));
  return true;
}

function pythonFor(def: ModuleDef): string {
  const venvPy = path.join(moduleDir(def), '.venv', 'bin', 'python');
  return fs.existsSync(venvPy) ? venvPy : (def.command?.[0] || 'python3');
}

function describe(def: ModuleDef) {
  const state = getRun(def.id);
  const running = isAlive(state);
  return {
    id: def.id,
    name: def.name,
    repo: `https://github.com/${def.repo}`,
    kind: def.kind,
    description: def.description,
    sourceReady: sourceReady(def),
    running,
    port: def.kind === 'web' ? def.port : undefined,
    startedAt: state.startedAt,
    exitCode: state.exitCode,
    error: state.error,
    missingEnv: def.kind === 'web' ? missingEnv(def) : [],
    commands: def.commands || [],
    reason: def.reason || null,
    dryRun: !!def.dryRun,
    uiPath: def.kind === 'web' ? `/module/${def.id}${def.uiPath || '/'}` : null,
    log: state.log.slice(-40),
  };
}

function startModule(def: ModuleDef): { ok: boolean; message: string } {
  if (def.kind !== 'web') return { ok: false, message: 'This module has no web UI to start.' };
  if (!sourceReady(def)) return { ok: false, message: 'Module source is missing or incomplete.' };
  const state = getRun(def.id);
  if (isAlive(state)) {
    return state.stopping
      ? { ok: false, message: 'Still stopping; try again in a few seconds.' }
      : { ok: true, message: 'Already running.' };
  }
  const missing = missingEnv(def);
  if (missing.length) return { ok: false, message: `Missing configuration: ${missing.join(', ')} (set in modules/${def.dir}/.env).` };

  const env = moduleEnv(def);
  env.PORT = String(def.port);
  const [, ...args] = def.command!;
  const child = spawn(pythonFor(def), args, { cwd: path.join(moduleDir(def), def.cwd || ''), env, stdio: ['ignore', 'pipe', 'pipe'] });
  state.child = child;
  state.startedAt = new Date().toISOString();
  state.exitCode = null;
  state.error = null;
  state.log = [];
  child.stdout?.on('data', (c: Buffer) => pushLog(state, c));
  child.stderr?.on('data', (c: Buffer) => pushLog(state, c));
  child.on('error', (e) => { state.error = e.message; });
  child.on('exit', (code, signal) => {
    state.exitCode = code;
    state.stopping = false;
    if (code !== 0 && signal !== 'SIGTERM') state.error = `Process exited with code ${code}. See the log below.`;
  });
  return { ok: true, message: `Started on port ${def.port}.` };
}

function stopModule(def: ModuleDef): { ok: boolean; message: string } {
  const state = getRun(def.id);
  if (!isAlive(state)) return { ok: true, message: 'Not running.' };
  state.stopping = true;
  state.child!.kill('SIGTERM');
  return { ok: true, message: 'Stop signal sent.' };
}

function findDef(id: string) {
  return DEFINITIONS.find((d) => d.id === id);
}

const router = Router();
// Starting modules runs real mail/automation code with stored credentials and no login of its own,
// so it is never allowed on a public demo server, even if MODULES_ENABLED is set.
// Optional access gate (HTTP basic auth). When MODULE_ACCESS_PASSWORD is set, module web UIs and
// start/stop controls require it. Username is "transarabian".
const GATE_PASSWORD = process.env.MODULE_ACCESS_PASSWORD || '';
const GATE_USER = 'transarabian';

function gateOk(req: Request): boolean {
  if (!GATE_PASSWORD) return true;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  const same = (a: string, b: string) => {
    const x = Buffer.from(a), y = Buffer.from(b);
    return x.length === y.length && crypto.timingSafeEqual(x, y);
  };
  return same(decoded.slice(0, idx), GATE_USER) && same(decoded.slice(idx + 1), GATE_PASSWORD);
}

// Modules that can message real people or send email never start on the public preview
// unless the access gate is enabled. Dry-run modules may always start there.
const startsEnabled = (def?: ModuleDef) =>
  process.env.MODULES_ENABLED === 'true' &&
  (process.env.PUBLIC_DEMO !== 'true' || def?.dryRun === true || GATE_PASSWORD !== '');

router.use((req: Request, res: Response, next) => {
  const guarded = req.path.startsWith('/module/') || (req.method !== 'GET' && req.path.startsWith('/api/modules'));
  if (guarded && !gateOk(req)) {
    res.set('WWW-Authenticate', 'Basic realm="Module access"');
    return res.status(401).type('text').send('Authentication required.');
  }
  next();
});

router.get('/api/modules', (_req: Request, res: Response) => {
  res.json({ modulesEnabled: process.env.MODULES_ENABLED === 'true', modules: DEFINITIONS.map(describe) });
});

router.post('/api/modules/:id/start', (req: Request, res: Response) => {
  const def = findDef(String(req.params.id));
  if (!def) return res.status(404).json({ error: 'Unknown module.' });
  if (!startsEnabled(def)) return res.status(403).json({ error: 'Starting this module is disabled here (set MODULES_ENABLED=true; modules that can message real people never start on the public preview).' });
  const result = startModule(def);
  res.status(result.ok ? 200 : 400).json({ ...result, module: describe(def) });
});

router.post('/api/modules/:id/stop', (req: Request, res: Response) => {
  const def = findDef(String(req.params.id));
  if (!def) return res.status(404).json({ error: 'Unknown module.' });
  if (!startsEnabled(def)) return res.status(403).json({ error: 'Stopping this module is disabled on this server.' });
  const result = stopModule(def);
  res.json({ ...result, module: describe(def) });
});

// Reverse proxy: /module/<id>/... -> http://127.0.0.1:<port>/...
// Mounted BEFORE express.json() so request bodies stream through untouched.
router.use('/module/:id', (req: Request, res: Response) => {
  const def = findDef(String(req.params.id));
  if (!def || def.kind !== 'web') return res.status(404).type('text').send('Unknown module.');
  const state = getRun(def.id);
  if (!isAlive(state) || state.stopping) {
    return res.status(503).type('html').send(
      `<!doctype html><meta charset="utf-8"><body style="font-family:sans-serif;padding:24px">` +
      `<h3>${def.name} is not running</h3><p>Start it from its section in the main app.</p></body>`
    );
  }
  const rest = req.url === '/' || req.url === '' ? '/' : req.url;
  const upstream = http.request(
    {
      host: '127.0.0.1',
      port: def.port,
      method: req.method,
      path: rest,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${def.port}`,
        'x-forwarded-prefix': `/module/${def.id}`,
        'x-forwarded-host': String(req.headers.host || ''),
      },
    },
    (up) => {
      res.status(up.statusCode || 502);
      for (const [k, v] of Object.entries(up.headers)) if (v !== undefined) res.setHeader(k, v as string | string[]);
      up.pipe(res);
    }
  );
  upstream.on('error', (e) => {
    if (!res.headersSent) res.status(502).type('text').send(`Module unreachable: ${e.message}`);
  });
  req.pipe(upstream);
});

export default router;
