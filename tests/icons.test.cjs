const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const root=path.join(__dirname,'..');
const library={
'eye.svg':'c29bea7e806aa9174f359c050db3d7c92337157c30ca9a6853fe3b2efe84b82b',
'eye.slash.svg':'1236e442d0b090ace98b97b2ac4c29bc776da7b20163f4fd01c8a4a6077bc961',
'chevron.down.svg':'b4751f3ffb936cd74647cd35fbdafcb050a1967bf5bf33318f3b3ea39c93893f',
'plus.svg':'be67f6a7e0dc8cc945e2b418b2e0a04297efdf05ca5b73f8a435b695b4973c6e'
};
test('SVG controls use byte-exact official MMU library files',()=>{
 for(const [name,expected] of Object.entries(library)){
  const bytes=fs.readFileSync(path.join(root,'assets','icons',name));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expected);
 }
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.doesNotMatch(html,/<svg\b/i);
 assert.doesNotMatch(js,/createElementNS|setAttribute\(['"]d['"]/);
 assert.match(js,/hidden \? 'eye' : 'eye.slash'/);
 assert.match(js,/setSummary\(summary/);
 const css=fs.readFileSync(path.join(root,'styles.css'),'utf8');
 assert.match(css,/summary::-webkit-details-marker\{display:none\}/);
 for(const token of ['--color-danger:#E22400','--color-success:#34C759','--color-warning:#FFB501','--color-info:#0189FB','--action-add:#30BCFF'])assert.ok(css.includes(token));
});
