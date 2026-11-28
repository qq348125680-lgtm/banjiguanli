import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(tsx?|mjs)$/.test(e.name))files.push(p)}}walk(path.join(root,'src'));
let count=0;let errors=[];
for(const f of files){const code=fs.readFileSync(f,'utf8');for(const match of code.matchAll(/\bfrom\s*['"](\.[^'"]+)['"]/g)){let found=false;const base=path.resolve(path.dirname(f),match[1]);for(const ext of ['', '.ts','.tsx','.mjs','.js','/index.ts','/index.tsx'])if(fs.existsSync(base+ext)){found=true;break}if(!found)errors.push(path.relative(root,f)+': '+match[1]);count++}}
console.log(`Local source imports checked: ${count}.`);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1}else console.log('PASS: local module paths exist. NOTE: dependencies and TS types are NOT validated.');
