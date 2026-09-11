import {Hono} from "hono";import {cors} from "hono/cors";import type {Env} from "./types";import {testRoutes} from "./routes/test";import {jobRoutes} from "./routes/jobs";import {getQuota} from "./services/quota";
const app=new Hono<{Bindings:Env}>();
app.use("*",cors({origin:"*",allowHeaders:["Content-Type","Authorization","Idempotency-Key"],allowMethods:["GET","POST","OPTIONS"]}));
app.use("/api/v1/*",async(c,next)=>{if(c.req.header("Authorization")!==`Bearer ${c.env.DEV_TOKEN}`)return c.json({success:false,error:{code:"UNAUTHORIZED"}},401);c.set("mrkUserId" as never,"usr_test" as never);await next();});
app.get("/api/v1/health",c=>c.json({success:true,data:{service:"mrk-backend",env:c.env.MRK_ENV,version:"0.1.2-gate2"}}));
app.route("/api/v1/test",testRoutes);app.route("/api/v1/jobs",jobRoutes);
app.get("/api/v1/quota",async c=>c.json({success:true,data:await getQuota(c.env.DB,"usr_test")}));
export default app;