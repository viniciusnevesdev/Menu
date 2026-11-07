'use strict';
const fs = require('node:fs');
const {url, identity} = require('../lib.js');
module.exports = async function build({github, context}) {
  const owner = context.repo.owner, previous = JSON.parse(fs.readFileSync('apps.json', 'utf8'));
  const repos = [];
  for (let page = 1; ; page++) {
    const {data} = await github.rest.repos.listForUser({username: owner, type: 'owner', per_page: 100, page});
    repos.push(...data.filter(r => !r.private && r.visibility !== 'private' && !r.archived && r.name !== context.repo.repo && r.name !== 'Buscar-imagens'));
    if (data.length < 100) break;
  }
  const apps = [], failures = [], repositories = repos.map(r => ({name: r.name, url: `https://github.com/${owner}/${encodeURIComponent(r.name)}`, hasPages: !!r.has_pages}));
  // Only public, enumerated repos are allowed to contribute names, including failures.
  const publicRepos = new Set(repos.map(r => r.name));
  const retain = (repo, path) => apps.push(...previous.apps.filter(a => a.repo === repo && a.source !== 'cloudflare' && (!path || a.manifest === path)));
  for (const repo of repos.filter(r => r.has_pages)) {
    try {
      const {data: tree} = await github.rest.git.getTree({owner, repo: repo.name, tree_sha: repo.default_branch, recursive: 'true'});
      if (tree.truncated) throw Error('incomplete tree');
      const hasRootManifest = tree.tree.some(f => f.type === 'blob' && /^(manifest\.(webmanifest|json)|site\.webmanifest)$/i.test(f.path));
      for (const file of tree.tree.filter(f => f.type === 'blob' && /^(manifest\.(webmanifest|json)|site\.webmanifest)$/i.test(f.path.split('/').pop()))) {
        // Código-fonte de build não é um segundo PWA quando já existe manifesto publicado na raiz.
        if (hasRootManifest && /^(source|src)\/public\/manifest\.(webmanifest|json)$/i.test(file.path)) continue;
        try {
          const {data} = await github.rest.repos.getContent({owner, repo: repo.name, path: file.path, ref: repo.default_branch});
          if (!data.content) throw Error('missing content');
          const manifest = JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
          if (!['standalone', 'minimal-ui', 'fullscreen'].includes(manifest.display) || !(manifest.name || manifest.short_name)) continue;
          const dir = file.path.split('/').slice(0,-1).map(encodeURIComponent).join('/');
          const base = `https://${owner}.github.io/${encodeURIComponent(repo.name)}/${dir ? dir + '/' : ''}`;
          const candidates = (Array.isArray(manifest.icons) ? manifest.icons : []).filter(i => i && typeof i.src === 'string').sort((a,b) => {
            const score = i => /512/.test(i.sizes) ? 4 : /192/.test(i.sizes) ? 3 : /180/.test(i.sizes) ? 2 : 0;
            return score(b)-score(a);
          }).map(i => { try { return url(new URL(i.src, base).href); } catch { return null; } }).filter(Boolean);
          apps.push({name: manifest.short_name || manifest.name, repo: repo.name, manifest: file.path, url: url(new URL(manifest.start_url || './', base).href), icon: candidates[0] || '', iconCandidates: [...new Set(candidates)], source: 'github'});
        } catch {
          failures.push({repo: repo.name, manifest: file.path, reason: 'manifest-unavailable'}); retain(repo.name, file.path);
        }
      }
    } catch { failures.push({repo: repo.name, stage: 'tree', reason: 'tree-unavailable'}); retain(repo.name); }
  }
  for (const entry of JSON.parse(fs.readFileSync('public-cloudflare-apps.json', 'utf8')).apps) {
    // Registry is deliberately opt-in and must link to a currently public repo.
    if (!publicRepos.has(entry.repo)) continue;
    const href = url(entry.url);
    if (new URL(href).protocol !== 'https:' || !new URL(href).hostname.endsWith('.pages.dev')) throw Error('Invalid public Cloudflare registry');
    if (!apps.some(a => a.url === href || a.repo === entry.repo)) apps.push({...entry, url: href, source: 'cloudflare'});
  }
  const seen = new Set();
  const result = {schema: 2, generatedAt: new Date().toISOString(), apps: apps.filter(a => {const id = identity(a); if (seen.has(id)) return false; seen.add(id); return true;}).sort((a,b) => a.repo.localeCompare(b.repo,'pt-BR') || (a.manifest || '').localeCompare(b.manifest || '')), repositories, failures};
  fs.writeFileSync('apps.json', JSON.stringify(result, null, 2) + '\n');
  return result;
};
