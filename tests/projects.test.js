import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRepository, safeFile, detectProject, fileTree } from '../server/projects.js';

test('HTTPS addresses are normalized; credentials and local paths are rejected', () => {
  assert.deepEqual(parseRepository('https://github.com/owner/repo'), { host: 'github.com', owner: 'owner', name: 'repo', url: 'https://github.com/owner/repo.git' });
  assert.equal(parseRepository('https://gitlab.com/group/team/repo.git').owner, 'group/team');
  for (const input of ['file:///etc/passwd', 'http://github.com/a/b', 'https://token@github.com/a/b', 'https://127.0.0.1/a/b', 'https://localhost/a/b', 'https://github.com/a/b?x=y', '--upload-pack=sh']) assert.throws(() => parseRepository(input));
});

test('editor cannot traverse paths or follow external symlinks', async t => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'byz-path-test-')); t.after(() => fs.rm(temp, { recursive: true, force: true }));
  const root = path.join(temp, 'repo'); await fs.mkdir(root);
  await fs.writeFile(path.join(temp, 'outside'), 'private'); await fs.writeFile(path.join(root, 'inside.txt'), 'hello');
  await fs.symlink(path.join(temp, 'outside'), path.join(root, 'link')); await fs.symlink(temp, path.join(root, 'dirlink'));
  assert.equal(await fs.readFile(await safeFile(root, 'inside.txt'), 'utf8'), 'hello');
  for (const input of ['../outside', '/etc/passwd', 'link', 'dirlink/outside', '.git/config', 'node_modules/foo']) await assert.rejects(safeFile(root, input));
  for (const input of ['../outside', 'link', 'dirlink/new']) await assert.rejects(safeFile(root, input, { write: true }));
  assert.equal((await fileTree(root)).some(f=>f.name==='link'), false);
});

test('project detection preserves lockfile installation and host binding', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'byz-detect-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { dev: 'vite' }, devDependencies: { vite: '6' } }));
  await fs.writeFile(path.join(root, 'package-lock.json'), '{}');
  const config = await detectProject(root);
  assert.equal(config.installCommand, 'npm ci'); assert.match(config.startCommand, /--host 0.0.0.0/);
  await fs.rm(path.join(root, 'package.json')); await fs.writeFile(path.join(root, 'requirements.txt'), 'fastapi\nuvicorn'); await fs.writeFile(path.join(root, 'main.py'), '');
  assert.match((await detectProject(root)).startCommand, /uvicorn main:app/);
});
