import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.resolve(root,process.env.V7_DIST_DIR||'dist');
const htmlFile=path.join(dist,'index.html');
if(!fs.existsSync(htmlFile))throw Error('dist/index.html missing; run npm run build first');
const html=fs.readFileSync(htmlFile,'utf8');
if(!html.includes('<html')&&!html.includes('<!doctype'))throw Error('Invalid HTML entry');
const refs=[...html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+\.(?:js|css))["']/g)].map(m=>m[1]);
if(!refs.some(r=>r.endsWith('.js')))throw Error('No production JavaScript bundle referenced');
for(const ref of refs){
 const rel=ref.replace(/^\//,'');
 if(!fs.existsSync(path.join(dist,rel)))throw Error(`Referenced asset missing: ${ref}`);
}
const assets=path.join(dist,'assets');
const names=fs.existsSync(assets)?fs.readdirSync(assets):[];
const js=names.filter(n=>n.endsWith('.js'));
if(js.length===0)throw Error('No JS build outputs');
for(const name of js){
 const contents=fs.readFileSync(path.join(assets,name),'utf8');
 if(/SUPABASE_SERVICE_ROLE_KEY|YOUR_PUBLIC_PUBLISHABLE_KEY|sb_secret_[A-Za-z0-9_-]{8,}|(?:service_role\\s*[:=]\\s*["'][^"']{8,})/i.test(contents))throw Error(`Potential secret or placeholder in JS: ${name}`);
}
console.log('PASS: index.html, referenced JS/CSS, and emitted JS validated');
