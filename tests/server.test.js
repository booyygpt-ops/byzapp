import { test } from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { startServer } from '../server/index.js';

const delay = ms => new Promise(r=>setTimeout(r,ms));
async function waitFor(check, timeout = 30000) { const start=Date.now(); while(Date.now()-start<timeout){const value=await check();if(value)return value;await delay(200);}throw new Error('Readiness timeout'); }

test('API authenticates, edits, runs and stops a real isolated Node and Python project', { timeout: 90000 }, async t => {
  // /workspace is visible to this environment's Docker daemon; /tmp may not be.
  await fs.mkdir('.data', { recursive: true });
  const root = await fs.mkdtemp(path.resolve('.data/test-'));
  let app;
  t.after(async()=>{await app?.close();await fs.rm(root,{recursive:true,force:true});});
  app=await startServer({dataDir:root});
  const call=async(url,method='GET',data)=>{const r=await fetch(app.url+'/api'+url,{method,headers:{Authorization:`Bearer ${app.token}`,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});return {status:r.status,data:await r.json()};};
  assert.equal((await fetch(app.url+'/api/projects')).status,401);
  const badHostStatus = await new Promise((resolve,reject) => { http.get(app.url+'/', { headers: { Host: 'evil.example' } }, r => { r.resume(); resolve(r.statusCode); }).on('error',reject); });
  assert.equal(badHostStatus,403);
  const health=(await call('/system')).data;assert.equal(health.docker,true);assert.equal(health.image,true);
  const created=await call('/projects','POST',{demo:true});assert.equal(created.status,202);const id=created.data.id;
  let p=await waitFor(async()=>{const p=(await call('/projects/'+id)).data;return p.status==='ready'&&p;});
  assert.equal(p.runtime,'Node.js');
  const tree=(await call(`/projects/${id}/tree`)).data;assert(tree.some(f=>f.name==='server.cjs'));
  assert.equal((await call(`/projects/${id}/file?path=../project.json`)).status,400);
  assert.equal((await call(`/projects/${id}/settings`,'PUT',{installCommand:'',startCommand:'node server.cjs',port:0})).status,400);
  const file=(await call(`/projects/${id}/file?path=server.cjs`)).data.content;
  assert.equal((await call(`/projects/${id}/file`,'PUT',{path:'server.cjs',content:file.replace('Bir fikirle başlar.','Düzenleme çalışıyor.')})).status,200);
  assert.equal((await call(`/projects/${id}/install`,'POST')).status,202);
  await waitFor(async()=>{const p=(await call('/projects/'+id)).data;return p.status==='ready'&&p.logs.some(l=>l.text.includes('çıkış kodu: 0'));});
  assert.equal((await call(`/projects/${id}/start`,'POST')).status,202);
  p=await waitFor(async()=>{const p=(await call('/projects/'+id)).data;return p.status==='running'&&p;});
  assert.match(await (await fetch(p.previewUrl)).text(),/Düzenleme çalışıyor/);
  assert.equal((await call(`/projects/${id}/start`,'POST')).status,409);
  assert.equal((await call(`/projects/${id}/file`,'PUT',{path:'server.cjs',content:'x'})).status,409);
  await call(`/projects/${id}/stop`,'POST');await waitFor(async()=>(await call('/projects/'+id)).data.status==='ready');
  await call(`/projects/${id}/settings`,'PUT',{installCommand:'',startCommand:'python3 -m http.server 3000 --bind 0.0.0.0',port:3000});
  await call(`/projects/${id}/start`,'POST');
  p=await waitFor(async()=>{const p=(await call('/projects/'+id)).data;return p.status==='running'&&p;});
  assert.match(await (await fetch(p.previewUrl+'/README.md')).text(),/# Merhaba Byz/);
  await call(`/projects/${id}/stop`,'POST');await waitFor(async()=>(await call('/projects/'+id)).data.status==='ready');
  await call(`/projects/${id}/settings`,'PUT',{installCommand:'',startCommand:'exit 23',port:3000}); await call(`/projects/${id}/start`,'POST');
  p=await waitFor(async()=>{const p=(await call('/projects/'+id)).data;return p.status==='error'&&p;});assert(p.logs.some(l=>l.text.includes('23')));
  await app.close();app=await startServer({dataDir:root});const restored=await call('/projects/'+id);assert.equal(restored.data.name,'merhaba-byz');assert.equal(restored.data.status,'error');
});
