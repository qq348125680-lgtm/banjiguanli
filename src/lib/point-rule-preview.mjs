/** Local-only arithmetic on class-owned point rules, never a final discipline decision.
 * Threshold conversion may be nonlinear, so the total is always marked as provisional.
 */
export function previewPointRule(rule,count=1,override=/** @type {number|string|null} */ (null)){
 const times=Number(count);
 if(!Number.isSafeInteger(times)||times<1||times>20)throw Error('试算次数须为 1—20 的整数');
 const raw=override===null?rule?.unit_points:override;
 if(raw===null||raw===undefined||typeof raw==='string'&&!raw.trim())throw Error('请先配置或输入有效的试算分值');
 if(typeof raw==='boolean')throw Error('分值格式不合法');
 const unit=Number(raw);
 if(!Number.isFinite(unit)||Math.abs(unit)>1000)throw Error('分值未配置或超出试算范围');
 const threshold=rule?.threshold;
 const requiresThresholdReview=threshold!==null&&threshold!==undefined&&threshold!==''&&Number.isSafeInteger(Number(threshold))&&Number(threshold)>1;
 return {unit,times,total:Math.round(unit*times*100)/100,requiresThresholdReview};
}
