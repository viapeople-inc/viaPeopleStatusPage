export function publicWindows(value){
 if(!value||!Array.isArray(value.windows)||value.windows.length>100)throw Error('Invalid maintenance feed');
 return value.windows.map(w=>{
  if(!w||typeof w.id!=='string'||!/^[0-9a-f-]{36}$/i.test(w.id)||typeof w.title!=='string'||w.title.length>100||typeof w.message!=='string'||w.message.length>500||!Number.isFinite(Date.parse(w.start))||!Number.isFinite(Date.parse(w.end))||Date.parse(w.end)<=Date.parse(w.start)||!Array.isArray(w.components)||!w.components.length||w.components.some(c=>!['access','performance'].includes(c))||!['none','interruption'].includes(w.impact)||typeof w.canceled!=='boolean')throw Error('Invalid maintenance window');
  return {id:w.id,title:w.title,message:w.message,start:w.start,end:w.end,components:w.components,impact:w.impact,canceled:w.canceled};
 });
}
export function maintenanceState(windows,snapshot,previous={},available=true,now=new Date()){
 const recent=Number.isFinite(Date.parse(previous.generatedAt))&&+now-Date.parse(previous.generatedAt)>=45000&&+now-Date.parse(previous.generatedAt)<180000;
 return windows.map(w=>{
  const old=previous.maintenance?.find(o=>o.id===w.id&&o.start===w.start&&o.end===w.end);
  let phase=w.canceled?'canceled':+now<Date.parse(w.start)?'scheduled':+now<Date.parse(w.end)?'in_progress':'verifying';
  let recoveryCount=0;
  if(phase==='verifying'){
   const healthy=w.components.every(id=>snapshot.components.find(c=>c.id===id)?.status==='operational');
   if(old?.phase==='completed')phase='completed';
   else if(available&&healthy){recoveryCount=(recent?old?.recoveryCount||0:0)+1;if(recoveryCount>=2)phase='completed';}
   else phase='overrun';
  }
  // A failed schedule read cannot confirm completion or cancellation.
  return {...w,phase,recoveryCount,scheduleVerified:available};
 });
}
export async function attachMaintenance(snapshot,previous={},fetcher=fetch,now=()=>new Date(),url=process.env.MAINTENANCE_FEED_URL){
 if(!url)return {...snapshot,maintenance:[],maintenanceFeedAvailable:true};
 let windows,available=true;
 try{const r=await fetcher(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const body=await r.json();const age=+now()-Date.parse(body.generatedAt);if(!Number.isFinite(age)||age< -60000||age>180000)throw Error();windows=publicWindows(body);}
 catch{available=false;try{windows=publicWindows({windows:previous.maintenance||[]});}catch{windows=[];}}
 return {...snapshot,maintenance:maintenanceState(windows,snapshot,previous,available,now()),maintenanceFeedAvailable:available};
}
