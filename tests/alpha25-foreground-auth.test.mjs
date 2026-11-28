import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {shouldRevalidateForeground} from '../src/lib/snapshot-policy.mjs';
const good={visible:true,activeUserId:'account-a',renderedUserId:'account-a',inFlight:false,lastCheck:100_000,now:160_001};
test('foreground after threshold triggers class revalidation',()=>assert.equal(shouldRevalidateForeground(good),true));
test('background never invokes refresh',()=>assert.equal(shouldRevalidateForeground({...good,visible:false}),false));
test('account transition cannot refresh old account',()=>assert.equal(shouldRevalidateForeground({...good,renderedUserId:'account-b'}),false));
test('same user focus and visibility events are debounced',()=>assert.equal(shouldRevalidateForeground({...good,now:150_000}),false));
test('concurrent revalidation does not overlap',()=>assert.equal(shouldRevalidateForeground({...good,inFlight:true}),false));
test('missing identity cannot refresh',()=>assert.equal(shouldRevalidateForeground({...good,activeUserId:''}),false));
test('account switch mask is checked before unconfigured/login pages',()=>{
 const code=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const masked=code.indexOf('if(accountSnapshotPending)return');
 assert.ok(masked>0);
 assert.ok(masked<code.indexOf('if(!configured)return'));
 assert.ok(masked<code.indexOf('if(!user)return'));
});
test('foreground listeners are cleaned up',()=>{
 const code=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(code,/window\.removeEventListener\('focus',onForeground\)/);
 assert.match(code,/document\.removeEventListener\('visibilitychange',onForeground\)/);
});
