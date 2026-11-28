import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const vite=path.join(root,'node_modules','vite','bin','vite.js');
if(!fs.existsSync(vite))throw Error('Vite not installed. Run npm install first.');
const port=Number(process.env.V7_SMOKE_PORT||4179);
const origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,[vite,'preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,stdio:'ignore'});
let done=false;
const stop=()=>{if(!done){done=true;child.kill('SIGTERM')}};
process.on('SIGINT',stop);
try{
 let html='';let ready=false;
 for(let i=0;i<40;i++){
  if(child.exitCode!==null)throw Error(`Preview process exited: ${child.exitCode}`);
  try{const r=await fetch(origin+'/',{signal:AbortSignal.timeout(1500)});if(r.ok){html=await r.text();ready=true;break}}catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 if(!ready)throw Error('Preview not reachable');
 const hit=html.match(/(?:src|href)=["'](\/assets\/[^"']+\.js)["']/);
 if(!hit)throw Error('No production JS bundle in served HTML');
 const js=await fetch(origin+hit[1],{signal:AbortSignal.timeout(4000)});
 if(!js.ok||!(await js.text()).length)throw Error('Preview JS asset inaccessible');
 console.log('PASS: preview serves index.html and compiled JavaScript asset');
}finally{stop()}
