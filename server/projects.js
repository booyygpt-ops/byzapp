import path from 'node:path';
import { promises as fs } from 'node:fs';

export function parseRepository(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Geçerli bir HTTPS Git adresi gir.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port) throw new Error('Kimlik bilgisi içermeyen bir HTTPS Git adresi kullan.');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || !host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.endsWith('.local') || host.endsWith('.internal')) throw new Error('Herkese açık bir Git sunucusu kullan.');
  const parts = url.pathname.replace(/\/+$/, '').replace(/\.git$/, '').split('/').filter(Boolean);
  if (parts.length < 2 || parts.some(p => !/^[\w.-]+$/.test(p))) throw new Error('Depo adresi bir kullanıcı/organizasyon ve proje adı içermeli.');
  return { url: `https://${host}/${parts.join('/')}.git`, name: parts.at(-1), owner: parts.slice(0, -1).join('/'), host };
}

export async function safeFile(root, relative, { write = false } = {}) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.includes('\0') || relative.split('/').some(p => p === '..' || p === '.git' || p === 'node_modules' || p === '.venv')) throw new Error('Bu dosya yoluna erişilemiyor.');
  const target = path.resolve(root, relative);
  const realRoot = await fs.realpath(root);
  const real = await fs.realpath(write ? path.dirname(target) : target);
  if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new Error('Proje klasörü dışına erişilemez.');
  if (write) {
    try { const stat = await fs.lstat(target); if (stat.isSymbolicLink()) throw new Error('Sembolik bağlantı düzenlenemez.'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return target;
}

export async function detectProject(root) {
  const exists = async f => !!(await fs.stat(path.join(root, f)).catch(() => null));
  if (await exists('package.json')) {
    const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    const scripts = pkg.scripts || {};
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const script = scripts.dev ? 'dev' : scripts.start ? 'start' : null;
    return { runtime: 'Node.js', installCommand: await exists('package-lock.json') ? 'npm ci' : 'npm install --no-package-lock', startCommand: script ? `npm run ${script}${deps.vite ? ' -- --host 0.0.0.0 --port 3000' : deps.next ? ' -- --hostname 0.0.0.0 --port 3000' : ''}` : 'node index.js', port: 3000, scripts: Object.keys(scripts) };
  }
  if (await exists('requirements.txt') || await exists('pyproject.toml') || await exists('app.py') || await exists('main.py')) {
    const requirements = await fs.readFile(path.join(root, 'requirements.txt'), 'utf8').catch(() => '');
    const module = await exists('app.py') ? 'app' : 'main';
    return { runtime: 'Python', installCommand: `python3 -m venv .venv && .venv/bin/pip install ${await exists('requirements.txt') ? '-r requirements.txt' : await exists('pyproject.toml') ? '-e .' : 'flask'}`, startCommand: /fastapi|uvicorn/i.test(requirements) ? `.venv/bin/uvicorn ${module}:app --host 0.0.0.0 --port 3000` : `.venv/bin/flask --app ${module} run --host 0.0.0.0 --port 3000`, port: 3000, scripts: [] };
  }
  return { runtime: 'Statik', installCommand: '', startCommand: 'python3 -m http.server 3000 --bind 0.0.0.0', port: 3000, scripts: [] };
}

export async function fileTree(root, relative = '', budget = { left: 1000 }, depth = 0) {
  const excluded = new Set(['.git', 'node_modules', '.venv', '__pycache__', '.next', 'dist', '.cache']);
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const result = [];
  for (const e of entries.sort((a, b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name))) {
    if (excluded.has(e.name) || e.isSymbolicLink() || budget.left-- <= 0) continue;
    const rel = relative ? relative + '/' + e.name : e.name;
    result.push({ name: e.name, path: rel, type: e.isDirectory() ? 'directory' : 'file', ...(e.isDirectory() && depth < 7 ? { children: await fileTree(root, rel, budget, depth + 1) } : {}) });
  }
  return result;
}
