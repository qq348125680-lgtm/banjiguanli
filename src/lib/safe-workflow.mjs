import {assertUuid} from './supabase-readonly-adapter.mjs';
export const allowedAttendance = Object.freeze(['出勤','迟到','缺勤','事假','病假']);
export function createSafeWorkflow(client) {
  if(!client?.auth?.getUser || typeof client.from!=='function' || typeof client.rpc!=='function') throw Error('需要 Supabase 客户端');
  async function user(){const {data,error}=await client.auth.getUser();if(error) throw error;if(!data?.user?.id)throw Error('请先登录');return data.user;}
  async function roster(classId){await user();assertUuid(classId);const {data,error}=await client.rpc('v7_cadre_roster',{p_class_id:classId});if(error)throw error;return data??[];}
  async function submit({classId,studentId,entryType,date,status,note=''}) {
    const u=await user();assertUuid(classId);assertUuid(studentId);
    if(entryType!=='考勤')throw Error('Alpha9 仅开放考勤提交，其他事项沿用旧版');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) || new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)throw Error('日期不合法');
    if(!allowedAttendance.includes(status))throw Error('考勤状态不合法');
    if(typeof note!=='string'||note.length>500)throw Error('说明不能超过500字');
    // Recheck live class membership before every submission, not just a stale UI roster.
    // The database trigger in the STAGING-only migration enforces this independently.
    const currentRoster=await roster(classId);
    if(!Array.isArray(currentRoster)||!currentRoster.some(s=>s.student_id===studentId))throw Error('当前学生已不在授权班级花名册中，请重新验证权限');
    const {data,error}=await client.from('cadre_submissions').insert({
      class_id:classId,student_id:studentId,submitted_by:u.id,entry_type:'考勤',occurred_on:date,
      details:{status,note},status:'待审核'
    }).select('id,class_id,student_id,status,created_at').single();
    if(error)throw error;return data;
  }
  // Read-only reconciliation after an interrupted write. RLS restricts result to
  // the requesting delegate's own submissions. No automatic second INSERT.
  async function verifySubmission({classId,studentId,date}){
    const u=await user();assertUuid(classId);assertUuid(studentId);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('核对日期不合法');
    const {data,error}=await client.from('cadre_submissions')
      .select('id,student_id,occurred_on,entry_type,status,details,created_at')
      .eq('class_id',classId).eq('submitted_by',u.id)
      .eq('student_id',studentId).eq('occurred_on',date).eq('entry_type','考勤')
      .order('created_at',{ascending:false}).limit(20);
    if(error)throw error;
    return (data??[]).filter(item=>item.student_id===studentId&&item.occurred_on===date&&item.entry_type==='考勤');
  }
  async function review(submissionId,action,note=''){
    await user();assertUuid(submissionId);
    if(!['approve','reject'].includes(action))throw Error('审核动作无效');
    if(typeof note!=='string'||note.length>500)throw Error('备注不能超过500字');
    if(action==='reject'&&!note.trim())throw Error('驳回必须说明原因');
    const {data,error}=await client.rpc('v7_review_attendance',{
      p_submission_id:submissionId,p_action:action,p_note:note.trim()
    });if(error)throw error;return data;
  }
  return Object.freeze({roster,submit,verifySubmission,review});
}
