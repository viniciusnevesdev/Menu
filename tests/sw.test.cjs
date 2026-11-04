const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');
function worker(fetchImpl=async()=>new Response('network')) {
  const handlers={},deleted=[],stored=new Map();const cache={addAll:async()=>{},put:async(k,v)=>stored.set(k,v),match:async k=>stored.get(k)};
  const self={location:{href:'https://test.local/Menu/sw.js'},addEventListener:(n,fn)=>handlers[n]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
  vm.runInNewContext(fs.readFileSync('sw.js','utf8'),{self,caches:{open:async()=>cache,keys:async()=>['other-app-v1','menu-pwas-v8','menu-pwas-v10','unrelated'],delete:async k=>deleted.push(k)},URL,Response,Headers,fetch:fetchImpl});
  return {handlers,deleted,stored};
}
test('activation only deletes owned obsolete cache prefix',async()=>{const w=worker();let p;w.handlers.activate({waitUntil:v=>p=v});await p;assert.deepEqual(w.deleted,['menu-pwas-v8']);});
test('own offline navigation/catalog fallback; other apps and external URLs untouched',async()=>{
  const w=worker(async()=>{throw Error('offline')});w.stored.set('https://test.local/Menu/index.html',new Response('shell'));w.stored.set('https://test.local/Menu/apps.json',new Response('{"apps":[]}'));
  for(const [url,mode,expected] of [['https://test.local/Menu/','navigate','shell'],['https://test.local/Menu/apps.json','cors','{"apps":[]}']]) {let p;w.handlers.fetch({request:{method:'GET',url,mode},respondWith:v=>p=v});const r=await p;assert.equal(await r.text(),expected);assert.equal(r.headers.get('X-Menu-Offline'),'1');}
  for(const url of ['https://external.test/a','https://test.local/Other/index.html','https://test.local/Menu/private.json']){let intercepted=false;w.handlers.fetch({request:{method:'GET',url,mode:'navigate'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);}
});
test('network-first catalog persists fresh response; HTTP errors fallback',async()=>{
  const w=worker();let p;w.handlers.fetch({request:{method:'GET',url:'https://test.local/Menu/apps.json',mode:'cors'},respondWith:v=>p=v});assert.equal(await (await p).text(),'network');assert.ok(w.stored.has('https://test.local/Menu/apps.json'));
});
