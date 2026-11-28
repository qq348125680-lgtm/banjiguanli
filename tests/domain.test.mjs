import test from 'node:test';import assert from 'node:assert/strict';
import {displayError,sanitizeList,statusTone,dateToday,isReady,attendanceStatuses} from '../src/lib/domain.mjs';
test('safe error mapping',()=>{assert.match(displayError({code:'42501'}),/没有权限/);assert.match(displayError({code:'23505'}),/冲突/);assert.match(displayError({code:'PGRST202'}),/尚未安装/)});
test('minimal roster view',()=>{assert.deepEqual(sanitizeList([{student_id:'a',student_no:'01',student_name:'测试',id_card:'sensitive',phone:'123'}]),[{id:'a',student_no:'01',name:'测试'}])});
test('status and config',()=>{assert.equal(statusTone('已通过'),'good');assert.equal(statusTone('已驳回'),'bad');assert.equal(statusTone('待审核'),'pending');assert.equal(isReady({url:'x',key:'y'}),true);assert.equal(isReady({url:'',key:'y'}),false);assert.ok(attendanceStatuses.includes('迟到'));assert.match(dateToday(),/^\d{4}-\d{2}-\d{2}$/)});
