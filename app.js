'use strict';
const L = MenuLib, $ = selector => document.querySelector(selector);
const KEY = 'menu-pwa-local-v2', CATALOG_KEY = 'menu-pwa-catalog-v2';
let state = L.initial(), catalog = {apps: [], repositories: []}, editing = null, pendingImport = null, deleting = null;
let storageBlocked = false, toastTimer;
function message(text) { $('#drawer-message').textContent = text; $('#message').textContent = text; $('#message').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#message').hidden = true, 6500); }
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    const saved = JSON.parse(raw);
    const valid = L.validateBackup({...saved, format: 'menu-pwa-backup', version: 2, exportedAt: new Date().toISOString()});
    state = {...L.initial(), ...valid, changes: Number.isSafeInteger(saved.changes) && saved.changes >= 0 ? saved.changes : 0, lastBackupAt: saved.lastBackupAt || null, lastExportAt: saved.lastExportAt || null};
  }
} catch { storageBlocked = true; message('Dados locais indisponíveis. Exporte um backup antes de sair.'); }
function save(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); storageBlocked = false; }
  catch { storageBlocked = true; message('Não foi possível salvar neste navegador. Exporte um backup antes de sair.'); }
  state = next; render();
}
function change(patch) { save(L.mutate(state, patch)); }
const date = value => { const d = new Date(value); return Number.isFinite(d.getTime()) ? d.toLocaleString('pt-BR', {dateStyle: 'short', timeStyle: 'short'}) : 'Data indisponível'; };
function element(tag, className, text) { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; }
function button(label, action, icon) {
  const b = element('button', '', icon ? '' : label); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
  if (icon) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(svg.namespaceURI, 'path'); p.setAttribute('d', icon); svg.append(p); b.append(svg);
  }
  b.onclick = action; return b;
}
function allApps() { return [...catalog.apps, ...state.manual]; }
function icon(app) {
  const wrap = element('span', 'icon', (app.name.trim()[0] || '?').toUpperCase()); wrap.setAttribute('aria-hidden', 'true');
  const base = new URL(app.url), site = new URL('./', base);
  const candidates = [...new Set([...(app.iconCandidates || []), app.icon, new URL('apple-touch-icon.png', site).href, new URL('/apple-touch-icon.png', base).href, new URL('/favicon.ico', base).href].filter(Boolean))].filter(value => { try { L.url(value); return true; } catch { return false; } });
  if (candidates.length) {
    const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; let i = 0;
    img.onload = () => img.classList.add('loaded');
    img.onerror = () => { img.classList.remove('loaded'); i++; if (i < candidates.length) img.src = candidates[i]; else img.remove(); }; img.src = candidates[0]; wrap.append(img);
  }
  return wrap;
}
function row(app, hidden = false) {
  const id = L.identity(app), manual = app.source === 'manual';
  const row = element('div', 'app-row'), link = element('a', 'app-link'); link.href = L.url(app.url); link.target = '_blank'; link.rel = 'noopener noreferrer';
  const label = element('span', 'app-label'); label.append(element('span', 'app-name', app.name));
  label.append(element('span', 'app-sub', L.variant(app) ? app.manifest.replace(/\/?[^/]+$/, '') : new URL(app.url).hostname)); link.append(icon(app), label);
  const tools = element('div', 'row-tools');
  if (manual) tools.append(button('Editar ' + app.name, () => openEditor(app), 'm4 16-1 5 5-1L21 7l-5-5Z M14 4l6 6'));
  tools.append(button((hidden ? 'Mostrar ' : 'Ocultar ') + app.name, () => change({hiddenIds: hidden ? state.hiddenIds.filter(x => x !== id) : [...new Set([...state.hiddenIds, id])]}), hidden ? 'M12 5v14M5 12h14' : 'M5 12h14'));
  if (manual) tools.append(button('Excluir ' + app.name, () => { deleting = app.id; $('#delete-name').textContent = app.name; $('#confirm-dialog').showModal(); }, 'M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13'));
  row.append(link, tools); return row;
}
function render() {
  document.documentElement.dataset.theme = state.settings.theme; $('#theme').value = state.settings.theme;
  $('#changes').textContent = `${state.changes} ${state.changes === 1 ? 'alteração' : 'alterações'} sem backup`;
  $('#backup-banner').hidden = !state.changes && !storageBlocked;
  if (storageBlocked) $('#changes').textContent += ' · armazenamento indisponível';
  $('#last-export').textContent = state.lastExportAt ? 'Última exportação: ' + date(state.lastExportAt) : 'Nenhum backup exportado';
  $('#last-backup').textContent = state.lastBackupAt ? 'Último backup usado: ' + date(state.lastBackupAt) : '';
  const query = $('#search').value.trim().toLocaleLowerCase('pt-BR');
  const matches = app => `${app.name} ${app.repo} ${app.manifest || ''}`.toLocaleLowerCase('pt-BR').includes(query);
  const apps = allApps().filter(matches), container = $('#apps'); container.replaceChildren();
  for (const group of L.groups(apps, state.hiddenIds)) {
    const section = element('section', 'group'); section.append(element('h3', '', group.name));
    const list = element('div', 'group-list'); group.primary.forEach(app => list.append(row(app))); section.append(list);
    if (group.variants.length) {
      const details = element('details'); details.append(element('summary', '', `Versões e testes (${group.variants.length})`));
      group.variants.forEach(app => details.append(row(app))); section.append(details);
    }
    container.append(section);
  }
  if (!container.childElementCount) container.append(element('p', 'empty', 'Nenhum app visível. Adicione um app ou consulte os ocultos.'));
  const hidden = apps.filter(a => state.hiddenIds.includes(L.identity(a))); $('#hidden-apps').replaceChildren(...hidden.map(a => row(a, true)));
  $('#hidden summary').textContent = `Ocultos (${hidden.length})`;
  const published = new Set(catalog.apps.map(a => a.repo));
  const repos = catalog.repositories.filter(r => !published.has(r.name) && r.name.toLowerCase().includes(query));
  $('#repos').replaceChildren(...repos.map(r => { const a = element('a', '', r.name); a.href = L.url(r.url || 'https://github.com/viniciusnevesdev/' + encodeURIComponent(r.name)); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }));
  $('#unpublished').hidden = !repos.length; $('#unpublished summary').textContent = `Sem publicação (${repos.length})`;
}
function openEditor(app) {
  editing = app?.id || null; $('#app-form').reset(); $('#form-error').textContent = '';
  for (const name of ['name', 'url', 'repo', 'icon']) $('#app-form').elements[name].value = app?.[name] || '';
  $('#editor-title').textContent = editing ? 'Editar app' : 'Adicionar app'; $('#editor').showModal();
}
$('#add').onclick = () => openEditor(); $('#menu').onclick = () => { $('#drawer-message').textContent = ''; $('#drawer').showModal(); };
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
$('#search').oninput = render;
$('#theme').onchange = e => { if (e.target.value !== state.settings.theme) change({settings: {theme: e.target.value}}); };
$('#backup-info').onclick = () => { $('#drawer').showModal(); };
$('#app-form').onsubmit = e => {
  e.preventDefault();
  try {
    const fields = Object.fromEntries(new FormData(e.target));
    const app = L.manual({...fields, id: editing || 'manual-' + crypto.randomUUID()});
    if (state.manual.some(a => a.id !== app.id && a.url === app.url)) throw Error('Este app já está na sua lista manual.');
    const old = state.manual.find(a => a.id === editing);
    if (!old || JSON.stringify(old) !== JSON.stringify(app)) change({manual: old ? state.manual.map(a => a.id === editing ? app : a) : [...state.manual, app]});
    $('#editor').close();
  } catch (error) { $('#form-error').textContent = error.message; }
};
$('#confirm-delete').onclick = () => { if (deleting) change({manual: state.manual.filter(a => a.id !== deleting), hiddenIds: state.hiddenIds.filter(id => id !== deleting)}); deleting = null; $('#confirm-dialog').close(); };
$('#export').onclick = async () => {
  $('#drawer-message').textContent = '';
  const snapshot = JSON.stringify(state), now = new Date().toISOString();
  const file = new File([JSON.stringify(L.backup(state, now), null, 2) + '\n'], `menu-backup-${now.slice(0,10)}.json`, {type: 'application/json'});
  try {
    if (navigator.canShare?.({files: [file]}) && navigator.share) await navigator.share({files: [file], title: 'Backup do Menu'});
    else {
      const href = URL.createObjectURL(file), a = element('a'); a.href = href; a.download = file.name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(href), 60000);
    }
    if (JSON.stringify(state) === snapshot) save(L.markBackup(state, now, true));
    else save({...state, lastExportAt: now});
    message('Exportação iniciada. Confira o arquivo em Arquivos.');
  } catch (error) { if (error.name !== 'AbortError') message('Não foi possível exportar. Tente novamente.'); }
};
$('#import').onclick = () => $('#file').click();
function preview() {
  if (!pendingImport) return;
  const mode = $('#import-mode').value, next = L.importBackup(state, pendingImport, mode);
  const added = next.manual.filter(a => !state.manual.some(old => old.url === a.url)).length;
  const removed = state.manual.filter(a => !next.manual.some(incoming => incoming.url === a.url)).length;
  const hides = next.hiddenIds.filter(id => !state.hiddenIds.includes(id)).length, shows = state.hiddenIds.filter(id => !next.hiddenIds.includes(id)).length;
  $('#preview-count').textContent = `${pendingImport.manual.length} apps manuais e ${pendingImport.hiddenIds.length} itens ocultos no arquivo.`;
  $('#preview-effect').textContent = `${added} apps adicionados, ${removed} removidos; ${hides} itens ocultados e ${shows} restaurados. ${mode === 'replace' ? 'Seus dados locais serão substituídos.' : 'Apps existentes serão preservados; duplicatas por URL serão ignoradas.'} Aparência: ${next.settings.theme === 'system' ? 'sistema' : next.settings.theme === 'light' ? 'clara' : 'escura'}.`;
}
$('#file').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw Error('Arquivo muito grande (máximo 5 MB).');
    const data = JSON.parse(await file.text()); L.validateBackup(data); pendingImport = data;
    $('#import-mode').value = 'merge'; preview(); $('#import-preview').showModal();
  } catch (error) { pendingImport = null; message('Backup recusado: ' + error.message); }
};
$('#import-mode').onchange = preview;
$('#confirm-import').onclick = () => {
  if (!pendingImport) return;
  save(L.importBackup(state, pendingImport, $('#import-mode').value)); pendingImport = null; $('#import-preview').close(); message('Backup importado neste dispositivo.');
};
async function refresh() {
  $('#refresh').disabled = true;
  try {
    const response = await fetch('./apps.json', {cache: 'no-store'}); if (!response.ok) throw Error();
    const next = L.catalog(await response.json()); catalog = next;
    try { localStorage.setItem(CATALOG_KEY, JSON.stringify(next)); } catch { /* Catalog is optional cache. */ }
    render(); $('#status').textContent = `${catalog.apps.length} apps automáticos${catalog.generatedAt ? ' · Catálogo: ' + date(catalog.generatedAt) : ''}${!navigator.onLine || response.headers.get('X-Menu-Offline') ? ' · Offline' : ''}`;
  } catch { $('#status').textContent = 'Sem conexão com o catálogo. Exibindo os dados disponíveis.'; render(); }
  finally { $('#refresh').disabled = false; }
}
$('#refresh').onclick = refresh;
try { const raw = localStorage.getItem(CATALOG_KEY); if (raw) catalog = L.catalog(JSON.parse(raw)); } catch { /* Fresh network will retry. */ }
render(); refresh();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', {updateViaCache: 'none'}).catch(() => {});
