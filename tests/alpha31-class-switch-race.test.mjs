import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {invalidateSelectedClass} from '../src/lib/authorization-race.mjs';

test('a manual class switch invalidates a pending authorization response', () => {
 const auth={current:4}, data={current:10};
 const pendingToken=auth.current;
 const pendingData=data.current;
 const next=invalidateSelectedClass(auth,data);
 assert.deepEqual(next,{authorization:5,data:11});
 assert.notEqual(pendingToken,auth.current);
 assert.notEqual(pendingData,data.current);
});

test('a late response from a previous class can no longer pass the epoch check', async () => {
 const auth={current:0},data={current:0};
 const token=++auth.current;
 let release;
 const deferred=new Promise(resolve=>{release=resolve});
 const response=deferred.then(()=>token===auth.current?'apply':'ignore');
 invalidateSelectedClass(auth,data);
 release();
 assert.equal(await response,'ignore');
});

test('repeated class switches invalidate every earlier response',()=>{
 const auth={current:0},data={current:0};
 const tokens=[];
 for(let i=0;i<3;i++){tokens.push(++auth.current);invalidateSelectedClass(auth,data)}
 for(const token of tokens)assert.notEqual(token,auth.current);
});

test('malformed request refs are not silently accepted',()=>{
 assert.throws(()=>invalidateSelectedClass({current:'0'},{current:0}),/不合法/);
});

test('class selection invalidates auth refresh and hides pending verification mask',()=>{
 const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/onChange=\{e=>\{invalidateSelectedClass\(authorizationSeq,requestSeq\);setAuthorizationChecking\(false\);/);
 assert.match(app,/if\(sequence!==authorizationSeq\.current\|\|activeAccountId\.current!==requestedUser\)return;/);
});

test('new account resets focus revalidation debounce',()=>{
 const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(app,/activeAccountId\.current=nextAccountId;\s*foregroundCheckRef\.current\.lastCheck=0;/);
});
