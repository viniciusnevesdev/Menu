// Optional: PLAYWRIGHT_MODULE=/path/to/playwright node tests/browser-smoke.cjs
'use strict';
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname,'..');
const autoApps = JSON.parse(fs.readFileSync(path.join(root,'apps.json'))).apps;
const appCount = autoApps.length;
const primaryCount = require('../lib.js').groups(autoApps,[]).reduce((n,g)=>n+g.primary.length,0);
const types = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png'};
(async()=>{
  const server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname.replace(/^\/Menu\//,'') || 'index.html';
    if (!['index.html','app.js','lib.js','styles.css','apps.json','sw.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','apple-touch-icon.png'].includes(name) && !/^assets\/icons\/[a-z0-9.]+\.svg$/.test(name)) {res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',types[path.extname(name)]);res.end(fs.readFileSync(path.join(root,name)));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH || '/home/vinicius/.cache/puppeteer/chrome/linux-156.0.8078.47/chrome-linux64/chrome',headless:true,args:['--no-sandbox']});
    const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,acceptDownloads:true});
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const origin=`http://127.0.0.1:${server.address().port}`;
    await context.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
    await page.addInitScript(()=>caches.open('another-app-v42'));
    await page.goto(origin+'/Menu/');await page.waitForFunction(n=>document.querySelector('#status').textContent.includes(n+' apps'),appCount);
    await page.evaluate(()=>navigator.serviceWorker.ready);
    assert.equal(await page.locator('#apps .app-row:visible').count(),primaryCount);
    assert.equal(await page.locator('#apps .app-row').count(),appCount);
    assert.ok((await page.evaluate(()=>caches.keys())).includes('another-app-v42'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true);
    const chrono=page.locator('.group').filter({has:page.getByRole('heading',{name:'cronometro-oficial',exact:true})});
    assert.equal(await chrono.locator('.app-row:visible').count(),1);
    await chrono.locator('summary').click();assert.equal(await chrono.locator('.app-row:visible').count(),14);
    for(let i=0;i<14;i++){
      const row=chrono.locator('.app-row').first(); if(!await row.isVisible()) await chrono.locator('summary').click();
      await row.getByRole('button',{name:/^Ocultar /}).click();
    }
    assert.equal(await chrono.count(),0);assert.equal(await page.locator('#changes').textContent(),'14 alterações sem backup');
    await page.locator('#hidden summary').click();await page.locator('#hidden-apps button').first().click();assert.equal(await chrono.count(),1);
    await page.getByRole('button',{name:'Adicionar app',exact:true}).click();
    await page.locator('[name=name]').fill('<Teste local>');await page.locator('[name=url]').fill('https://local.example/');await page.getByRole('button',{name:'Salvar app',exact:true}).click();
    assert.equal(await page.locator('#apps').getByText('<Teste local>',{exact:true}).count(),1);
    const manual=page.locator('.app-row').filter({hasText:'<Teste local>'});
    await manual.getByRole('button',{name:'Editar <Teste local>',exact:true}).click();await page.locator('[name=name]').fill('Editado');await page.getByRole('button',{name:'Salvar app',exact:true}).click();
    await page.reload();await page.waitForFunction(n=>document.querySelector('#status').textContent.includes(n+' apps'),appCount);
    assert.equal(await page.locator('#apps').getByText('Editado',{exact:true}).count(),1);
    const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('menu-pwa-local-v2')));
    assert.equal((await read()).changes,17);
    await page.getByRole('button',{name:'Abrir menu'}).click();
    // Cancellation never marks a backup. Successful share does.
    await page.evaluate(()=>{navigator.canShare=()=>true;navigator.share=async()=>{throw new DOMException('Cancel','AbortError');};});
    await page.getByRole('button',{name:'Exportar backup JSON'}).click();assert.equal((await read()).changes,17);
    await page.evaluate(()=>navigator.share=async()=>{});await page.getByRole('button',{name:'Exportar backup JSON'}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('menu-pwa-local-v2')).changes===0);
    assert.ok((await read()).lastExportAt);
    // Invalid import and preview cancellation leave the exact stored state untouched.
    const before=JSON.stringify(await read());
    await page.locator('#file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format":"bad"}')});assert.equal(JSON.stringify(await read()),before);
    const backup=await page.evaluate(()=>MenuLib.backup({...MenuLib.initial(),manual:[{id:'manual-imported',name:'Importado',url:'https://import.example/',repo:'',icon:''}]}));
    await page.locator('#file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
    assert.equal(JSON.stringify(await read()),before);await page.locator('#import-preview [data-close]').click();assert.equal(JSON.stringify(await read()),before);
    await page.locator('#file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('#confirm-import').click();assert.equal((await read()).manual.length,2);assert.equal((await read()).changes,1);
    await page.getByRole('button',{name:'Fechar menu',exact:true}).click();
    await page.getByRole('button',{name:'Excluir Editado',exact:true}).click();await page.locator('#confirm-dialog [data-close]').click();assert.equal((await read()).manual.length,2);
    await page.getByRole('button',{name:'Excluir Editado',exact:true}).click();await page.locator('#confirm-delete').click();assert.equal((await read()).manual.length,1);
    await page.getByRole('button',{name:'Abrir menu'}).click();await page.evaluate(()=>{navigator.canShare=()=>false;});
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar backup JSON'}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/^menu-backup-/);await download.cancel();assert.equal((await read()).changes,0);
    await page.getByRole('button',{name:'Fechar menu',exact:true}).click();
    await context.setOffline(true);await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Offline'));assert.equal(await page.locator('#apps .app-row').count(),appCount - 12);
    assert.equal((await read()).manual.length,1);assert.deepEqual(errors,[]);
    console.log('Browser smoke passed: mobile layout, dynamic catalog, folding, hide/restore, CRUD, counter, reload, share cancel/success, download, import preview/merge, foreign cache safety, offline /Menu/.');
  } finally {if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
