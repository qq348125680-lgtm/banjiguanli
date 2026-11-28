/** Local-only arithmetic on point rules already read from the owner's class.
 * Does NOT interpret threshold/converted_points or alter persisted rules/events.
 */
export function previewPointRule(rule,count=1,override=null){
 const times=Number(count);
 if(!Number.isSafeInteger(times)||times<1||times>20)throw Error('试算次数须为 1—20 的整数');
 const unit=override===null?Number(rule?.unit_points):Number(override);
 if(!Number.isFinite(unit)||Math.abs(unit)>1000)throw Error('分值未配置或超出试算范围');
 return {unit,times,total:Math.round(unit*times*100)/100,requiresThresholdReview:Number.isSafeInteger(Number(rule?.threshold))&&Number(rule.threshold)>1};
}
