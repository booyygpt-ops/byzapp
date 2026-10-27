import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Boxes, Plus, FolderGit2, Settings2, ArrowUpRight, ChevronRight, ChevronDown, FileCode2, FileText, Folder, Play, Square, Download, GitBranch, Github, Terminal, X, Check, LoaderCircle, Search, PanelLeftClose, PanelLeftOpen, Save, RefreshCw, CircleHelp, ArrowRight, ShieldCheck, Monitor, Code2, Globe, MoreHorizontal, ExternalLink, CircleAlert, Sparkles, Command } from 'lucide-react';
import './styles.css';

const token = document.querySelector('meta[name="byz-session"]')?.content;
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers } });
  const result = await res.json(); if (!res.ok) throw new Error(result.error || 'İşlem başarısız.'); return result;
}
const labels = { importing: 'İçe aktarılıyor', ready: 'Hazır', starting: 'Başlatılıyor', running: 'Çalışıyor', installing: 'Kuruluyor', error: 'Kontrol gerekli' };
const busy = status => ['starting', 'running', 'installing', 'importing'].includes(status);
const IconButton = ({ title, children, ...props }) => <button className="icon-button" title={title} aria-label={title} {...props}>{children}</button>;
const Spinner = () => <LoaderCircle size={15} className="spin" />;
function App() {
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [project, setProject] = useState(null);
  const [health, setHealth] = useState(null);
  const [systemOpen, setSystemOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('files');
  const [tree, setTree] = useState([]);
  const [file, setFile] = useState(null);
  const [content, setContent] = useState('');
  const [original, setOriginal] = useState('');
  const [notice, setNotice] = useState(null);
  const [pending, setPending] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [settings, setSettings] = useState({ installCommand: '', startCommand: '', port: 3000 });
  const [previewKey, setPreviewKey] = useState(0);
  const [logOpen, setLogOpen] = useState(true);
  const logsEnd = useRef(null);
  const request = useRef(0);
  const dirty = content !== original;
  const toast = (message, error = false) => setNotice({ message, error });
  const loadProjects = async () => { try { setProjects(await api('/projects')); } catch (e) { toast(e.message, true); } };
  const loadHealth = async () => { try { setHealth(await api('/system')); } catch (e) { toast(e.message, true); } };
  useEffect(() => { loadProjects(); loadHealth(); const i = setInterval(loadProjects, 1800); const h = setInterval(loadHealth, 6000); return () => { clearInterval(i); clearInterval(h); }; }, []);
  useEffect(() => { if (!notice) return; const i = setTimeout(() => setNotice(null), 6000); return () => clearTimeout(i); }, [notice]);
  useEffect(() => {
    if (!selectedId) { setProject(null); return; }
    let alive = true;
    const load = async () => { try { const p = await api(`/projects/${selectedId}`); if (alive) setProject(p); } catch (e) { if (alive) toast(e.message, true); } };
    load(); const i = setInterval(load, 1000); return () => { alive = false; clearInterval(i); };
  }, [selectedId]);
  useEffect(() => {
    if (!project || project.status === 'importing') return;
    let alive = true;
    api(`/projects/${project.id}/tree`).then(t => { if (alive) setTree(t); }).catch(() => {});
    return () => { alive = false; };
  }, [project?.id, project?.status]);
  useEffect(() => { if (project) setSettings({ installCommand: project.installCommand || '', startCommand: project.startCommand || '', port: project.port || 3000 }); }, [project?.id, project?.installCommand, project?.startCommand, project?.port]);
  useEffect(() => { if (logsEnd.current) { const container = logsEnd.current.parentElement; container.scrollTop = container.scrollHeight; } }, [project?.logs?.length, logOpen]);
  useEffect(() => { const handler = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', handler); return () => window.removeEventListener('beforeunload', handler); }, [dirty]);
  function discardOkay() { return !dirty || window.confirm('Kaydedilmemiş değişiklikler var. Yine de devam edilsin mi?'); }
  function select(id) { if (id === selectedId || !discardOkay()) return; request.current++; setProject(null); setTree([]); setFile(null); setContent(''); setOriginal(''); setSelectedId(id); setTab('files'); setSystemOpen(false); }
  async function openFile(item) {
    if (!discardOkay()) return;
    const ticket = ++request.current;
    try { const result = await api(`/projects/${selectedId}/file?path=${encodeURIComponent(item.path)}`); if (ticket !== request.current) return; setFile(item.path); setContent(result.content); setOriginal(result.content); } catch (e) { toast(e.message, true); }
  }
  async function saveFile() {
    if (!file || !dirty || pending) return;
    setPending(true);
    try { await api(`/projects/${selectedId}/file`, { method: 'PUT', body: JSON.stringify({ path: file, content }) }); setOriginal(content); toast('Değişiklikler kaydedildi.'); } catch (e) { toast(e.message, true); } finally { setPending(false); }
  }
  async function action(name) {
    if (dirty) { toast('Çalıştırmadan önce dosyanı kaydet.', true); return; }
    setPending(true);
    try { await api(`/projects/${selectedId}/${name}`, { method: 'POST' }); setProject(await api(`/projects/${selectedId}`)); setLogOpen(true); } catch (e) { toast(e.message, true); } finally { setPending(false); }
  }
  async function saveSettings(e) {
    e.preventDefault(); setPending(true);
    try { const p = await api(`/projects/${selectedId}/settings`, { method: 'PUT', body: JSON.stringify({ ...settings, port: Number(settings.port) }) }); setProject(p); toast('Çalıştırma ayarları kaydedildi.'); } catch (e) { toast(e.message, true); } finally { setPending(false); }
  }
  async function demo() {
    if (!discardOkay()) return;
    setPending(true);
    try { const p = await api('/projects', { method: 'POST', body: JSON.stringify({ demo: true }) }); await loadProjects(); select(p.id); } catch (e) { toast(e.message, true); } finally { setPending(false); }
  }
  const available = health?.docker && health?.image;
  const shown = projects.filter(p => `${p.name} ${p.owner}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="app-shell">
    <aside className="rail">
      <button className="brand" aria-label="Byz ana sayfa" onClick={() => { if (discardOkay()) { setSelectedId(null); setSystemOpen(false); setContent(''); setOriginal(''); } }}>b<span>✦</span></button>
      <div className="rail-main"><button className={!systemOpen ? 'active' : ''} title="Çalışma alanı" onClick={() => setSystemOpen(false)}><Boxes size={22}/></button><button className={systemOpen ? 'active' : ''} title="Ortam ayarları" onClick={() => setSystemOpen(true)}><Settings2 size={21}/></button></div>
      <div className="rail-bottom"><button title="Kullanım rehberi" onClick={() => setSystemOpen(true)}><CircleHelp size={21}/></button><div className="avatar">B</div></div>
    </aside>
    {sidebar && <aside className="project-sidebar">
      <div className="workspace-name"><div className="workspace-icon"><Command size={17}/></div><div><strong>Kişisel alanım</strong><span>Yerel çalışma alanı</span></div><IconButton title="Kenar çubuğunu gizle" onClick={() => setSidebar(false)}><PanelLeftClose size={16}/></IconButton></div>
      <div className="section-label">ÇALIŞMA ALANI <span>01</span></div>
      <button className="sidebar-current" onClick={() => setSystemOpen(false)}><FolderGit2 size={17}/> Projelerim <span>{projects.length}</span></button>
      <div className="projects-heading"><span>PROJELER</span><IconButton title="Depo ekle" onClick={() => setImportOpen(true)}><Plus size={16}/></IconButton></div>
      <div className="search-field"><Search size={15}/><input aria-label="Projelerde ara" placeholder="Proje ara…" value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌕</kbd></div>
      <div className="project-list">{shown.map(p => <button key={p.id} className={`project-item ${p.id === selectedId ? 'selected' : ''}`} onClick={() => select(p.id)}><div className={`project-symbol ${p.status === 'running' ? 'running' : ''}`}><FolderGit2 size={18}/></div><div><strong>{p.name}</strong><small>{p.owner}</small></div><span className={`status-dot ${p.status}`}/></button>)}{!shown.length && <p className="sidebar-empty">{query ? 'Eşleşen proje yok.' : 'Bir sonraki fikrin için yer hazır.'}</p>}</div>
      <button className="add-repo" onClick={() => setImportOpen(true)}><Plus size={16}/> Yeni depo ekle</button>
      <div className="sidebar-bottom"><div className="local-tag"><ShieldCheck size={16}/><strong>Senin bilgisayarında.</strong></div><p>Dosyaların yerel diskte, projelerin ayrı konteynerlerde.</p><div className="system-indicator"><span className={`status-dot ${available ? 'running' : health ? 'error' : ''}`}/><span>{available ? 'Çalışma ortamı hazır' : health ? 'Ortam kurulumu gerekli' : 'Ortam kontrol ediliyor'}</span><button aria-label="Ortam ayrıntıları" onClick={() => setSystemOpen(true)}><ChevronRight size={15}/></button></div></div>
    </aside>}
    <main className="main">
      <header className="topbar"><div className="breadcrumbs">{!sidebar && <IconButton title="Kenar çubuğunu göster" onClick={() => setSidebar(true)}><PanelLeftOpen size={17}/></IconButton>}<span>Kişisel alanım</span><ChevronRight size={13}/><strong>{systemOpen ? 'Ortam ayarları' : project ? project.name : 'Projelerim'}</strong></div><div className="topbar-right"><span className="desktop-label"><Monitor size={13}/> MASAÜSTÜ</span><span className="version">v0.1.0</span></div></header>
      {systemOpen ? <SystemPanel health={health} refresh={loadHealth} toast={toast}/> : !selectedId ? <div className="home">
        <div className="page-heading"><div><div className="eyebrow"><span/> FİKİRLERİ ÇALIŞTIR</div><h1>Projelerin için bir alan.</h1><p>Bir depo getir. Keşfet, düzenle, çalıştır.</p></div><button className="button primary" onClick={() => setImportOpen(true)}><Plus size={17}/> Depo içe aktar</button></div>
        <div className="hero-card"><div className="hero-copy"><span className="pill">DAHA AZ KURULUM, DAHA ÇOK ÜRETİM</span><h2>İlhamı bulduğun yerden<br/>devam et.</h2><p>GitHub, GitLab veya başka bir Git sunucusu.<br/>Projeyi kendi çalışma alanına taşı.</p><button onClick={() => setImportOpen(true)}>İlk deponu ekle <ArrowUpRight size={17}/></button></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-chip github"><Github size={29}/></div><div className="art-chip code"><Code2 size={30}/></div><div className="art-chip terminal"><Terminal size={25}/></div><div className="art-core"><Boxes size={51} strokeWidth={1.3}/></div><span className="sparkle s1">✧</span><span className="sparkle s2">✦</span><div className="art-label"><span/> Fikir → çalışan proje</div></div></div>
        <div className="list-title"><div><h2>Projelerin <span>{projects.length}</span></h2><p>Kaldığın yerden devam et.</p></div><span className="subtle"><Folder size={14}/> Yerel projeler</span></div>
        {projects.length ? <div className="project-grid">{projects.map(p => <button key={p.id} className="project-card" onClick={() => select(p.id)}><div className="card-top"><div className="card-icon"><FolderGit2 size={23}/></div><span className={`status-badge ${p.status}`}><span className={`status-dot ${p.status}`}/>{labels[p.status]}</span></div><h3>{p.name}</h3><p>{p.host === 'local' ? 'Başlamak için küçük bir örnek' : `${p.host} / ${p.owner}`}</p><div className="card-bottom"><span><GitBranch size={13}/>{p.branch}</span><span>{p.runtime || 'Algılanıyor'}<ArrowUpRight size={15}/></span></div></button>)}<button className="project-card new-card" onClick={() => setImportOpen(true)}><span><Plus size={23}/></span><strong>Yeni bir şey keşfet</strong><p>Bir Git adresiyle başla</p></button></div> : <div className="empty-projects"><div className="empty-symbol"><FolderGit2 size={27}/></div><div><h3>İlk projen burada başlayacak.</h3><p>Bir depo ekle veya hazır örnekle çalışma alanını keşfet.</p></div><button className="button secondary" onClick={demo} disabled={pending}>{pending ? <Spinner/> : <Play size={15}/>} Örnek projeyi aç</button></div>}
        <div className="how-it-works">{[{ n: '01', title: 'Depoyu getir', text: 'Herkese açık bir Git adresini yapıştır.', icon: Download }, { n: '02', title: 'Kendine göre düzenle', text: 'Dosyaları incele, komutlarını ayarla.', icon: FileCode2 }, { n: '03', title: 'Çalışırken gör', text: 'Günlükleri izle, önizlemeyi aç.', icon: Play }].map(({n,title,text,icon:Icon}) => <div key={n}><span className="step-number">{n}</span><div><h4>{title}</h4><p>{text}</p></div><Icon size={20}/></div>)}</div>
        <footer className="home-footer"><span><ShieldCheck size={14}/> Yerel dosyalar · Docker ile ayrı çalışma ortamları</span><button onClick={() => setSystemOpen(true)}>Ortamını kontrol et <ArrowRight size={14}/></button></footer>
      </div> : !project ? <div className="center-state"><Spinner/> Proje yükleniyor…</div> : <>
        <section className="project-header"><div className="project-heading"><div className="card-icon"><FolderGit2 size={24}/></div><div><h1>{project.name}<span className={`status-badge ${project.status}`}><span className={`status-dot ${project.status}`}/>{labels[project.status]}</span></h1><p>{project.owner} <span>/</span> <GitBranch size={12}/> {project.branch} <span>·</span> {project.runtime || 'Proje algılanıyor'}</p></div></div><div className="project-actions"><button className="button secondary" disabled={!available || busy(project.status) || !project.installCommand || pending} onClick={() => action('install')}><Download size={15}/> Bağımlılıkları kur</button>{busy(project.status) && project.status !== 'importing' ? <button className="button stop" disabled={pending} onClick={() => action('stop')}><Square size={14}/> Durdur</button> : <button className="button primary" disabled={!available || project.status === 'importing' || pending} onClick={() => action('start')}><Play size={15}/> Çalıştır</button>}</div></section>
        {!available && <button className="setup-banner" onClick={() => setSystemOpen(true)}><CircleAlert size={16}/><span>Projeyi çalıştırmak için Docker ortamını hazırla.</span><span>Kuruluma git <ArrowRight size={14}/></span></button>}
        <div className="project-tabs">{[{id:'files',name:'Dosyalar',icon:Code2},{id:'preview',name:'Önizleme',icon:Globe},{id:'settings',name:'Çalıştırma ayarları',icon:Settings2}].map(({id,name,icon:Icon}) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={15}/>{name}{id==='preview' && project.previewUrl && <span className="status-dot running"/>}</button>)}<span className="container-note"><ShieldCheck size={13}/> Docker içinde</span></div>
        <div className="project-content">{tab === 'files' ? <div className="file-workspace"><div className="file-sidebar"><div className="file-sidebar-title">DOSYA GEZGİNİ <span>{tree.length}</span></div>{project.status === 'importing' ? <div className="file-loading"><Spinner/> Depo alınıyor…</div> : <Tree items={tree} openFile={openFile} selected={file}/>}</div><div className="editor">{file ? <><div className="editor-title"><span><FileCode2 size={14}/>{file}{dirty && <span className="unsaved-dot"/>}</span><button className="save-button" disabled={!dirty || busy(project.status) || pending} onClick={saveFile}><Save size={14}/> Kaydet</button></div><div className="editor-body"><div className="line-numbers" aria-hidden="true">{content.split('\n').map((_,i) => <div key={i}>{i+1}</div>)}</div><textarea spellCheck={false} aria-label={`${file} içeriği`} value={content} onChange={e => setContent(e.target.value)} readOnly={busy(project.status)} onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile(); } if (e.key === 'Tab' && !busy(project.status)) { e.preventDefault(); const start=e.target.selectionStart; setContent(content.slice(0,start)+'  '+content.slice(e.target.selectionEnd)); requestAnimationFrame(() => { e.target.selectionStart=e.target.selectionEnd=start+2; }); } }}/></div><div className="editor-status"><span>{dirty ? 'Kaydedilmemiş değişiklikler' : 'Tüm değişiklikler kaydedildi'}</span><span>UTF-8 <span>·</span> {content.split('\n').length} satır</span></div></> : <div className="editor-empty"><div className="editor-empty-icon"><Code2 size={35} strokeWidth={1.4}/></div><h3>İçeriye bir göz at.</h3><p>İncelemek veya düzenlemek için<br/>soldan bir dosya seç.</p><span><FileText size={13}/> Metin dosyaları · En fazla 500 KB</span></div>}</div></div> : tab === 'preview' ? <div className="preview-panel"><div className="preview-toolbar"><span><span className={`status-dot ${project.previewUrl ? 'running' : ''}`}/>{project.previewUrl ? `Yerel önizleme · port ${project.port}` : 'Uygulama bekleniyor'}</span><IconButton title="Önizlemeyi yenile" onClick={() => setPreviewKey(k=>k+1)} disabled={!project.previewUrl}><RefreshCw size={15}/></IconButton></div>{project.previewUrl ? <iframe title={`${project.name} önizleme`} key={previewKey} src={project.previewUrl} sandbox="allow-scripts allow-forms allow-same-origin" referrerPolicy="no-referrer"/> : <div className="editor-empty"><Globe size={35} strokeWidth={1.3}/><h3>Fikrini çalışırken gör.</h3><p>Projeyi çalıştırdığında, HTTP yanıtı veren<br/>uygulaman burada görünecek.</p><small>Sunucu 0.0.0.0 adresini ve ayarlanan portu dinlemeli.</small></div>}</div> : <form className="settings-form" onSubmit={saveSettings}><span className="eyebrow">PROJEYE ÖZEL</span><h2>Nasıl çalıştıralım?</h2><p>Komutlar proje klasöründe, ayrı bir Linux konteynerinde çalışır.</p><label>Kurulum komutu<textarea aria-label="Kurulum komutu" value={settings.installCommand} onChange={e=>setSettings({...settings,installCommand:e.target.value})} placeholder="npm ci" disabled={busy(project.status)}/><small>Bağımlılık gerekmiyorsa boş bırakabilirsin.</small></label><label>Başlatma komutu<textarea required aria-label="Başlatma komutu" value={settings.startCommand} onChange={e=>setSettings({...settings,startCommand:e.target.value})} disabled={busy(project.status)}/></label><label className="port-label">Uygulama portu<input aria-label="Uygulama portu" type="number" min="1" max="65535" required value={settings.port} onChange={e=>setSettings({...settings,port:e.target.value})} disabled={busy(project.status)}/><small>Komuttaki port ile aynı olmalı. Sunucuyu 0.0.0.0 üzerinde başlat.</small></label><div className="settings-note"><ShieldCheck size={17}/><p>Projeler 1 GB bellek ve 1 CPU sınırıyla çalışır. Yalnızca bu projenin klasörü konteynerle paylaşılır. İlk sürüm, güvendiğin projeleri kişisel kullanım içindir.</p></div><button className="button primary" disabled={busy(project.status) || pending}><Check size={15}/> Ayarları kaydet</button></form>}</div>
        <section className={`console ${logOpen ? 'open' : ''}`}><button className="console-heading" onClick={()=>setLogOpen(!logOpen)}><span><Terminal size={15}/> Günlükler <span className="log-count">{project.logs?.length || 0}</span></span><span>{busy(project.status) && <><span className="status-dot running"/> Canlı</>}<ChevronDown size={15} style={{transform:logOpen?'none':'rotate(180deg)'}}/></span></button>{logOpen && <div className="console-output">{!project.logs?.length && <p className="log-placeholder">Kurulum ve çalıştırma çıktıları burada görünecek.</p>}{project.logs?.map((log,i)=><div className={`log-line ${log.stream}`} key={i}><time>{new Date(log.time).toLocaleTimeString('tr-TR',{hour12:false})}</time><pre>{log.text}</pre></div>)}<div ref={logsEnd}/></div>}</section>
      </>}
      <div className="statusbar"><span><span className="status-dot running"/> Yerel çalışma alanı</span><span>Node.js & Python <span>·</span> Byz Workspace</span></div>
    </main>
    {importOpen && <ImportModal close={()=>setImportOpen(false)} imported={async id=>{await loadProjects();select(id);setImportOpen(false);}} toast={toast}/>}
    {notice && <div role="status" className={`toast ${notice.error?'error':''}`}>{notice.error?<CircleAlert size={18}/>:<Check size={18}/>}<span>{notice.message}</span><IconButton title="Bildirimi kapat" onClick={()=>setNotice(null)}><X size={15}/></IconButton></div>}
  </div>;
}
function Tree({items,openFile,selected,level=0}) {
  const [closed,setClosed]=useState({});
  return items.map(item=><React.Fragment key={item.path}>{item.type==='directory'?<><button className="tree-item directory" style={{paddingLeft:14+level*14}} onClick={()=>setClosed({...closed,[item.path]:!closed[item.path]})}>{closed[item.path]?<ChevronRight size={12}/>:<ChevronDown size={12}/>}<Folder size={14}/><span>{item.name}</span></button>{!closed[item.path]&&<Tree items={item.children||[]} openFile={openFile} selected={selected} level={level+1}/>}</>:<button className={`tree-item ${selected===item.path?'selected':''}`} style={{paddingLeft:28+level*14}} onClick={()=>openFile(item)}>{/\.(js|jsx|ts|tsx|py|json|html|css|cjs)$/.test(item.name)?<FileCode2 size={14}/>:<FileText size={14}/>}<span>{item.name}</span></button>}</React.Fragment>);
}
function ImportModal({close,imported,toast}) {
  const [url,setUrl]=useState(''); const [pending,setPending]=useState(false); const [error,setError]=useState('');
  const input=useRef(null);
  useEffect(()=>{ input.current?.focus(); const key=e=>{if(e.key==='Escape'&&!pending)close();}; window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[pending]);
  async function submit(e){ e.preventDefault();setPending(true);setError('');try{const p=await api('/projects',{method:'POST',body:JSON.stringify({url})});await imported(p.id);}catch(e){setError(e.message);}finally{setPending(false);} }
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!pending)close();}}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="modal-top"><div className="card-icon"><FolderGit2 size={23}/></div><IconButton title="Kapat" onClick={close} disabled={pending}><X size={19}/></IconButton></div><h2 id="import-title">Yeni bir projeye yer aç.</h2><p>Herkese açık bir Git deposunun HTTPS adresini ekle.<br/>Dosyaları kendi bilgisayarına alalım.</p><form onSubmit={submit}><label>Depo adresi<div className="repo-input"><Github size={19}/><input ref={input} type="url" required placeholder="https://github.com/kullanici/proje" value={url} onChange={e=>setUrl(e.target.value)} disabled={pending}/></div></label>{error&&<p role="alert" className="form-error">{error}</p>}<div className="import-note"><ShieldCheck size={17}/><p>İçe aktarmak kodu çalıştırmaz. Kurulum ve çalıştırma komutlarını sen başlatırsın. Projeyi ve lisansını önce incele.</p></div><button className="button primary full-width" disabled={pending}>{pending?<Spinner/>:<Download size={16}/>} {pending?'İçe aktarılıyor…':'Depoyu içe aktar'}</button></form><div className="supported"><Check size={13}/> GitHub <span>·</span> GitLab <span>·</span> Diğer HTTPS Git sunucuları</div></section></div>;
}
function SystemPanel({health,refresh,toast}) {
  const [pending,setPending]=useState(false);
  async function build(){setPending(true);try{await api('/runtime',{method:'POST'});await refresh();}catch(e){toast(e.message,true);}finally{setPending(false);}}
  return <div className="system-page"><div className="eyebrow">BİLGİSAYARINDA BİR ATÖLYE</div><h1>Çalışma ortamın.</h1><p>Bir kez hazırla, projelerinde tekrar kullan.</p><div className="system-cards">{[{name:'Git',desc:'Herkese açık depoları bilgisayarına almak için.',ok:health?.git,icon:GitBranch,hint:'Windows için Git’i git-scm.com üzerinden kur, ardından Byz’i yeniden aç.'},{name:'Docker Desktop',desc:'Proje komutlarını ayrı Linux konteynerlerinde çalıştırır.',ok:health?.docker,icon:Boxes,hint:'Docker Desktop’ı kur ve aç. WSL 2 motoru ile Linux konteynerlerini etkinleştir.'},{name:'Byz çalışma imajı',desc:'Node.js 22, Python 3 ve temel geliştirme araçları.',ok:health?.image,icon:Terminal,hint:'Docker hazır olduğunda aşağıdaki düğmeyle çalışma imajını oluştur.'}].map(({name,desc,ok,icon:Icon,hint})=><div className="system-card" key={name}><div className="card-icon"><Icon size={21}/></div><div><h3>{name}</h3><p>{desc}</p>{health&&!ok&&<small>{hint}</small>}</div><span className={`health-pill ${ok?'ok':''}`}>{!health?<Spinner/>:ok?<><Check size={13}/> Hazır</>: 'Gerekli'}</span></div>)}</div><div className="system-buttons"><button className="button primary" disabled={!health?.docker||health?.building||pending} onClick={build}>{health?.building?<Spinner/>:<Download size={16}/>} {health?.building?'Ortam hazırlanıyor…':health?.image?'Çalışma imajını yenile':'Çalışma ortamını hazırla'}</button><button className="button secondary" onClick={refresh}><RefreshCw size={15}/> Yeniden kontrol et</button></div><p className="system-fineprint">İlk hazırlık internet bağlantısı gerektirir ve birkaç dakika sürebilir.</p>{!!health?.logs?.length&&<pre className="build-log">{health.logs.join('')}</pre>}<div className="guide"><h2>İlk projen, üç adımda.</h2><ol><li><strong>Bir depo ekle.</strong> GitHub, GitLab veya diğer HTTPS Git adreslerini kullan. İlk sürüm herkese açık depoları destekler.</li><li><strong>Komutları incele.</strong> Node.js ve Python için başlangıç komutları algılanır. Gerekirse “Çalıştırma ayarları”ndan düzenle ve bağımlılıkları kur.</li><li><strong>Çalıştır ve keşfet.</strong> Web sunucusu 0.0.0.0 adresini ve belirtilen portu dinlemeli. Günlüklerden çıktıları, önizlemeden uygulamayı izle.</li></ol><p>Bu sürüm Docker tabanlı projeler, mobil uygulamalar, GPU servisleri veya veritabanı kümelerini otomatik kurmaz. Kişisel kullanım ve güvendiğin kodlar içindir; herkese açık bir kod çalıştırma hizmeti değildir.</p></div></div>;
}

createRoot(document.getElementById('root')).render(<App/>);
