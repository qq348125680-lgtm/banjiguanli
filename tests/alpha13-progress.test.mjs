import test from 'node:test';
import assert from 'node:assert/strict';
import {outstandingStudents,nextOutstanding,markSubmissionConfirmed} from '../src/lib/entry-progress.mjs';
const roster=[{id:'a',name:'甲'},{id:'b',name:'乙'},{id:'c',name:'丙'}];
test('success-only session progress does not modify server attendance',()=>{assert.deepEqual(outstandingStudents(roster,['a']).map(x=>x.id),['b','c']);assert.equal(roster.length,3)});
test('next unresolved moves forward then wraps',()=>{assert.equal(nextOutstanding(roster,['a'],'a'),'b');assert.equal(nextOutstanding(roster,['a','b'],'c'),'c');assert.equal(nextOutstanding(roster,['a','b','c'],'c'),'')});
test('confirmed list is idempotent',()=>assert.deepEqual(markSubmissionConfirmed(['a'],'a'),['a']));
test('stale or missing roster degrades safely',()=>{assert.deepEqual(outstandingStudents(null,['a']),[]);assert.equal(nextOutstanding([],[]),'')});
