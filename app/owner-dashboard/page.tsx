import {redirect} from "next/navigation";
import {createClient} from "@/lib/supabase/server";
import OwnerAnalytics from "@/components/owner-analytics";
export const dynamic="force-dynamic";
const OWNER_ID="fe149f22-2f0b-4f41-8bbe-9ddc52e63d9d";
export default async function OwnerDashboardPage(){
 const supabase=await createClient();
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect("/login");
 if(user.id!==OWNER_ID)redirect("/dashboard");
 const {data:profile}=await supabase.from("user_profiles").select("display_name,is_active").eq("user_id",user.id).maybeSingle();
 if(!profile?.is_active)redirect("/dashboard");
 return <main className="main" style={{minHeight:"100vh",maxWidth:1440,margin:"0 auto",padding:24}} dir="rtl">
  <header className="topbar" style={{marginBottom:20}}>
   <div><div className="eyebrow">AL RAIEQ • OWNER</div><h1>لوحة التحكم</h1><div className="muted" style={{fontSize:12}}>مركز متابعة أداء الرايق — صفحة مستقلة للأونر</div></div>
   <a className="btn light" href="/dashboard">العودة للرئيسية</a>
  </header>
  <OwnerAnalytics/>
 </main>;
}
