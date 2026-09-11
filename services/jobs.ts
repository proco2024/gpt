import {now} from "../db/schema"; import {commitQuota,refundQuota,reserveQuota} from "./quota";
export async function createJob(db:D1Database,i:{userId:string;installationId?:string;idempotencyKey:string;text:string;voice:string}){
 const old=await db.prepare("SELECT id,status,char_count FROM jobs WHERE user_id=? AND idempotency_key=?").bind(i.userId,i.idempotencyKey).first<any>();
 if(old) return {existing:true,job:old};
 const chars=Array.from(i.text).length;if(!chars) throw new Error("EMPTY_TEXT");
 const id=`job_${crypto.randomUUID().replaceAll("-","").slice(0,16)}`;
 await reserveQuota(db,i.userId,id,chars);
 try{await db.prepare("INSERT INTO jobs(id,user_id,installation_id,idempotency_key,status,text_payload,target_voice,char_count) VALUES(?,?,?,?,?,?,?,?)").bind(id,i.userId,i.installationId??null,i.idempotencyKey,"QUEUED",i.text,i.voice,chars).run();}
 catch(e){await refundQuota(db,id);throw e;}
 return {existing:false,job:{id,status:"QUEUED",char_count:chars}};
}
export async function claimJob(db:D1Database,browserId:string){
 const j=await db.prepare("SELECT * FROM jobs WHERE status='QUEUED' AND (browser_id IS NULL OR browser_id=?) ORDER BY created_at ASC LIMIT 1").bind(browserId).first<any>();if(!j)return null;
 const r=await db.prepare("UPDATE jobs SET status='CLAIMED',browser_id=?,last_heartbeat_at=?,updated_at=? WHERE id=? AND status='QUEUED'").bind(browserId,now(),now(),j.id).run();if(r.meta.changes!==1)return null;
 return db.prepare("SELECT * FROM jobs WHERE id=?").bind(j.id).first();
}
export async function heartbeat(db:D1Database,id:string,browserId:string,status:string){
 if(!["CLAIMED","AUTOMATING","UPLOADING"].includes(status))throw new Error("INVALID_JOB_STATUS");
 const r=await db.prepare("UPDATE jobs SET status=?,last_heartbeat_at=?,updated_at=? WHERE id=? AND browser_id=? AND status NOT IN ('READY','FAILED','TIMED_OUT')").bind(status,now(),now(),id,browserId).run();if(r.meta.changes!==1)throw new Error("JOB_NOT_OWNED");
}
export async function completeJob(db:D1Database,id:string,browserId:string,i:any){
 const r=await db.prepare("UPDATE jobs SET status='READY',storage_object_key=?,audio_duration_sec=?,audio_sha256=?,updated_at=? WHERE id=? AND browser_id=? AND status IN ('CLAIMED','AUTOMATING','UPLOADING')").bind(i.objectKey??null,i.durationSec??null,i.sha256??null,now(),id,browserId).run();if(r.meta.changes!==1)throw new Error("JOB_NOT_COMPLETABLE");await commitQuota(db,id);
}
export async function failJob(db:D1Database,id:string,browserId:string|null,code:string){
 const r=await db.prepare("UPDATE jobs SET status='FAILED',error_code=?,updated_at=? WHERE id=? AND status NOT IN ('READY','FAILED') AND (? IS NULL OR browser_id=?)").bind(code,now(),id,browserId,browserId).run();if(r.meta.changes!==1)throw new Error("JOB_NOT_FAILABLE");await refundQuota(db,id);
}