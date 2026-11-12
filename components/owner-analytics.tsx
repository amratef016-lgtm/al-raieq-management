"use client";
import {useEffect,useMemo,useState} from "react";
import {createClient} from "@/lib/supabase/client";

type Sale={id:string;occurred_on:string;product_name:string|null;total_egp:number|string;paid_egp:number|string|null;remaining_egp:number|string|null;quantity:number|string;channel:string|null;operation_type:string|null;customer_name:string|null};
type Expense={id:string;occurred_on:string;amount_egp:number|string;category:string|null;description:string;payment_method:string|null};
type Movement={id:string;product_name:string;quantity:number|string;remaining_quantity:number|string|null;movement_type:string;occurred_on:string};
type Product={id:string;name:string;unit:string|null;unit_cost_egp:number|string|null;reorder_level:number|string|null};
type Customer={id:string;name:string;balance_due_egp:number|string|null};
type Supplier={id:string;name:string;balance_due_egp:number|string|null};
const n=(v:unknown)=>Number(v||0);
const egp=(v:number)=>new Intl.NumberFormat("ar-EG",{maximumFractionDigits:0}).format(v)+" ج.م";
const dateLabel=(s:string)=>new Intl.DateTimeFormat("ar-EG",{day:"numeric",month:"short"}).format(new Date(s+"T12:00:00"));
export default function OwnerAnalytics(){
 const db=useMemo(()=>createClient(),[]);
 const [sales,setSales]=useState<Sale[]>([]),[expenses,setExpenses]=useState<Expense[]>([]),[moves,setMoves]=useState<Movement[]>([]),[products,setProducts]=useState<Product[]>([]),[customers,setCustomers]=useState<Customer[]>([]),[suppliers,setSuppliers]=useState<Supplier[]>([]);
 const [period,setPeriod]=useState("all"),[loading,setLoading]=useState(true),[error,setError]=useState("");
 async function load(){
  setLoading(true);setError("");
  const [s,e,m,p,c,v]=await Promise.all([
   db.from("sales").select("id,occurred_on,product_name,total_egp,paid_egp,remaining_egp,quantity,channel,operation_type,customer_name").order("occurred_on",{ascending:true}).limit(5000),
   db.from("expenses").select("id,occurred_on,amount_egp,category,description,payment_method").order("occurred_on",{ascending:true}).limit(3000),
   db.from("inventory_movements").select("id,product_name,quantity,remaining_quantity,movement_type,occurred_on").order("occurred_on",{ascending:false}).limit(3000),
   db.from("products").select("id,name,unit,unit_cost_egp,reorder_level").eq("is_active",true).order("name"),
   db.from("customers").select("id,name,balance_due_egp").order("name"),
   db.from("suppliers").select("id,name,balance_due_egp").order("name")
  ]);
  const failure=[s,e,m,p,c,v].find(x=>x.error);
  if(failure?.error)setError("تعذر تحميل بعض المؤشرات: "+failure.error.message);
  setSales((s.data||[]) as Sale[]);setExpenses((e.data||[]) as Expense[]);setMoves((m.data||[]) as Movement[]);setProducts((p.data||[]) as Product[]);setCustomers((c.data||[]) as Customer[]);setSuppliers((v.data||[]) as Supplier[]);
  setLoading(false);
 }
 useEffect(()=>{void load();const channel=db.channel("owner-analytics-live").on("postgres_changes",{event:"*",schema:"public",table:"sales"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"expenses"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"inventory_movements"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"customers"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"suppliers"},()=>void load()).on("postgres_changes",{event:"*",schema:"public",table:"products"},()=>void load()).subscribe();return()=>{void db.removeChannel(channel);};},[db]);
 const filtered=useMemo(()=>{
  const validSales=sales.filter(x=>n(x.total_egp)>0&&x.operation_type!=="صرف للمحل"&&x.channel!=="صرف داخلي");
  const days=period==="all"?Infinity:Number(period);
  const latest=[...validSales.map(x=>x.occurred_on),...expenses.map(x=>x.occurred_on)].filter(Boolean).sort();
  const end=latest[latest.length-1]||"2026-11-11";
  const start=days===Infinity?"0000-01-01":new Date(new Date(end+"T12:00:00").getTime()-(days-1)*86400000).toISOString().slice(0,10);
  return {sales:validSales.filter(x=>x.occurred_on>=start&&x.occurred_on<=end),expenses:expenses.filter(x=>x.occurred_on>=start&&x.occurred_on<=end),start,end};
 },[sales,expenses,period]);
 const metrics=useMemo(()=>{
  const revenue=filtered.sales.reduce((a,x)=>a+n(x.total_egp),0),spent=filtered.expenses.reduce((a,x)=>a+n(x.amount_egp),0);
  const collected=filtered.sales.reduce((a,x)=>a+n(x.paid_egp),0),outstanding=filtered.sales.reduce((a,x)=>a+n(x.remaining_egp),0);
  const days=new Map<string,{sales:number;expenses:number}>();
  filtered.sales.forEach(x=>{const d=days.get(x.occurred_on)||{sales:0,expenses:0};d.sales+=n(x.total_egp);days.set(x.occurred_on,d);});
  filtered.expenses.forEach(x=>{const d=days.get(x.occurred_on)||{sales:0,expenses:0};d.expenses+=n(x.amount_egp);days.set(x.occurred_on,d);});
  const series=[...days.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([date,v])=>({date,...v}));
  const top=[...filtered.sales.reduce((map,x)=>{const k=x.product_name||"غير محدد";map.set(k,(map.get(k)||0)+n(x.total_egp));return map;},new Map<string,number>()).entries()].sort((a,b)=>b[1]-a[1]).slice(0,5);
  const channels=[...filtered.sales.reduce((map,x)=>{const k=x.channel||"غير محدد";map.set(k,(map.get(k)||0)+n(x.total_egp));return map;},new Map<string,number>()).entries()].sort((a,b)=>b[1]-a[1]);
  const receivables=customers.reduce((a,x)=>a+n(x.balance_due_egp),0);
  const payables=suppliers.reduce((a,x)=>a+n(x.balance_due_egp),0);
  const stock=[...moves.reduce((map,x)=>{const k=x.product_name||"غير محدد";if(!map.has(k))map.set(k,n(x.remaining_quantity));return map;},new Map<string,number>()).entries()].sort((a,b)=>a[0].localeCompare(b[0],"ar"));
  const maxStock=Math.max(0,...stock.map(x=>x[1]));
  const stockKg=stock.reduce((a,x)=>a+x[1],0);
  const expenseGroups=[...filtered.expenses.reduce((map,x)=>{const k=x.category||x.description||"غير مصنف";map.set(k,(map.get(k)||0)+n(x.amount_egp));return map;},new Map<string,number>()).entries()].sort((a,b)=>b[1]-a[1]);
  const costKnown=products.filter(x=>x.unit_cost_egp!==null&&n(x.unit_cost_egp)>0).length;
  return {revenue,spent,difference:revenue-spent,collected,outstanding,expenseGroups,series,top,channels,receivables,payables,stock,stockKg,maxStock,costKnown,orders:filtered.sales.length};
 },[filtered,customers,suppliers,moves,products]);
 const maxBar=Math.max(1,...metrics.series.flatMap(x=>[x.sales,x.expenses]));
 const chartPoints=metrics.series.map((x,i)=>({x:metrics.series.length===1?320:40+(i/(metrics.series.length-1))*560,salesY:190-(x.sales/maxBar)*155,expensesY:190-(x.expenses/maxBar)*155}));
 const salesPath=chartPoints.map((p,i)=>(i?"L":"M")+p.x+","+p.salesY).join(" ");
 const expensesPath=chartPoints.map((p,i)=>(i?"L":"M")+p.x+","+p.expensesY).join(" ");
 const shortLabel=(s:string)=>s.length>12?s.slice(0,11)+"…":s;
 return <section style={{display:"grid",gap:16}}>
  <div className="panel" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
   <div><div className="eyebrow">OWNER INSIGHTS</div><h2 style={{margin:"3px 0"}}>مركز متابعة الأونر</h2><div className="muted" style={{fontSize:12}}>من 1 نوفمبر 2026 وحتى اليوم • كل عملية جديدة تُضاف تلقائيًا للمخطط</div></div>
   <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>{[["7","7 أيام"],["30","30 يوم"],["90","90 يوم"],["all","كل الفترة"]].map(([v,l])=><button key={v} className={"btn "+(period===v?"gold":"light")} onClick={()=>setPeriod(v)}>{l}</button>)}<button className="btn light" onClick={()=>void load()} disabled={loading}>تحديث</button></div>
  </div>
  {error&&<div className="error">{error}</div>}
  {loading?<div className="panel loading">جارٍ تجميع مؤشرات النشاط...</div>:<>
   <div className="cards">
    <div className="card"><div className="metric-label">إجمالي المبيعات</div><div className="metric-value">{egp(metrics.revenue)}</div><div className="metric-foot">{metrics.orders} عملية بيع • الفترة المختارة</div></div>
    <div className="card"><div className="metric-label">إجمالي المصروفات</div><div className="metric-value">{egp(metrics.spent)}</div><div className="metric-foot">مصروفات مسجلة في نفس الفترة</div></div>
    <div className="card"><div className="metric-label">الفرق قبل تكلفة البن</div><div className="metric-value" style={{color:metrics.difference>=0?"var(--green)":"var(--red)"}}>{egp(metrics.difference)}</div><div className="metric-foot">مبيعات ناقص مصروفات مسجلة فقط؛ لا يمثل صافي الربح</div></div>
    <div className="card"><div className="metric-label">مديونيات العملاء</div><div className="metric-value">{egp(metrics.receivables)}</div><div className="metric-foot">{customers.length} عميل مسجل</div></div>
   </div>
   <div className="cards">
    <div className="card"><div className="metric-label">المحصل فعليًا</div><div className="metric-value">{egp(metrics.collected)}</div><div className="metric-foot">حسب خانة المدفوع</div></div>
    <div className="card"><div className="metric-label">مبيعات غير محصلة</div><div className="metric-value">{egp(metrics.outstanding)}</div><div className="metric-foot">حسب خانة المتبقي</div></div>
    <div className="card"><div className="metric-label">إجمالي المخزون</div><div className="metric-value">{metrics.stockKg.toLocaleString("ar-EG",{maximumFractionDigits:3})} كجم</div><div className="metric-foot">آخر رصيد مسجل لكل صنف</div></div>
    <div className="card"><div className="metric-label">مستحقات الموردين</div><div className="metric-value">{egp(metrics.payables)}</div><div className="metric-foot">حسب ملفات الموردين</div></div>
   </div>
   <div className="content-grid">
    <section className="panel"><div className="panel-head"><h2>اتجاه المبيعات والمصروفات</h2><span className="pill">جنيه مصري</span></div>
     {metrics.series.length?<><div style={{display:"flex",gap:15,fontSize:12,marginBottom:8}}><span style={{color:"#9a7138"}}>● المبيعات</span><span style={{color:"#b75b4b"}}>● المصروفات</span></div><div style={{width:"100%",overflow:"hidden"}}><svg viewBox="0 0 640 230" role="img" aria-label="مخطط المبيعات والمصروفات" style={{width:"100%",height:"auto",display:"block"}}>{[35,85,135,185].map(y=><line key={y} x1="35" x2="610" y1={y} y2={y} stroke="#eee5db" strokeDasharray="4 5"/>)}<path d={salesPath} fill="none" stroke="#b58b4f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><path d={expensesPath} fill="none" stroke="#c97868" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{chartPoints.map((p,i)=><g key={metrics.series[i].date}><circle cx={p.x} cy={p.salesY} r="4" fill="#b58b4f" stroke="white" strokeWidth="1.5"/><circle cx={p.x} cy={p.expensesY} r="4" fill="#c97868" stroke="white" strokeWidth="1.5"/>{(metrics.series.length<=14||i%Math.ceil(metrics.series.length/10)===0)&&<text x={p.x} y="215" textAnchor="middle" fontSize="10" fill="#8a7b70">{dateLabel(metrics.series[i].date)}</text>}</g>)}</svg></div><div className="muted" style={{fontSize:11}}>الأيام الظاهرة هي الأيام التي تحتوي على حركة مسجلة.</div></>:<div className="empty">لا توجد حركات في الفترة المختارة.</div>}
    </section>
    <section className="panel"><div className="panel-head"><h2>أعلى الأصناف في المبيعات</h2></div>{metrics.top.length?metrics.top.map(([name,value])=><div key={name} style={{marginBottom:13}}><div style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:12,marginBottom:5}}><strong>{name}</strong><span>{egp(value)}</span></div><div style={{height:8,background:"#f0e9e1",borderRadius:8,overflow:"hidden"}}><div style={{height:"100%",width:(value/metrics.top[0][1]*100)+"%",background:"#a98149",borderRadius:8}}/></div></div>):<div className="empty">لا توجد مبيعات كافية.</div>}</section>
   </div>
   <div className="content-grid">
    <section className="panel"><div className="panel-head"><h2>تفصيل المصروفات حسب البند</h2></div>
    {metrics.expenseGroups.length?metrics.expenseGroups.map(([name,value])=><div key={name} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--line)",fontSize:13}}><span>{name}</span><strong>{egp(value)}</strong></div>):<div className="empty">لا توجد مصروفات في الفترة المختارة.</div>}
    <div style={{display:"flex",justifyContent:"space-between",paddingTop:12,borderTop:"1px solid var(--line)"}}><strong>الإجمالي</strong><strong>{egp(metrics.spent)}</strong></div></section>
    <section className="panel"><div className="panel-head"><h2>هل المبيعات غطّت المصروفات؟</h2><span className="pill">قبل تكلفة البن</span></div>
    <div className="metric-value" style={{color:metrics.difference>=0?"var(--green)":"var(--red)"}}>{egp(metrics.difference)}</div>
    <p className="muted" style={{fontSize:12,lineHeight:2}}>المبيعات ناقص المصروفات المسجلة فقط، وليس صافي الربح. تكلفة البن المباع والتكاليف التشغيلية غير المكتملة لم تُخصم بعد.</p>
    <div style={{display:"flex",justifyContent:"space-between",paddingTop:10,borderTop:"1px solid var(--line)"}}><span>نسبة تغطية المصروفات</span><strong>{metrics.spent?((metrics.revenue/metrics.spent)*100).toFixed(1)+"%":"—"}</strong></div></section>
   </div>
   <div className="content-grid">
    <section className="panel"><div className="panel-head"><h2>المخزون الفعلي المتبقي</h2><span className="pill green">حسب آخر رصيد مسجل لكل صنف</span></div>{metrics.stock.length?metrics.stock.map(([name,value])=><div key={name} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--line)",fontSize:13}}><span>{name}</span><strong>{value.toLocaleString("ar-EG",{maximumFractionDigits:3})} كجم</strong></div>):<div className="empty">لا توجد حركات مخزون مسجلة.</div>}</section>
    <section className="panel"><div className="panel-head"><h2>قنوات البيع</h2></div>{metrics.channels.length?metrics.channels.map(([name,value])=><div key={name} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--line)",fontSize:13}}><span>{name}</span><strong>{egp(value)}</strong></div>):<div className="empty">لا توجد بيانات.</div>}<div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--line)",fontSize:12,color:"var(--muted)"}}>الفترة: {dateLabel(filtered.start)} — {dateLabel(filtered.end)}</div></section>
   </div>
   <section className="panel"><div className="panel-head"><h2>متى أقدر أقولك كسبان ولا خسران؟</h2></div><div className="muted" style={{fontSize:12,lineHeight:2}}>• المؤكد حاليًا: الإيرادات والمصروفات المسجلة، مديونيات العملاء، التزامات الموردين، وكميات المخزون.<br/>• صافي الربح لن يظهر كرقم نهائي قبل تثبيت تكلفة الكيلو الفعلية لكل صنف وتكلفة مكونات المشروبات وربطها بالمبيعات.<br/>• قيمة المخزون لن تُقدّر من أسعار البيع أو من تكاليف قديمة؛ نحتاج تكلفة شراء حديثة لكل شحنة.<br/>• النقدية الحالية لا تُستنتج من إجمالي المبيعات؛ يلزم رصيد خزنة افتتاحي وتسجيل التحصيلات والمدفوعات الفعلية.<br/>• الفرق المعروض هو المبيعات ناقص المصروفات المسجلة فقط، وليس صافي الربح.</div></section>
  </>}
 </section>;
}
