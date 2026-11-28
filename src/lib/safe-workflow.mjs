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
    let currentRoster;
    try{currentRoster=await roster(classId)}
    catch(e){throw Object.assign(Error('提交前班级授权核对失败，尚未发起考勤写入；请检查网络后重新验证'),{code:'V7_PREFLIGHT_FAILED',cause:e})}
    if(!Array.isArray(currentRoster)||!currentRoster.some(s=>s.student_id===studentId))throw Error('当前学生已不在授权班级花名册中，请重新验证权限');
    // Persistent server history, not just this React tab's in-memory markers:
    // prevents accidental re-submit after page refresh / browser re-open.
    // Only the staging-only partial unique index handles two simultaneous tabs.
    let existing;
    try{existing=await verifySubmission({classId,studentId,date})}
    catch(e){throw Object.assign(Error('提交前已有申请核对失败，尚未发起写入；请先核对我的提交记录'),{code:'V7_PREFLIGHT_FAILED',cause:e})}
    if(existing.length)throw Object.assign(Error('该学生本日已有本人提交的考勤申请，请到我的提交记录核对，不能重复提交'),{code:'V7_ALREADY_SUBMITTED'});
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
  async function verifyReview({classId,submissionId}){
    await user();assertUuid(classId);assertUuid(submissionId);
    // RLS gives only the current class owner access to the review row.
    const {data,error}=await client.from('cadre_submissions')
      .select('id,class_id,status,reviewed_at,reviewed_by')
      .eq('class_id',classId).eq('id',submissionId).maybeSingle();
    if(error)throw error;
    if(!data||data.class_id!==classId||data.id!==submissionId)throw Error('无法核实该申请，请保持当前操作锁定');
    return data;
  }
  return Object.freeze({roster,submit,verifySubmission,review,verifyReview});
}
