'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const L = require('../lib.js');
const app = {id:'manual-a',source:'manual',name:'Meu app',url:'https://example.com/',repo:'',icon:''};
const data = () => L.backup({...L.initial(),manual:[app],hiddenIds:['Repo:beta/manifest.json','manual-a']});
test('strict URL safety including credentials and executable schemes',()=>{
  for(const value of ['javascript:alert(1)','data:text/html,x','file:///tmp/a','https://user:pass@example.com','//example.com',null]) assert.throws(()=>L.url(value));
  assert.equal(L.url('https://example.com'), 'https://example.com/');
});
test('backup round trip, metadata, settings and full manual hidden state',()=>{
  const state = {...L.initial(),manual:[app],hiddenIds:['manual-a'],settings:{theme:'dark'},changes:5};
  const backup = JSON.parse(JSON.stringify(L.backup(state)));
  const result = L.importBackup(L.initial(),backup,'replace');
  assert.deepEqual(result.manual,state.manual); assert.deepEqual(result.hiddenIds,state.hiddenIds); assert.equal(result.changes,0); assert.equal(result.settings.theme,'dark'); assert.ok(result.lastBackupAt); assert.equal(result.lastExportAt,null);
});
test('invalid and duplicate imports reject without mutations',()=>{
  const state=L.initial(), before=JSON.stringify(state);
  for(const edit of [d=>d.version=1,d=>d.manual.push(app),d=>d.manual[0].url='javascript:alert(1)',d=>d.settings.theme='bad',d=>d.hiddenIds=[{}],d=>d.exportedAt='bad']) {
    const d=data();edit(d);assert.throws(()=>L.importBackup(state,d));assert.equal(JSON.stringify(state),before);
  }
});
test('merge is safe default, deduplicates URLs, replace removes existing',()=>{
  const state={...L.initial(),manual:[{...app,id:'existing'}, {...app,id:'other',url:'https://other.test/'}],hiddenIds:['old'],changes:9};
  assert.equal(L.importBackup(state,data()).manual.length,2);
  assert.deepEqual(L.importBackup(state,data()).hiddenIds,['old','Repo:beta/manifest.json','existing']);
  assert.equal(L.importBackup(state,data(),'replace').manual.length,1);
  assert.equal(state.changes,9);
});
test('meaningful mutations persist count, backup resets only explicitly',()=>{
  let s=L.initial(); for(let i=0;i<6;i++)s=L.mutate(s,{hiddenIds:[String(i)]});
  assert.equal(JSON.parse(JSON.stringify(s)).changes,6);L.groups([],s.hiddenIds);assert.equal(s.changes,6);
  assert.equal(L.markBackup(s,'2026-11-04T12:00:00Z',true).changes,0);
});
test('all valid original entries remain; archives fold and hidden groups disappear',()=>{
  const c=L.catalog(JSON.parse(fs.readFileSync('apps.json')));
  assert.ok(c.apps.some(a=>a.repo==='cronometro-oficial'));
  assert.ok(!c.apps.some(a=>['Alimentacao','Painel','supertext','To-limpo','Pwa-dev-agent','cronometro-apresentacao','Buscar-imagens'].includes(a.repo)));
  assert.match(fs.readFileSync('scripts/build-catalog.cjs','utf8'), /!r\.archived/);
  assert.ok(!c.apps.some(a=>a.url.includes('/Controle-financeiro/source/public/')));
  const apps=c.apps.filter(a=>a.repo==='cronometro-oficial'); const g=L.groups(apps,[])[0];
  assert.equal(apps.length,14); assert.equal(g.primary.length,1);assert.equal(g.variants.length,13);
  assert.equal(L.groups(apps,apps.map(L.identity)).length,0);
  assert.equal(L.groups(apps,apps.slice(1).map(L.identity)).length,1);
  assert.equal(L.variant({manifest:'icon-studio/manifest.webmanifest'}),false);
});
test('schema1 compatible and item identity survives name and URL changes',()=>{
  const a={repo:'x',name:'X',url:'https://example.com',manifest:'manifest.json'};
  assert.equal(L.catalog({schema:1,apps:[a]}).apps.length,1);
  assert.equal(L.identity(a),L.identity({...a,name:'new',url:'https://example.net/'}));
});
test('render uses DOM text, validates links, no HTML injection sinks or browser GitHub API',()=>{
  const src=fs.readFileSync('app.js','utf8'); assert.doesNotMatch(src,/innerHTML|insertAdjacentHTML|api\.github\.com/);assert.match(src,/link.href = L.url/);assert.match(src,/noopener noreferrer/);
  assert.equal(L.manual({...app,name:'<img src=x onerror=alert(1)>'}).name,'<img src=x onerror=alert(1)>');
});
test('merging a duplicate URL restores its hidden status on local ID, colliding IDs get remapped',()=>{
  const state={...L.initial(),manual:[{...app,id:'manual-local'}]};
  const incoming=L.backup({...L.initial(),manual:[{...app,id:'manual-other'},{...app,id:'manual-local',url:'https://new.test/'}],hiddenIds:['manual-other','manual-local']});
  const next=L.importBackup(state,incoming);
  assert.equal(next.manual.length,2);assert.equal(next.hiddenIds[0],'manual-local');assert.equal(next.hiddenIds[1],next.manual[1].id);assert.notEqual(next.manual[1].id,'manual-local');
});
test('root manifest appears before ordinary subapps while both stay visible',()=>{
  const items=[{repo:'R',name:'A',manifest:'icon-studio/manifest.json'},{repo:'R',name:'Z',manifest:'manifest.json'}];
  assert.equal(L.groups(items,[])[0].primary[0].name,'Z');
});

test('merge never falsely resets unsaved backup counter',()=>{
  const state={...L.initial(),manual:[app],changes:3,lastBackupAt:'2026-11-03T10:00:00Z'};
  const incoming=L.backup({...L.initial(),manual:[{...app,id:'manual-new',url:'https://other.example/' }]});
  const merged=L.importBackup(state,incoming,'merge');
  assert.equal(merged.changes,4); assert.equal(merged.lastBackupAt,state.lastBackupAt);
  assert.equal(merged.manual.length,2);
  const replaced=L.importBackup(state,incoming,'replace');
  assert.equal(replaced.changes,0); assert.equal(replaced.lastBackupAt,incoming.exportedAt);
});
