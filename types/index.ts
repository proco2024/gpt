export type Env={DB:D1Database;MRK_ENV:string;DEV_TOKEN:string};
export type JobStatus="QUEUED"|"CLAIMED"|"AUTOMATING"|"UPLOADING"|"READY"|"FAILED"|"TIMED_OUT";