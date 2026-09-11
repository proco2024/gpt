export const now=()=>Math.floor(Date.now()/1000);
export async function ensureDevUser(db:D1Database){
 const userId="usr_test",start=now(),end=start+30*24*60*60;
 await db.prepare("INSERT OR IGNORE INTO users(id,email) VALUES(?,?)").bind(userId,"test@mrk.local").run();
 await db.prepare("INSERT OR IGNORE INTO subscriptions(id,user_id,plan_tier,status,char_limit,current_period_start,current_period_end) VALUES(?,?,?,?,?,?,?)").bind("sub_test",userId,"PRO","ACTIVE",100000,start,end).run();
 await db.prepare("INSERT OR IGNORE INTO installations(id,user_id,site_url) VALUES(?,?,?)").bind("inst_test",userId,"http://localhost/mrk-test").run();
 await db.prepare("INSERT OR IGNORE INTO quota_periods(id,user_id,period_start,period_end,char_limit) VALUES(?,?,?,?,?)").bind("qperiod_test",userId,start,end,100000).run();
 return {userId};
}