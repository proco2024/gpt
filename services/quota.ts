import {now} from "../db/schema";
export async function getQuota(db:D1Database,userId:string){
 const r=await db.prepare("SELECT char_limit,reserved_chars,committed_chars,period_start,period_end FROM quota_periods WHERE user_id=? ORDER BY period_start DESC LIMIT 1").bind(userId).first<any>();
 if(!r) throw new Error("QUOTA_PERIOD_NOT_FOUND");
 const used=r.reserved_chars+r.committed_chars;
 return {limit:r.char_limit,reserved:r.reserved_chars,committed:r.committed_chars,available:Math.max(0,r.char_limit-used),period_start:r.period_start,period_end:r.period_end};
}
export async function reserveQuota(db:D1Database,userId:string,jobId:string,chars:number,leaseSeconds=60){
 if(!Number.isInteger(chars)||chars<=0) throw new Error("INVALID_CHAR_COUNT");
 const q=await getQuota(db,userId);
 if(q.available<chars){const e=new Error("QUOTA_EXCEEDED");(e as any).details={remaining:q.available,required:chars};throw e;}
 const ledgerId=crypto.randomUUID(),lease=now()+leaseSeconds;
 await db.batch([
  db.prepare("UPDATE quota_periods SET reserved_chars=reserved_chars+? WHERE user_id=?").bind(chars,userId),
  db.prepare("INSERT INTO quota_ledger(id,user_id,job_id,reserved_chars,status,lease_expires_at) VALUES(?,?,?,?,?,?)").bind(ledgerId,userId,jobId,chars,"RESERVED",lease)
 ]);
 return {ledgerId,leaseExpiresAt:lease};
}
export async function commitQuota(db:D1Database,jobId:string){
 const l=await db.prepare("SELECT id,user_id,reserved_chars,status FROM quota_ledger WHERE job_id=?").bind(jobId).first<any>();
 if(!l) throw new Error("QUOTA_LEDGER_NOT_FOUND"); if(l.status==="COMMITTED") return; if(l.status==="REFUNDED") throw new Error("QUOTA_ALREADY_REFUNDED");
 await db.batch([
  db.prepare("UPDATE quota_periods SET reserved_chars=reserved_chars-?,committed_chars=committed_chars+? WHERE user_id=?").bind(l.reserved_chars,l.reserved_chars,l.user_id),
  db.prepare("UPDATE quota_ledger SET committed_chars=reserved_chars,status='COMMITTED' WHERE id=?").bind(l.id)
 ]);
}
export async function refundQuota(db:D1Database,jobId:string){
 const l=await db.prepare("SELECT id,user_id,reserved_chars,status FROM quota_ledger WHERE job_id=?").bind(jobId).first<any>();
 if(!l) throw new Error("QUOTA_LEDGER_NOT_FOUND"); if(l.status==="REFUNDED") return; if(l.status==="COMMITTED") throw new Error("QUOTA_ALREADY_COMMITTED");
 await db.batch([
  db.prepare("UPDATE quota_periods SET reserved_chars=reserved_chars-? WHERE user_id=?").bind(l.reserved_chars,l.user_id),
  db.prepare("UPDATE quota_ledger SET status='REFUNDED' WHERE id=?").bind(l.id)
 ]);
}