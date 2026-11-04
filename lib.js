/* Pure catalog and local backup rules; shared by browser and Node tests. */
(function (root) {
  'use strict';
  const url = value => {
    if (typeof value !== 'string' || value.length > 4096) throw Error('URL inválida.');
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw Error('Use uma URL http ou https, sem credenciais.');
    return parsed.href;
  };
  const text = (value, max = 180) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error('Texto inválido.');
    return value.trim();
  };
  const initial = () => ({manual: [], hiddenIds: [], settings: {theme: 'system'}, changes: 0, lastBackupAt: null, lastExportAt: null});
  const identity = app => app.id && app.source === 'manual' ? app.id : `${app.repo || ''}:${app.manifest || '@public:' + url(app.url)}`;
  const variant = app => /(^|\/)(vers[oõ]es|versions?|archives?|arquivos?|old|backups?|beta|areas-beta|clientes-beta|simple)(\/|$)/i.test(app.manifest || '');
  function manual(item) {
    if (!item || typeof item !== 'object') throw Error('App inválido.');
    return {id: text(item.id), source: 'manual', name: text(item.name), url: url(item.url), repo: item.repo ? text(item.repo) : '', icon: item.icon ? url(item.icon) : ''};
  }
  function validateBackup(data) {
    if (!data || data.format !== 'menu-pwa-backup' || data.version !== 2 || !Number.isFinite(Date.parse(data.exportedAt))) throw Error('Formato de backup inválido.');
    if (!Array.isArray(data.manual) || data.manual.length > 10000 || !Array.isArray(data.hiddenIds) || data.hiddenIds.length > 20000) throw Error('Lista de apps inválida.');
    const items = data.manual.map(manual);
    if (new Set(items.map(a => a.id)).size !== items.length || new Set(items.map(a => a.url)).size !== items.length) throw Error('O backup contém apps manuais duplicados.');
    const hiddenIds = [...new Set(data.hiddenIds.map(id => text(id, 4096)))];
    if (!data.settings || !['system', 'light', 'dark'].includes(data.settings.theme)) throw Error('Preferências inválidas.');
    return {manual: items, hiddenIds, settings: {theme: data.settings.theme}};
  }
  function backup(state, now = new Date().toISOString()) {
    const data = {format: 'menu-pwa-backup', version: 2, exportedAt: now, manual: state.manual, hiddenIds: state.hiddenIds, settings: state.settings};
    return {...data, ...validateBackup(data)};
  }
  function mutate(state, patch) { return {...state, ...patch, changes: state.changes + 1}; }
  function markBackup(state, now, exported = false) { return {...state, changes: 0, lastBackupAt: now, lastExportAt: exported ? now : state.lastExportAt}; }
  function importBackup(state, data, mode = 'merge', now = new Date().toISOString()) {
    const incoming = validateBackup(data);
    if (!['merge', 'replace'].includes(mode)) throw Error('Modo inválido.');
    let items = incoming.manual;
    const idMap = new Map();
    if (mode === 'merge') {
      items = state.manual.slice();
      for (const app of incoming.manual) {
        const existing = items.find(a => a.url === app.url);
        if (existing) { idMap.set(app.id, existing.id); continue; }
        let id = app.id;
        while (items.some(a => a.id === id)) id = 'manual-import-' + id;
        idMap.set(app.id, id);
        items.push({...app, id});
      }
    }
    const hidden = incoming.hiddenIds.map(id => idMap.get(id) || id);
    const merged = {...state, manual: items,
      hiddenIds: mode === 'merge' ? [...new Set([...state.hiddenIds, ...hidden])] : hidden,
      settings: mode === 'merge' ? state.settings : incoming.settings};
    if (mode === 'replace') return markBackup({...merged, lastExportAt: null}, data.exportedAt);
    // Mesclar cria um novo estado que NÃO está inteiramente protegido pelo arquivo importado.
    // Nunca zerar alterações pendentes nessa operação.
    const changed = JSON.stringify([merged.manual, merged.hiddenIds, merged.settings]) !==
      JSON.stringify([state.manual, state.hiddenIds, state.settings]);
    return {...merged, changes: state.changes + (changed ? 1 : 0)};
  }

  function catalog(data) {
    if (!data || !Array.isArray(data.apps)) throw Error('Catálogo inválido.');
    const apps = data.apps.map(a => { try { return {...a, name: text(a.name), repo: text(a.repo), url: url(a.url), source: a.source === 'cloudflare' ? 'cloudflare' : 'github', iconCandidates: Array.isArray(a.iconCandidates) ? a.iconCandidates : []}; } catch { return null; } }).filter(Boolean);
    const seen = new Set();
    return {...data, apps: apps.filter(a => { const id = identity(a); if (seen.has(id)) return false; seen.add(id); return true; }), repositories: (data.repositories || []).filter(r => r && !r.private && typeof r.name === 'string').filter(r => { try { if (r.url) url(r.url); return true; } catch { return false; } })};
  }
  function groups(apps, hiddenIds) {
    const hidden = new Set(hiddenIds), result = new Map();
    for (const app of apps) {
      if (hidden.has(identity(app))) continue;
      const key = app.repo || 'Meus apps';
      if (!result.has(key)) result.set(key, {name: key, primary: [], variants: []});
      result.get(key)[variant(app) ? 'variants' : 'primary'].push(app);
    }
    for (const group of result.values()) group.primary.sort((a,b) => Number((a.manifest || '').includes('/')) - Number((b.manifest || '').includes('/')) || a.name.localeCompare(b.name, 'pt-BR'));
    return [...result.values()].sort((a,b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  const api = {url, initial, identity, variant, manual, validateBackup, backup, mutate, markBackup, importBackup, catalog, groups};
  if (typeof module !== 'undefined') module.exports = api;
  else root.MenuLib = api;
})(globalThis);
