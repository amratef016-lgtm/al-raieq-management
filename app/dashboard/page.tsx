import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import Dashboard from "@/components/dashboard";
export const dynamic="force-dynamic";
export default async function DashboardPage(){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect("/login");const {data:profile}=await supabase.from("user_profiles").select("display_name,role,is_active").eq("user_id",user.id).maybeSingle();if(!profile?.is_active)return <main className="login-page"><section className="login-card"><div className="eyebrow">AL RAIEQ</div><h1>الحساب في انتظار التفعيل</h1><p>تم تسجيل الدخول، لكن الحساب لم يحصل على صلاحية استخدام المنظومة بعد. اطلب من المدير تفعيل حسابك.</p><p>{user.email}</p><form action="/auth/signout" method="post"><button className="btn">تسجيل الخروج</button></form></section></main>;return <Dashboard email={user.email??""} name={profile.display_name||"فريق الرايق"} role={profile.role}/>;}
