import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAuthBootstrapGate} from '../src/lib/auth-bootstrap.mjs';

test('initial getUser result can initialize account when no auth event arrived',()=>{
 const gate=createAuthBootstrapGate();
 assert.equal(gate.canApplyBootstrap(),true);
});
test('login event blocks a late stale getUser result',()=>{
 const gate=createAuthBootstrapGate();
 gate.onAuthEvent();
 assert.equal(gate.canApplyBootstrap(),false);
});
test('signout event blocks an earlier stale getUser result',()=>{
 const gate=createAuthBootstrapGate();
 gate.onAuthEvent();
 assert.equal(gate.canApplyBootstrap(),false);
});
test('disposed mount must not write state',()=>{
 const gate=createAuthBootstrapGate();
 gate.dispose();
 assert.equal(gate.isActive(),false);
 assert.equal(gate.canApplyBootstrap(),false);
 gate.onAuthEvent();
 assert.equal(gate.canApplyBootstrap(),false);
});
test('React auth bootstrap observes event before accepting getUser result',()=>{
 const source=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 assert.match(source,/createAuthBootstrapGate\(\)/);
 assert.match(source,/gate\.onAuthEvent\(\)/);
 assert.match(source,/if\(gate\.canApplyBootstrap\(\)\)setUser/);
 assert.match(source,/gate\.dispose\(\);subscription\.unsubscribe\(\)/);
});
