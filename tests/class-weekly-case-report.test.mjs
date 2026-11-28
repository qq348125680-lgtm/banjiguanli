import test from 'node:test';
import assert from 'node:assert/strict';
import {weekMonday,weeklyDates,verifyWeeklyRows,buildWeeklyReportText,WEEKLY_ACTIONS} from '../src/lib/class-weekly-case-report.mjs';
import {CASE_KINDS} from '../src/lib/event-case-api.mjs';
const good=[
 {metric:'created',item:'家校沟通',amount:'2'},
 {metric:'created',item:'考勤',amount:'1'},
 {metric:'action',item:'创建',amount:'3'},
 {metric:'action',item:'反馈',amount:'2'},
 {metric:'action',item:'催办',amount:'1'},
 {metric:'action',item:'结案',amount:'1'},
 {metric:'closed',item:'家校沟通',amount:'1'},
 {metric:'action',item:'退回',amount:'1'}
];
test('学校周一日期兼容星期日跨年、闰年与不同时区',()=>{
 assert.equal(weekMonday('2026-11-29'),'2026-11-23');
 assert.equal(weekMonday('2026-11-30'),'2026-11-30');
 assert.equal(weekMonday('2027-01-03'),'2026-12-28');
 assert.equal(weekMonday('2028-02-29'),'2028-02-28');
 assert.deepEqual(weeklyDates('2026-12-28'),{start:'2026-12-28',end:'2027-01-03',endExclusive:'2027-01-04'});
 assert.throws(()=>weeklyDates('2026-11-29'),/星期一/);
 assert.throws(()=>weekMonday('2026-02-29'));
});
test('验证周报：按独立发生时间统计创建、反馈、结案与家校跟进',()=>{
 const stats=verifyWeeklyRows(good);
 assert.equal(stats.createdTotal,3);
 assert.equal(stats.closedTotal,1);
 assert.equal(stats.reviewCount,2);
 assert.equal(stats.nudgeCount,1);
 assert.equal(stats.reopenCount,1);
 assert.equal(stats.familyCreated,2);
 assert.equal(stats.familyClosed,1);
 assert.equal(stats.created['其他'],0);
 assert.equal(stats.actions['指派'],0);
 assert.deepEqual(WEEKLY_ACTIONS.includes('催办'),true);
 assert.equal(CASE_KINDS.includes('家校沟通'),true);
});
test('后端失败、异常类型、重复分类与不同口径应拒绝生成文字',()=>{
 for(const bad of [
  null,undefined,
  [{metric:'created',item:'考勤',amount:2}],
  [{metric:'action',item:'创建',amount:1}],
  [...good,{metric:'created',item:'家校沟通',amount:'2'}],
  [...good,{metric:'action',item:'创建',amount:'4'}],
  [...good,{metric:'closed',item:'家校沟通',amount:2}],
  [...good,{metric:'created',item:'陌生事件类别',amount:1}],
  [...good,{metric:'action',item:'隐藏操作',amount:1}],
  [...good,{metric:'action',item:'转派',amount:-1}],
  [...good,{metric:'action',item:'转派',amount:'1.5'}],
  [...good,{metric:'action',item:'转派',amount:'Infinity'}]
 ])assert.throws(()=>verifyWeeklyRows(bad));
 assert.equal(verifyWeeklyRows([]).createdTotal,0);
});
test('报表可以复制和下载文本，不带真实学生姓名或电话',()=>{
 const stats=verifyWeeklyRows(good);
 const report=buildWeeklyReportText('2026级多媒体制作2班','2026-11-23',stats);
 for(const phrase of ['2026级多媒体制作2班','2026-11-23 至 2026-11-29','本周新建工单：3 件','本周结案操作：1 次','家校沟通：2 件','新建家校沟通跟进工单：2 件','结案为操作次数'])assert.ok(report.includes(phrase),phrase);
 assert.doesNotMatch(report,/13800000001|家长电话|虚构学生张三|联系电话：\d+/);
 assert.throws(()=>buildWeeklyReportText('', '2026-11-23',stats),/班级名称/);
 assert.throws(()=>buildWeeklyReportText('班级','2026-11-29',stats),/星期一/);
 assert.throws(()=>buildWeeklyReportText('班级','2026-11-23',null),/尚未完成/);
});
