import http from 'node:http';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseRepository, safeFile, detectProject, fileTree } from './projects.js';

const exec = promisify(execFile);
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const IMAGE = 'byz-runtime:1';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const clean = text => text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\r/g, '');

export async function startServer({ port = 0, dataDir = path.join(ROOT, '.data'), runtimeDir = path.join(ROOT, 'runtime'), dev = false } = {}) {
  await fs.mkdir(path.join(dataDir, 'projects'), { recursive: true });
  const token = randomBytes(32).toString('hex');
  const projects = new Map();
  const operations = new Map();
  const owner = Buffer.from(dataDir).toString('base64url').slice(-32).toLowerCase();
  const system = { building: false, logs: [] };
  let closing = false;
  let vite;
  if (dev) { const { createServer } = await import('vite'); vite = await createServer({ root: ROOT, server: { middlewareMode: true }, appType: 'custom' }); }
  const metaPath = id => path.join(dataDir, 'projects', id, 'project.json');
  const repoPath = id => path.join(dataDir, 'projects', id, 'repo');
  const save = async p => { await fs.mkdir(path.dirname(metaPath(p.id)), { recursive: true }); const tmp = metaPath(p.id) + '.tmp'; await fs.writeFile(tmp, JSON.stringify(p, null, 2)); await fs.rename(tmp, metaPath(p.id)); };
  for (const id of await fs.readdir(path.join(dataDir, 'projects'))) {
    if (!/^[a-f0-9-]{36}$/.test(id)) continue;
    try { const p = JSON.parse(await fs.readFile(metaPath(id), 'utf8')); p.status = p.status === 'importing' ? 'error' : p.status === 'error' ? 'error' : 'ready'; delete p.previewUrl; projects.set(id, p); } catch { /* incomplete import is left untouched */ }
  }
  // Only clean up containers created by this workspace in an earlier app session.
  try { const { stdout } = await exec('docker', ['ps', '-aq', '--filter', `label=dev.byz.workspace=${owner}`], { timeout: 5000 }); const ids = stdout.trim().split(/\s+/).filter(Boolean); if (ids.length) await exec('docker', ['rm', '-f', ...ids], { timeout: 15000 }); } catch { /* Docker may be offline; health endpoint explains it. */ }
  const append = (p, stream, text) => { p.logs ||= []; p.logs.push({ time: new Date().toISOString(), stream, text: clean(text) }); if (p.logs.length > 600) p.logs.splice(0, p.logs.length - 600); };
  const health = async () => {
    const [docker, git, image] = await Promise.all([exec('docker', ['info', '--format', '{{.ServerVersion}}'], { timeout: 5000 }).catch(() => null), exec('git', ['--version'], { timeout: 3000 }).catch(() => null), exec('docker', ['image', 'inspect', IMAGE], { timeout: 5000 }).catch(() => null)]);
    return { docker: !!docker, git: !!git, image: !!image, building: system.building, logs: system.logs };
  };
  async function command(p, executable, args, { container, timeout = 0 } = {}) {
    const child = spawn(executable, args, { windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' } });
    const op = { child, container, stopping: false }; operations.set(p.id, op);
    const timer = timeout ? setTimeout(() => { op.timedOut = true; child.kill(); }, timeout) : null;
    child.stdout.on('data', data => append(p, 'stdout', data.toString()));
    child.stderr.on('data', data => append(p, 'stderr', data.toString()));
    const code = await new Promise(resolve => { child.once('error', err => { append(p, 'stderr', err.message); resolve(-1); }); child.once('close', code => resolve(code ?? -1)); });
    clearTimeout(timer);
    if (operations.get(p.id) === op) operations.delete(p.id);
    if (op.timedOut) append(p, 'stderr', 'İşlem zaman aşımına uğradı.');
    return { code, stopped: op.stopping };
  }
  async function importProject(p, demo) {
    try {
      await save(p);
      if (demo) {
        await fs.mkdir(repoPath(p.id), { recursive: true });
        await fs.writeFile(path.join(repoPath(p.id), 'package.json'), JSON.stringify({ name: 'merhaba-byz', version: '1.0.0', scripts: { start: 'node server.cjs' } }, null, 2));
        await fs.writeFile(path.join(repoPath(p.id), 'server.cjs'), `const http = require('node:http');\nconst port = process.env.PORT || 3000;\nhttp.createServer((req, res) => {\n  res.setHeader('Content-Type', 'text/html; charset=utf-8');\n  res.end(\`<!doctype html><html lang="tr"><meta charset="utf-8"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#edf3ed;font:16px system-ui;color:#163e33}main{max-width:440px;padding:48px}i{font-style:normal;background:#d2e9b5;border-radius:20px;padding:14px}h1{font-size:42px;letter-spacing:-2px}p{line-height:1.8;color:#587064}code{background:white;padding:4px 8px;border-radius:6px}</style><main><i>✦</i><h1>Bir fikirle başlar.</h1><p>İlk projen Byz içinde çalışıyor. <code>server.cjs</code> dosyasını değiştir, kaydet ve yeniden çalıştır.</p><p>Node.js · Docker içinde · Sana ait bir alan</p></main></html>\`);\n}).listen(port, '0.0.0.0', () => console.log('Merhaba Byz, port ' + port));\n`);
        await fs.writeFile(path.join(repoPath(p.id), 'README.md'), '# Merhaba Byz\n\nBu örnek proje harici bağımlılık gerektirmez.\n\n1. Çalıştır düğmesine bas.\n2. Önizleme sekmesini aç.\n3. server.cjs dosyasını düzenleyip kaydet.\n4. Durdur ve tekrar çalıştır.\n');
        append(p, 'system', 'Örnek proje oluşturuldu. Çalıştır düğmesiyle başlayabilirsin.');
      } else {
        append(p, 'system', `${p.repositoryUrl} içe aktarılıyor…`);
        const result = await command(p, 'git', ['-c', 'credential.interactive=false', 'clone', '--depth', '1', '--', p.repositoryUrl, repoPath(p.id)], { timeout: 180000 });
        if (result.code !== 0) throw new Error('Depo içe aktarılamadı. Adresi, erişimi ve Git kurulumunu kontrol et. İlk sürüm herkese açık depolar içindir.');
        const { stdout } = await exec('git', ['-C', repoPath(p.id), 'branch', '--show-current'], { timeout: 5000 }); p.branch = stdout.trim();
      }
      Object.assign(p, await detectProject(repoPath(p.id)), { status: 'ready' });
      append(p, 'system', `${p.runtime} projesi hazır.`);
    } catch (e) { p.status = 'error'; append(p, 'stderr', e.message); }
    await save(p);
  }
  async function runProject(p, mode) {
    p.status = mode === 'install' ? 'installing' : 'starting'; delete p.previewUrl;
    const container = `byz-${p.id}-${mode}`;
    const args = ['run', '--rm', '--name', container, '--label', `dev.byz.workspace=${owner}`, '--user', '1000:1000', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--pids-limit=256', '--memory=1g', '--cpus=1', '--tmpfs', '/tmp:rw,nosuid,size=536870912', '--mount', `type=bind,src=${repoPath(p.id)},dst=/project`, '--workdir', '/project', '-e', 'HOME=/tmp', '-e', 'XDG_CACHE_HOME=/tmp/cache', '-e', `PORT=${p.port}`, '-e', 'HOST=0.0.0.0'];
    if (mode === 'start') args.push('-p', `127.0.0.1::${p.port}`);
    const script = mode === 'install' ? p.installCommand : p.startCommand;
    args.push(IMAGE, 'sh', '-lc', script);
    append(p, 'system', `$ ${script}`);
    const promise = command(p, 'docker', args, { container, timeout: mode === 'install' ? 600000 : 0 });
    let checking = false;
    const interval = mode === 'start' ? setInterval(async () => {
      if (checking || !operations.has(p.id) || p.previewUrl) return;
      checking = true;
      try {
        const { stdout } = await exec('docker', ['port', container, `${p.port}/tcp`], { timeout: 2000 });
        const match = stdout.match(/127\.0\.0\.1:(\d+)/);
        if (match) {
          const url = `http://127.0.0.1:${match[1]}`;
          await fetch(url, { signal: AbortSignal.timeout(1500) });
          if (operations.has(p.id)) { p.previewUrl = url; p.status = 'running'; append(p, 'system', 'Uygulama HTTP isteğine yanıt verdi. Önizleme hazır.'); }
        }
      } catch { /* server still starting */ } finally { checking = false; }
    }, 900) : null;
    const result = await promise; clearInterval(interval); delete p.previewUrl;
    p.status = result.stopped || result.code === 0 ? 'ready' : 'error';
    append(p, result.code === 0 || result.stopped ? 'system' : 'stderr', result.stopped ? 'Proje durduruldu.' : `İşlem tamamlandı (çıkış kodu: ${result.code}).`);
    await save(p);
  }
  async function stop(p) {
    const op = operations.get(p.id); if (!op) return;
    op.stopping = true;
    if (op.container) await exec('docker', ['stop', '--time', '3', op.container], { timeout: 10000 }).catch(() => {});
    else op.child.kill();
  }
  const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };
  const body = async req => { let data = ''; for await (const chunk of req) { data += chunk; if (Buffer.byteLength(data) > 1024 * 1024) throw new Error('İstek en fazla 1 MB olabilir.'); } return data ? JSON.parse(data) : {}; };
  const server = http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== `127.0.0.1:${server.address().port}`) return json(res, 403, { error: 'Geçersiz sunucu adresi.' });
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname.startsWith('/api/')) {
        if (req.headers.authorization !== `Bearer ${token}`) return json(res, 401, { error: 'Yetkisiz istek.' });
        if (closing) return json(res, 503, { error: 'Uygulama kapanıyor.' });
        if (url.pathname === '/api/system' && req.method === 'GET') return json(res, 200, await health());
        if (url.pathname === '/api/runtime' && req.method === 'POST') {
          if (system.building) return json(res, 409, { error: 'Ortam zaten hazırlanıyor.' });
          system.building = true; system.logs = [];
          const child = spawn('docker', ['build', '-t', IMAGE, runtimeDir], { windowsHide: true, env: { ...process.env, BUILDX_CONFIG: process.env.BUILDX_CONFIG || path.join(dataDir, 'buildx') } });
          const log = data => { system.logs.push(clean(data.toString())); if (system.logs.length > 500) system.logs.shift(); };
          child.stdout.on('data', log); child.stderr.on('data', log);
          child.on('error', err => { log(err.message); system.building = false; });
          child.on('close', code => { log(`Ortam hazırlığı tamamlandı: ${code}`); system.building = false; });
          return json(res, 202, { ok: true });
        }
        if (url.pathname === '/api/projects' && req.method === 'GET') return json(res, 200, [...projects.values()].map(({ logs, ...p }) => p));
        if (url.pathname === '/api/projects' && req.method === 'POST') {
          const input = await body(req); const demo = input.demo === true;
          const repo = demo ? { name: 'merhaba-byz', owner: 'örnek proje', host: 'local' } : parseRepository(input.url);
          const p = { id: randomUUID(), name: repo.name, owner: repo.owner, host: repo.host, repositoryUrl: repo.url, branch: demo ? 'yerel' : '…', createdAt: new Date().toISOString(), status: 'importing', logs: [] };
          projects.set(p.id, p); void importProject(p, demo);
          return json(res, 202, p);
        }
        const match = url.pathname.match(/^\/api\/projects\/([a-f0-9-]{36})(?:\/(\w+))?$/);
        if (!match || !projects.has(match[1])) return json(res, 404, { error: 'Proje bulunamadı.' });
        const p = projects.get(match[1]); const action = match[2];
        if (!action && req.method === 'GET') return json(res, 200, p);
        if (action === 'tree' && req.method === 'GET') return json(res, 200, await fileTree(repoPath(p.id)));
        if (action === 'file' && req.method === 'GET') {
          const target = await safeFile(repoPath(p.id), url.searchParams.get('path'));
          const stat = await fs.stat(target); if (!stat.isFile() || stat.size > 512000) throw new Error('Yalnızca 500 KB altındaki metin dosyaları açılabilir.');
          const content = await fs.readFile(target); if (content.includes(0)) throw new Error('İkili dosyalar düzenleyicide açılamaz.');
          return json(res, 200, { content: content.toString('utf8') });
        }
        if (action === 'file' && req.method === 'PUT') {
          if (operations.has(p.id) || p.status === 'importing') return json(res, 409, { error: 'Dosya düzenlemek için çalışan işlemi durdur.' });
          const input = await body(req); if (typeof input.content !== 'string' || Buffer.byteLength(input.content) > 512000) throw new Error('Dosya en fazla 500 KB olabilir.');
          const target = await safeFile(repoPath(p.id), input.path, { write: true }); await fs.writeFile(target, input.content); return json(res, 200, { ok: true });
        }
        if (action === 'settings' && req.method === 'PUT') {
          if (operations.has(p.id) || p.status === 'importing') return json(res, 409, { error: 'Önce çalışan işlemi durdur.' });
          const input = await body(req);
          if (typeof input.installCommand !== 'string' || typeof input.startCommand !== 'string' || !input.startCommand.trim() || input.startCommand.length > 4000 || input.installCommand.length > 4000 || !Number.isInteger(input.port) || input.port < 1 || input.port > 65535) throw new Error('Komutları ve port numarasını kontrol et.');
          Object.assign(p, { installCommand: input.installCommand, startCommand: input.startCommand, port: input.port }); await save(p); return json(res, 200, p);
        }
        if ((action === 'install' || action === 'start') && req.method === 'POST') {
          if (operations.has(p.id) || ['importing', 'installing', 'starting', 'running'].includes(p.status)) return json(res, 409, { error: 'Bu projede zaten bir işlem çalışıyor.' });
          if (!p.startCommand || (action === 'install' && !p.installCommand)) throw new Error('Önce proje komutlarını ayarla.');
          p.status = action === 'install' ? 'installing' : 'starting';
          void runProject(p, action).catch(async err => { p.status = 'error'; append(p, 'stderr', err.message); await save(p); });
          return json(res, 202, { ok: true });
        }
        if (action === 'stop' && req.method === 'POST') { await stop(p); return json(res, 200, { ok: true }); }
        return json(res, 405, { error: 'İşlem desteklenmiyor.' });
      }
      if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'İşlem desteklenmiyor.' });
      if (vite && !url.pathname.startsWith('/api/')) {
        if (url.pathname !== '/') return vite.middlewares(req, res, () => { res.writeHead(404); res.end(); });
        let html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
        html = await vite.transformIndexHtml('/', html.replace('</head>', `<meta name="byz-session" content="${token}"></head>`));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end(html);
      }
      const dist = path.join(ROOT, 'dist');
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const target = path.resolve(dist, relative);
      if (!target.startsWith(dist + path.sep)) return json(res, 403, { error: 'Erişim reddedildi.' });
      const content = await fs.readFile(target);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src http://127.0.0.1:*; object-src 'none'; base-uri 'self'; frame-ancestors 'none'" });
      res.end(relative === 'index.html' ? content.toString().replace('</head>', `<meta name="byz-session" content="${token}"></head>`) : content);
    } catch (err) { json(res, err.code === 'ENOENT' ? 404 : 400, { error: err.code === 'ENOENT' ? 'Dosya bulunamadı.' : err.message }); }
  });
  server.on('clientError', (_err, socket) => socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, token, close: async () => { closing = true; await Promise.all([...operations.keys()].map(id => stop(projects.get(id)))); await vite?.close(); await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); } };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const app = await startServer({ port: Number(process.env.PORT || 3000), dataDir: process.env.BYZ_DATA_DIR || undefined, dev: process.argv.includes('--dev') });
  console.log('Byz geliştirme sunucusu hazır. Port: ' + new URL(app.url).port);
  const shutdown = async () => { await app.close(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
}
