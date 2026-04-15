import { useState, useEffect, useRef } from "react";

/* ═══ UTILS ═══════════════════════════════════════════════════════════════ */
const uid = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().slice(0, 10);
const fmtShort = d => d ? new Date(d + "T00:00:00").toLocaleDateString("ko-KR", { month: "short", day: "numeric" }) : "";
const fmtFull  = d => d ? new Date(d + "T00:00:00").toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "";
const dayLabel = d => ["일","월","화","수","목","금","토"][new Date(d + "T00:00:00").getDay()];
const addDays  = (d, n) => { const dt = new Date(d + "T00:00:00"); dt.setDate(dt.getDate() + n); return dt.toISOString().slice(0, 10); };
const KEY = "sgv7";
const NOW_Y = new Date().getFullYear();
const NOW_M = new Date().getMonth() + 1;
const MO = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

/* ═══ CONSTANTS ═══════════════════════════════════════════════════════════ */
const GRADS = [
  "linear-gradient(135deg,#FF6B6B,#FF8E53)",
  "linear-gradient(135deg,#4ECDC4,#44A08D)",
  "linear-gradient(135deg,#A78BFA,#7C3AED)",
  "linear-gradient(135deg,#F59E0B,#EF4444)",
  "linear-gradient(135deg,#60A5FA,#1D4ED8)",
  "linear-gradient(135deg,#F472B6,#BE185D)",
  "linear-gradient(135deg,#34D399,#059669)",
  "linear-gradient(135deg,#FBBF24,#D97706)",
];
const GC = ["#FF6B6B","#4ECDC4","#A78BFA","#F59E0B","#60A5FA","#F472B6","#34D399","#FBBF24"];
const EMOJIS = ["🌍","📚","🏃","💻","🎨","🎯","💡","🔥","🧘","💪","✍️","🎵","💰","📊","🚀","⚡"];
const TC = { 영어:"#3B82F6", 독서:"#10B981", 운동:"#F59E0B", 코딩:"#8B5CF6", 마음:"#EC4899", 기타:"#6B7280", 재테크:"#FBBF24", 유튜브:"#EF4444" };
const EVCOLS = ["#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#F472B6","#FBBF24"];
const KR_COLS = ["#22C55E","#3B82F6","#F59E0B","#EF4444","#8B5CF6","#EC4899","#4ECDC4","#F472B6"];

const TEMPLATES = [
  { id:"ct1", title:"개발자 성장 로드맵", emoji:"💻", gi:4, desc:"코딩 실력을 체계적으로 키우는 90일 플랜", days:90, cat:"학습",
    krs:[{ title:"알고리즘 100제", type:"checklist", color:"#8B5CF6", items:["매일 1문제","풀이 노트 정리","오답 복습"] },
         { title:"포트폴리오 완성", type:"checklist", color:"#3B82F6", items:["프로젝트 3개 선정","GitHub README","배포 완료"] }] },
  { id:"ct2", title:"체중감량 12주", emoji:"💪", gi:0, desc:"건강한 식단과 운동으로 체형 변화", days:84, cat:"운동",
    krs:[{ title:"주 3회 유산소", type:"checklist", color:"#FF6B6B", items:["월 유산소","수 유산소","금 유산소"] },
         { title:"식단 & 수면 관리", type:"checklist", color:"#F59E0B", items:["식단 기록","단백질 120g","수면 7시간"] }] },
  { id:"ct3", title:"토익 900점", emoji:"🌍", gi:2, desc:"3개월 집중 토익 완성 플랜", days:90, cat:"학습",
    krs:[{ title:"매일 단어 20개", type:"checklist", color:"#A78BFA", items:["단어 암기","복습 3회"] },
         { title:"LC 만점 전략", type:"checklist", color:"#3B82F6", items:["받아쓰기 10분","모의고사 5회"] }] },
  { id:"ct4", title:"연간 독서왕", emoji:"📚", gi:1, desc:"1년 50권 완독", days:365, cat:"독서",
    krs:[{ title:"매일 30분 독서", type:"checklist", color:"#4ECDC4", items:["아침 독서","독후감 작성"] }] },
  { id:"ct5", title:"유튜브 런칭", emoji:"🎵", gi:5, desc:"0에서 구독자 1000명까지", days:180, cat:"유튜브",
    krs:[{ title:"영상 10개 업로드", type:"checklist", color:"#F472B6", items:["주제 기획","촬영/편집"] },
         { title:"쇼츠 챌린지", type:"checklist", color:"#EF4444", items:["쇼츠 5개","콜라보"] }] },
  { id:"ct6", title:"재테크 시작", emoji:"💰", gi:7, desc:"경제적 자유를 향한 첫 걸음", days:365, cat:"재테크",
    krs:[{ title:"비상금 목표 설정", type:"checklist", color:"#FBBF24", items:["월 저축 설정","가계부 작성"] }] },
];

/* ═══ STORAGE ══════════════════════════════════════════════════════════════ */
const load = () => { try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
const save = d => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };

const makeInit = () => {
  const p1 = uid(), p2 = uid();
  const td = todayStr(), yd = addDays(td,-1), yd2 = addDays(td,-2);
  return {
    sub: { plan:"trial", start:td, end:addDays(td,7) },
    profile: { name:"나의 성장", avatar:"🌱", pts:340, lv:4 },
    projects: [
      { id:p1, title:"영어 마스터", emoji:"🌍", gi:0, streak:12, dLeft:18, createdAt:td, desc:"매일 30분 영어", done:false, doneAt:null },
      { id:p2, title:"런닝 루틴",   emoji:"🏃", gi:2, streak:21, dLeft:7,  createdAt:yd,  desc:"주 5회 5km",   done:false, doneAt:null },
    ],
    krs: [
      { id:uid(), pid:p1, title:"영어 단어 900개 암기", type:"checklist", color:"#F59E0B", memo:"", items:[{ id:uid(), text:"매일 단어 20개", done:true },{ id:uid(), text:"복습 3회", done:false }] },
      { id:uid(), pid:p1, title:"회화 연습 완료", type:"checklist", color:"#10B981", memo:"",
        items:[{ id:uid(), text:"발음 교정", done:true },{ id:uid(), text:"대화 패턴 20개", done:false },{ id:uid(), text:"원어민 10분", done:false }] },
      { id:uid(), pid:p2, title:"200km 달리기", type:"numeric", cur:87, target:200, unit:"km", color:"#A78BFA", memo:"", items:[] },
    ],
    tasks: [
      { id:uid(), lpid:p1, text:"영어 단어 20개", period:"daily", date:td, time:"08:00", completed:false, tag:"영어", pts:10, subs:[] },
      { id:uid(), lpid:p2, text:"런닝 5km",       period:"daily", date:td, time:"06:30", completed:true,  tag:"운동", pts:20, subs:[] },
      { id:uid(), lpid:null, text:"스트레칭",  period:"routine", startDate:null, endDate:null, time:"07:00", completedDates:[], tag:"운동", pts:10, subs:[] },
      { id:uid(), lpid:null, text:"명상 10분", period:"routine", startDate:null, endDate:null, time:"",      completedDates:[yd,yd2], tag:"마음", pts:10, subs:[] },
    ],
    events: [
      { id:uid(), title:"영어 시험", date:addDays(td,3), time:"14:00", color:"#3B82F6" },
    ],
    diaries: [],
    templates: TEMPLATES,
  };
};

/* ═══ SHARED UI ════════════════════════════════════════════════════════════ */
const INP = { width:"100%", background:"#161616", border:"1px solid #252525", borderRadius:11, color:"#fff", padding:"11px 13px", fontSize:14, outline:"none", fontFamily:"Pretendard, -apple-system, sans-serif", marginBottom:10 };
const BTN_G = { width:"100%", padding:13, background:"linear-gradient(90deg,#22C55E,#16A34A)", border:"none", borderRadius:12, color:"#000", fontWeight:800, fontSize:14, cursor:"pointer", fontFamily:"Pretendard, -apple-system, sans-serif" };

function PBar({ pct=0, color="linear-gradient(90deg,#22C55E,#86EFAC)", h=4 }) {
  return (
    <div style={{ height:h, background:"#1a1a1a", borderRadius:10, overflow:"hidden" }}>
      <div style={{ height:"100%", width:`${Math.min(100,Math.max(0,pct))}%`, background:color, borderRadius:10, transition:"width .5s cubic-bezier(.22,1,.36,1)" }}/>
    </div>
  );
}

function Flash({ msg, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2000); return () => clearTimeout(t); }, []);
  return <div style={{ position:"fixed", top:"13%", left:"50%", transform:"translateX(-50%)", background:"linear-gradient(90deg,#22C55E,#86EFAC)", color:"#000", fontWeight:900, fontSize:14, padding:"9px 22px", borderRadius:30, zIndex:9999, whiteSpace:"nowrap", fontFamily:"'DM Mono',monospace", animation:"fp 2s ease forwards" }}>{msg}</div>;
}

/* ── Bottom Sheet (절반→전체 확장 지원) ── */
function Sheet({ onClose, title, children, halfHeight }) {
  const [expanded, setExpanded] = useState(false);
  const startY = useRef(null);
  const sheetRef = useRef(null);

  const handleTouchStart = e => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = e => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    if (dy < -40) setExpanded(true);   // 위로 스와이프 → 전체 확장
    if (dy > 60)  { if (expanded) setExpanded(false); else onClose(); }
    startY.current = null;
  };

  const maxH = halfHeight && !expanded ? "52vh" : "92vh";

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", zIndex:600, display:"flex", alignItems:"flex-end", justifyContent:"center" }} onClick={onClose}>
      <div
        ref={sheetRef}
        style={{ width:"100%", maxWidth:390, background:"#0d0d0d", borderRadius:"20px 20px 0 0", maxHeight:maxH, overflowY:"auto", border:"1px solid #1e1e1e", borderBottom:"none", paddingBottom:40, transition:"max-height .35s cubic-bezier(.22,1,.36,1)" }}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ width:36, height:4, background:"#2a2a2a", borderRadius:4, margin:"14px auto 0" }}/>
        {halfHeight && !expanded && (
          <div style={{ textAlign:"center", marginTop:6 }}>
            <span style={{ fontSize:9, color:"#333", fontFamily:"'DM Mono',monospace" }}>위로 당기면 전체 보기</span>
          </div>
        )}
        {title && <div style={{ fontSize:16, fontWeight:800, margin:"12px 20px 0" }}>{title}</div>}
        <div style={{ padding:"12px 20px 0" }}>{children}</div>
      </div>
    </div>
  );
}

function Confirm({ msg, onYes, onNo }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.93)", zIndex:700, display:"flex", alignItems:"center", justifyContent:"center" }} onClick={onNo}>
      <div style={{ background:"#111", borderRadius:18, padding:22, maxWidth:290, width:"90%", border:"1px solid #2a2a2a", textAlign:"center" }} onClick={e=>e.stopPropagation()}>
        <div style={{ fontSize:13, color:"#bbb", marginBottom:18, lineHeight:1.7 }}>{msg}</div>
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={onNo}  style={{ flex:1, padding:10, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:11, color:"#777", fontSize:13, cursor:"pointer" }}>취소</button>
          <button onClick={onYes} style={{ flex:1, padding:10, background:"#ef4444", border:"none", borderRadius:11, color:"#fff", fontSize:13, fontWeight:700, cursor:"pointer" }}>확인</button>
        </div>
      </div>
    </div>
  );
}

function SwipeRow({ onDelete, onEdit, children }) {
  const [off, setOff] = useState(0);
  const [drag, setDrag] = useState(false);
  const sx = useRef(null), so = useRef(0);
  // onEdit이 있으면 버튼 2개(수정+삭제), 없으면 1개(삭제)
  const BTN_W = onEdit ? 160 : 82;
  const SNAP  = onEdit ? 80  : 48;
  const begin=x=>{ sx.current=x; so.current=off; setDrag(true); };
  const move =x=>{ if(sx.current==null)return; setOff(Math.min(0,Math.max(-BTN_W,so.current+(x-sx.current)))); };
  const end  =()=>{ if(sx.current==null)return; sx.current=null; setDrag(false); setOff(o=>o<-SNAP?-BTN_W:0); };
  return (
    <div style={{ position:"relative", borderRadius:12, isolation:"isolate" }} onMouseMove={e=>move(e.clientX)} onMouseUp={end} onMouseLeave={end}>
      <div style={{ position:"absolute", right:0, top:0, bottom:0, width:BTN_W, display:"flex", borderRadius:"0 12px 12px 0", zIndex:0, clipPath:`inset(0 0 0 ${BTN_W+off}px)`, overflow:"hidden" }}>
        {onEdit && (
          <div style={{ flex:1, background:"#3B82F6", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexDirection:"column", gap:1 }}
            onClick={()=>{ setOff(0); onEdit(); }}>
            <div style={{ fontSize:16 }}>✏️</div>
            <div style={{ fontSize:10, color:"#fff", fontWeight:700 }}>수정</div>
          </div>
        )}
        <div style={{ flex:1, background:"#ef4444", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexDirection:"column", gap:1 }}
          onClick={()=>{ setOff(0); onDelete(); }}>
          <div style={{ fontSize:16 }}>🗑️</div>
          <div style={{ fontSize:10, color:"#fff", fontWeight:700 }}>삭제</div>
        </div>
      </div>
      <div style={{ transform:`translateX(${off}px)`, transition:drag?"none":"transform .22s cubic-bezier(.22,1,.36,1)", position:"relative", zIndex:1, touchAction:"pan-y", borderRadius:12 }}
        onTouchStart={e=>begin(e.touches[0].clientX)} onTouchMove={e=>move(e.touches[0].clientX)} onTouchEnd={end} onMouseDown={e=>begin(e.clientX)}>
        {children}
      </div>
    </div>
  );
}

/* ═══ PAYWALL ══════════════════════════════════════════════════════════════ */
function Paywall({ onClose, onSelect }) {
  const [sel, setSel] = useState("yearly");
  const plans = [
    { id:"monthly", label:"월간", price:"₩2,900", sub:"매월 결제" },
    { id:"yearly",  label:"연간", price:"₩29,000", sub:"월 ₩2,416 · 17% 절약", badge:"인기" },
    { id:"lifetime",label:"평생", price:"₩99,000", sub:"한 번만 결제", badge:"베스트" },
  ];
  return (
    <div style={{ position:"fixed", inset:0, background:"#080808", zIndex:800, overflowY:"auto", display:"flex", flexDirection:"column", alignItems:"center" }}>
      <div style={{ width:"100%", maxWidth:390, padding:"56px 22px 36px", display:"flex", flexDirection:"column", alignItems:"center" }}>
        <div style={{ fontSize:44, marginBottom:14 }}>🚀</div>
        <div style={{ fontSize:22, fontWeight:900, textAlign:"center", marginBottom:6 }}>성장을 멈추지 마세요</div>
        <div style={{ fontSize:13, color:"#666", textAlign:"center", lineHeight:1.7, marginBottom:24 }}>프리미엄으로 모든 기능을 제한 없이</div>
        <div style={{ width:"100%", background:"#111", borderRadius:16, padding:18, border:"1px solid #1e1e1e", marginBottom:20 }}>
          {[["✅","프로젝트 & 핵심목표 무제한"],["✅","루틴 히스토리 무제한"],["✅","템플릿 가져오기"],["✅","잠금화면 위젯 (예정)"],["✅","광고 없음"]].map(([i,t])=>(
            <div key={t} style={{ display:"flex", alignItems:"center", gap:10, padding:"7px 0", borderBottom:"1px solid #1a1a1a" }}>
              <span style={{ fontSize:14 }}>{i}</span><span style={{ fontSize:13, color:"#ccc" }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ width:"100%", display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
          {plans.map(p=>(
            <div key={p.id} onClick={()=>setSel(p.id)} style={{ background:sel===p.id?"#0f2a0f":"#111", borderRadius:14, padding:"14px 16px", border:sel===p.id?"2px solid #22C55E":"1px solid #1e1e1e", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:20, height:20, borderRadius:"50%", border:sel===p.id?"none":"2px solid #333", background:sel===p.id?"#22C55E":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11 }}>
                  {sel===p.id&&<span style={{ color:"#000", fontWeight:900 }}>✓</span>}
                </div>
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ fontSize:14, fontWeight:700 }}>{p.label}</span>
                    {p.badge&&<span style={{ fontSize:10, background:"#22C55E", color:"#000", borderRadius:20, padding:"1px 7px", fontWeight:700 }}>{p.badge}</span>}
                  </div>
                  <div style={{ fontSize:11, color:"#555", marginTop:1 }}>{p.sub}</div>
                </div>
              </div>
              <div style={{ fontSize:16, fontWeight:900, color:sel===p.id?"#22C55E":"#fff", fontFamily:"'DM Mono',monospace" }}>{p.price}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>onSelect(sel)} style={{ ...BTN_G, marginBottom:10 }}>
          {sel==="lifetime"?"평생 이용권 구매":sel==="monthly"?"월간 구독 시작":"연간 구독 시작"}
        </button>
        <button onClick={onClose} style={{ width:"100%", padding:10, background:"none", border:"none", color:"#444", fontSize:12, cursor:"pointer" }}>7일 무료 체험 · 언제든 취소 가능</button>
      </div>
    </div>
  );
}

/* ═══ DIARY MODAL ══════════════════════════════════════════════════════════ */
function DiaryModal({ date, existing, onClose, onSave }) {
  const [mood,setMood]=useState(existing?.mood||"😊");
  const [good,setGood]=useState(existing?.good||"");
  const [bad, setBad] =useState(existing?.bad ||"");
  const [tmr, setTmr] =useState(existing?.tmr ||"");
  const [free,setFree]=useState(existing?.free||"");
  return (
    <Sheet onClose={onClose} title={`${fmtShort(date)} 일기`}>
      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {["😊","😐","😔","😤","🥲","🔥"].map(m=>(
          <div key={m} onClick={()=>setMood(m)} style={{ fontSize:24, cursor:"pointer", padding:5, borderRadius:10, background:mood===m?"#1a2a1a":"transparent", border:mood===m?"1.5px solid #22C55E":"1.5px solid transparent" }}>{m}</div>
        ))}
      </div>
      {[["🌟 잘한 것",good,setGood],["😅 아쉬운 것",bad,setBad],["🎯 내일 목표",tmr,setTmr]].map(([label,val,setter])=>(
        <div key={label} style={{ marginBottom:8 }}>
          <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>{label}</div>
          <textarea value={val} onChange={e=>setter(e.target.value)} rows={2} style={{ ...INP, marginBottom:0, resize:"none", lineHeight:1.6 }} placeholder="내용 입력"/>
        </div>
      ))}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>✏️ 자유 기록</div>
        <textarea value={free} onChange={e=>setFree(e.target.value)} rows={3} style={{ ...INP, marginBottom:0, resize:"none" }} placeholder="오늘의 생각…"/>
      </div>
      <button onClick={()=>onSave({mood,good,bad,tmr,free})} style={BTN_G}>저장</button>
    </Sheet>
  );
}

/* ═══ TASK FORM ════════════════════════════════════════════════════════════ */
function TaskForm({ initDate, initPeriod, initLpid, projects, onAdd, onClose, editTask, onEdit }) {
  const isEdit = !!editTask;
  const [text,setText]=useState(isEdit?editTask.text:"");
  const [tag,setTag]=useState(isEdit?editTask.tag:"기타");
  const [pts,setPts]=useState(isEdit?String(editTask.pts):"10");
  const [date,setDate]=useState(isEdit&&editTask.date?editTask.date:initDate||todayStr());
  const [time,setTime]=useState(isEdit?editTask.time||"":"");
  const [period,setPeriod]=useState(isEdit?editTask.period:initPeriod||"daily");
  const [startDate,setStartDate]=useState(isEdit?editTask.startDate||"":"");
  const [endDate,setEndDate]=useState(isEdit?editTask.endDate||"":"");
  const [lpid,setLpid]=useState(isEdit?editTask.lpid||"":initLpid||"");

  const submit=()=>{
    if(!text.trim())return;
    const payload = { text:text.trim(), tag, pts:parseInt(pts)||10, time, period, lpid:lpid||null,
      date:period==="daily"?date:undefined,
      startDate:period==="routine"?(startDate||null):undefined,
      endDate:period==="routine"?(endDate||null):undefined };
    if(isEdit){ onEdit({...editTask,...payload}); }
    else { onAdd(payload); }
    onClose();
  };

  return (
    <Sheet onClose={onClose} title={isEdit?"할 일 수정":"새 할 일 추가"}>
      <input style={INP} placeholder="할 일 내용 *" value={text} onChange={e=>setText(e.target.value)}/>
      <div style={{ display:"flex", gap:7, marginBottom:12 }}>
        {["일일","루틴"].map(p=>(
          <button key={p} onClick={()=>setPeriod(p==="일일"?"daily":"routine")} style={{ flex:1, padding:8, borderRadius:10, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, background:period===(p==="일일"?"daily":"routine")?"#22C55E":"#161616", color:period===(p==="일일"?"daily":"routine")?"#000":"#555" }}>{p}</button>
        ))}
      </div>
      {period==="daily"&&(
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <input style={{ ...INP, marginBottom:0, flex:1 }} type="date" value={date} onChange={e=>setDate(e.target.value)}/>
          <input style={{ ...INP, marginBottom:0, flex:1 }} type="time" value={time} onChange={e=>setTime(e.target.value)}/>
        </div>
      )}
      {period==="routine"&&(
        <div style={{ marginBottom:12 }}>
          <div style={{ fontSize:11, color:"#555", marginBottom:6 }}>반복 기간 <span style={{ color:"#3a3a3a" }}>(비워두면 항상 표시)</span></div>
          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>시작일</div>
              <input style={{ ...INP, marginBottom:0 }} type="date" value={startDate} onChange={e=>{ setStartDate(e.target.value); if(endDate&&e.target.value>endDate)setEndDate(""); }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>종료일 (선택)</div>
              <input style={{ ...INP, marginBottom:0 }} type="date" value={endDate} min={startDate||undefined} onChange={e=>setEndDate(e.target.value)}/>
            </div>
          </div>
          <div style={{ marginTop:8 }}>
            <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>시간 (선택)</div>
            <input style={{ ...INP, marginBottom:0, width:"50%" }} type="time" value={time} onChange={e=>setTime(e.target.value)}/>
          </div>
        </div>
      )}
      <div style={{ fontSize:11, color:"#555", marginBottom:5 }}>프로젝트 연결 (선택)</div>
      <select value={lpid} onChange={e=>setLpid(e.target.value)} style={{ ...INP, marginBottom:12 }}>
        <option value="">연결 안함</option>
        {projects.filter(p=>!p.done).map(p=><option key={p.id} value={p.id}>{p.emoji} {p.title}</option>)}
      </select>
      <div style={{ display:"flex", gap:5, marginBottom:10, flexWrap:"wrap" }}>
        {Object.keys(TC).map(tg=>(
          <button key={tg} onClick={()=>setTag(tg)} style={{ padding:"4px 10px", borderRadius:20, border:"none", cursor:"pointer", fontSize:11, fontWeight:700, background:tag===tg?(TC[tg]+"25"):"#161616", color:tag===tg?TC[tg]:"#555" }}>{tg}</button>
        ))}
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
        <span style={{ fontSize:12, color:"#555", whiteSpace:"nowrap" }}>포인트</span>
        <input style={{ ...INP, marginBottom:0, width:76 }} type="number" value={pts} onChange={e=>setPts(e.target.value)}/>
      </div>
      <button onClick={submit} style={BTN_G}>{isEdit?"수정 완료":"추가하기"}</button>
    </Sheet>
  );
}

/* ═══ KR DETAIL SHEET (Bottom Sheet, Auto-save) ══════════════════════════ */
function KRDetailSheet({ kr, onClose, onUpdate, onDelete, projColor }) {
  const [title, setTitle]   = useState(kr.title);
  const [memo, setMemo]     = useState(kr.memo || "");
  const [type, setType]     = useState(kr.type);
  const [target, setTarget] = useState(kr.target || 100);
  const [unit, setUnit]     = useState(kr.unit || "");
  const [cur, setCur]       = useState(kr.cur || 0);
  const [color, setColor]   = useState(kr.color);
  const [items, setItems]   = useState(kr.items || []); // 체크형 세부항목
  const [newItemText, setNewItemText] = useState("");
  const [usePeriod, setUsePeriod] = useState(!!(kr.startDate || kr.endDate));
  const [startDate, setStartDate] = useState(kr.startDate || "");
  const [endDate, setEndDate]     = useState(kr.endDate || "");
  const [saved, setSaved]   = useState(false);
  const newItemRef = useRef(null);

  const autoSaveTimer = useRef(null);
  const buildUpdated = (patch = {}) => ({
    ...kr, title, memo, type, color, items,
    startDate: usePeriod ? startDate : null,
    endDate:   usePeriod ? endDate   : null,
    cur, target, unit,
    ...patch
  });

  const doAutoSave = (patch = {}) => {
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      onUpdate(buildUpdated(patch));
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    }, 400);
  };

  useEffect(() => { doAutoSave(); }, [title, memo, type, color, cur, target, unit, usePeriod, startDate, endDate, items]);

  // 체크형 달성률 (items 기준)
  const checkPct = items.length === 0 ? (kr._done ? 100 : 0) : Math.round(items.filter(i=>i.done).length / items.length * 100);
  const numPct   = Math.min(100, Math.round((cur / (target||1)) * 100));
  const pct      = type === "numeric" ? numPct : checkPct;

  /* ── 세부항목 조작 ── */
  const toggleItem = (id) => {
    const next = items.map(i => i.id===id ? {...i, done:!i.done} : i);
    setItems(next);
  };
  const addItem = () => {
    if (!newItemText.trim()) return;
    setItems(prev => [...prev, { id:uid(), text:newItemText.trim(), done:false }]);
    setNewItemText("");
    setTimeout(() => newItemRef.current?.focus(), 30);
  };
  const deleteItem = (id) => setItems(prev => prev.filter(i => i.id !== id));

  return (
    <Sheet onClose={onClose} halfHeight={true}>
      {/* 헤더 */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <div style={{ fontSize:15, fontWeight:800 }}>핵심목표 상세</div>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {saved && <span style={{ fontSize:10, color:"#22C55E", fontFamily:"'DM Mono',monospace" }}>저장됨 ✓</span>}
          <button onClick={onClose} style={{ background:"#1a1a1a", border:"none", borderRadius:9, color:"#aaa", fontSize:12, cursor:"pointer", padding:"6px 11px", fontWeight:700 }}>닫기</button>
        </div>
      </div>

      {/* 진행도 카드 */}
      <div style={{ background:"#0d0d0d", borderRadius:14, padding:14, border:"1px solid #1e1e1e", marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:color }}/>
          <div style={{ fontSize:11, color:"#555", flex:1 }}>달성률</div>
          <div style={{ fontSize:20, fontWeight:900, color:pct>=67?"#22C55E":pct>=34?"#F59E0B":"#EF4444", fontFamily:"'DM Mono',monospace" }}>{pct}%</div>
        </div>
        <PBar pct={pct} color={`linear-gradient(90deg,${color},${color}88)`} h={7}/>
        {type==="numeric"&&(
          <div style={{ marginTop:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <button onClick={()=>setCur(c=>Math.max(0,c-1))} style={{ width:30, height:30, borderRadius:8, background:"#1a1a1a", border:"1px solid #252525", color:"#aaa", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
              <input type="range" min={0} max={target} value={cur} onChange={e=>setCur(parseInt(e.target.value))} style={{ flex:1, accentColor:color }}/>
              <button onClick={()=>setCur(c=>Math.min(target,c+1))} style={{ width:30, height:30, borderRadius:8, background:"#1a1a1a", border:"1px solid #252525", color:"#aaa", fontSize:16, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:7, marginTop:6 }}>
              <input type="number" value={cur} onChange={e=>setCur(parseInt(e.target.value)||0)} style={{ ...INP, marginBottom:0, width:70, padding:"5px 9px", fontSize:13, textAlign:"center" }}/>
              <span style={{ fontSize:12, color:"#444" }}>/ {target} {unit}</span>
            </div>
          </div>
        )}
      </div>

      {/* 이름 */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>이름</div>
        <input style={INP} value={title} onChange={e=>setTitle(e.target.value)} placeholder="핵심목표 이름"/>
      </div>

      {/* 체크형 세부항목 */}
      {type==="checklist" && (
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:"#555", marginBottom:8 }}>✅ 세부항목 <span style={{ color:"#333" }}>({items.filter(i=>i.done).length}/{items.length})</span></div>
          <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:8 }}>
            {items.map(item=>(
              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:9, padding:"9px 12px", background:"#111", borderRadius:11, border:"1px solid #1e1e1e" }}>
                <div onClick={()=>toggleItem(item.id)} style={{ width:20, height:20, borderRadius:6, border:item.done?"none":"2px solid #333", background:item.done?color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, transition:"all .2s" }}>
                  {item.done&&<span style={{ color:"#000", fontWeight:900, fontSize:10 }}>✓</span>}
                </div>
                <span style={{ flex:1, fontSize:13, color:item.done?"#555":"#e0e0e0", textDecoration:item.done?"line-through":"none" }}>{item.text}</span>
                <button onClick={()=>deleteItem(item.id)} style={{ background:"none", border:"none", color:"#333", fontSize:14, cursor:"pointer", padding:"0 2px", flexShrink:0 }}>×</button>
              </div>
            ))}
          </div>
          {/* 새 세부항목 입력 */}
          <div style={{ display:"flex", gap:7 }}>
            <input
              ref={newItemRef}
              style={{ ...INP, marginBottom:0, flex:1, fontSize:13, padding:"9px 12px" }}
              value={newItemText}
              onChange={e=>setNewItemText(e.target.value)}
              onKeyDown={e=>{ if(e.key==="Enter"){ e.preventDefault(); addItem(); } }}
              placeholder="세부항목 추가…"
            />
            <button onClick={addItem} style={{ padding:"0 14px", background:"#22C55E", border:"none", borderRadius:11, color:"#000", fontWeight:800, fontSize:14, cursor:"pointer", flexShrink:0 }}>+</button>
          </div>
        </div>
      )}

      {/* 메모 */}
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:11, color:"#555", marginBottom:4 }}>📝 메모</div>
        <textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={3} placeholder="메모, 전략, 다짐…" style={{ ...INP, marginBottom:0, resize:"none", lineHeight:1.7 }}/>
      </div>

      {/* 기간 설정 */}
      <div style={{ marginBottom:14 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
          <div style={{ fontSize:11, color:"#555" }}>📅 기간 설정</div>
          <div style={{ display:"flex", gap:6 }}>
            {[["기간 없음", false], ["기간 설정", true]].map(([label, val]) => (
              <button key={label} onClick={() => setUsePeriod(val)}
                style={{ padding:"4px 10px", borderRadius:18, border:"none", cursor:"pointer", fontSize:11, fontWeight:700,
                  background: usePeriod===val ? "#22C55E" : "#1a1a1a", color: usePeriod===val ? "#000" : "#555" }}
              >{label}</button>
            ))}
          </div>
        </div>
        {usePeriod && (
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>시작일</div>
              <input style={{ ...INP, marginBottom:0, fontSize:12 }} type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>종료일</div>
              <input style={{ ...INP, marginBottom:0, fontSize:12 }} type="date" value={endDate} min={startDate||undefined} onChange={e=>setEndDate(e.target.value)}/>
            </div>
          </div>
        )}
      </div>

      {/* 색상 */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:11, color:"#555", marginBottom:6 }}>색상</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {KR_COLS.map(c=><div key={c} onClick={()=>setColor(c)} style={{ width:26, height:26, borderRadius:"50%", background:c, cursor:"pointer", border:color===c?"3px solid #fff":"3px solid transparent" }}/>)}
        </div>
      </div>

      {/* 유형 */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, color:"#555", marginBottom:6 }}>유형</div>
        <div style={{ display:"flex", gap:8 }}>
          {[["checklist","✅ 체크형"],["numeric","📊 수치형"]].map(([t,label])=>(
            <button key={t} onClick={()=>setType(t)} style={{ flex:1, padding:"8px 0", borderRadius:10, border:"none", cursor:"pointer", fontSize:12, fontWeight:700, background:type===t?"#22C55E":"#161616", color:type===t?"#000":"#555" }}>{label}</button>
          ))}
        </div>
        {type==="numeric"&&(
          <div style={{ display:"flex", gap:7, marginTop:9 }}>
            <div style={{ flex:2 }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>목표 수치</div>
              <input style={{ ...INP, marginBottom:0 }} type="number" value={target} onChange={e=>setTarget(parseInt(e.target.value)||100)} placeholder="100"/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>단위</div>
              <input style={{ ...INP, marginBottom:0 }} value={unit} onChange={e=>setUnit(e.target.value)} placeholder="km"/>
            </div>
          </div>
        )}
      </div>

      {/* 삭제 */}
      <button onClick={onDelete} style={{ width:"100%", padding:12, background:"#1a0a0a", border:"1px solid #3a1a1a", borderRadius:12, color:"#ef4444", fontSize:13, cursor:"pointer", fontWeight:700, marginBottom:4 }}>핵심목표 삭제</button>
    </Sheet>
  );
}

/* ═══ PROJECT FULL PAGE ════════════════════════════════════════════════════ */
function ProjPage({ proj, krs, allTasks, onClose, onDelProj, onDoneProj, onAddKR, setAddTask, toggleTask, delTask, projPct, krPct, pctColor, pctGrad, onUpdateKR, onToggleKRItem, onDelKR, data, routineVisible }) {
  const [ptab, setPtab]   = useState("핵심목표");
  const [rYear, setRYear] = useState(NOW_Y);
  const [rMon,  setRMon]  = useState(NOW_M);
  const [detailKR, setDetailKR] = useState(null);
  const [openItems, setOpenItems] = useState(new Set()); // 세부항목 열린 KR id 집합

  const toggleOpenItems = (krId, hasItems) => {
    if (!hasItems) return; // 세부항목 없으면 무반응
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(krId)) next.delete(krId); else next.add(krId);
      return next;
    });
  };

  // 인라인 KR 추가
  const [krInputs, setKrInputs] = useState([]);
  const krRefs    = useRef({});
  const inputWrap = useRef(null);

  const p   = proj;
  const pct = projPct(p.id);
  const linked   = allTasks.filter(t => t.lpid === p.id);
  const dailyH   = linked.filter(t=>t.period==="daily").sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const routines = linked.filter(t=>t.period==="routine");

  // 일일 히스토리: 진행중 / 완료 분리
  const inProgress = dailyH.filter(t => !t.completed);
  const completed  = dailyH.filter(t => t.completed);

  const mDates=(y,m)=>{ const dim=new Date(y,m,0).getDate(); return Array.from({length:dim},(_,i)=>`${y}-${String(m).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`); };
  const doneDateCheck=(task,date)=>task.period==="routine"?!!(task.completedDates&&task.completedDates.includes(date)):(task.date===date&&!!task.completed);
  const DL=["월","화","수","목","금","토","일"];

  /* ─ 인라인 KR 추가 ─ */
  const addInputRow = (afterId=null) => {
    const newId = uid();
    setKrInputs(prev => {
      if (!afterId) return [...prev, { id:newId, text:"" }];
      const idx = prev.findIndex(x=>x.id===afterId);
      const next = [...prev];
      next.splice(idx+1, 0, { id:newId, text:"" });
      return next;
    });
    setTimeout(()=>{ krRefs.current[newId]?.focus(); }, 50);
  };

  const updateInput = (id, text) => {
    setKrInputs(prev => prev.map(x=>x.id===id?{...x,text}:x));
  };

  const removeInput = (id) => {
    setKrInputs(prev => {
      const idx = prev.findIndex(x=>x.id===id);
      const next = prev.filter(x=>x.id!==id);
      if (next.length > 0) {
        const prevId = next[Math.max(0,idx-1)]?.id;
        setTimeout(()=>{ if(prevId)krRefs.current[prevId]?.focus(); }, 30);
      }
      return next;
    });
  };

  const commitInput = (id, text) => {
    if (text.trim()) {
      onAddKR({ id:uid(), pid:p.id, title:text.trim(), type:"checklist", color:"#22C55E", memo:"", items:[] });
    }
    removeInput(id);
  };

  const handleKeyDown = (e, id, text) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (text.trim()) {
        onAddKR({ id:uid(), pid:p.id, title:text.trim(), type:"checklist", color:"#22C55E", memo:"", items:[] });
        updateInput(id, "");
        addInputRow(id);
      } else {
        removeInput(id);
      }
    } else if (e.key === "Backspace" && text === "") {
      e.preventDefault();
      removeInput(id);
    }
  };

  /* ─ KR 체크박스 토글 (체크형 + 수치형 모두 지원) ─ */
  const toggleKRCheck = (kr) => {
    if (kr.type === "numeric") {
      const isFullDone = (kr.cur || 0) >= (kr.target || 1);
      onUpdateKR({ ...kr, cur: isFullDone ? 0 : kr.target });
      return;
    }
    const allDone = kr.items?.length > 0 && kr.items.every(i=>i.done);
    if (!kr.items || kr.items.length === 0) {
      onUpdateKR({ ...kr, _done: !kr._done });
    } else {
      onUpdateKR({ ...kr, items: kr.items.map(i=>({...i, done:!allDone})) });
    }
  };

  /* ─ 수치형 KR 인라인 슬라이더 ─ */
  const NumericSlider = ({ kr }) => {
    const [localCur, setLocalCur] = useState(kr.cur || 0);
    const saveTimer = useRef(null);
    const handleChange = (val) => {
      const next = Math.min(kr.target, Math.max(0, val));
      setLocalCur(next);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => { onUpdateKR({ ...kr, cur: next }); }, 300);
    };
    return (
      <div style={{ padding:"2px 14px 11px" }} onClick={e=>e.stopPropagation()}>
        <input type="range" min={0} max={kr.target} value={localCur}
          onChange={e=>handleChange(parseInt(e.target.value))}
          style={{ width:"100%", accentColor:kr.color, cursor:"pointer" }}
        />
        <div style={{ fontSize:10, color:"#555", fontFamily:"'DM Mono',monospace", marginTop:1 }}>
          {localCur}/{kr.target}{kr.unit}
        </div>
      </div>
    );
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"#080808", zIndex:500, overflowY:"auto", maxWidth:390, margin:"0 auto" }}>
      {/* 헤더 */}
      <div style={{ position:"sticky", top:0, zIndex:10, background:"rgba(8,8,8,.97)", backdropFilter:"blur(20px)", borderBottom:"1px solid #1a1a1a" }}>
        <div style={{ padding:"14px 18px 10px", display:"flex", alignItems:"center", gap:10 }}>
          <button onClick={onClose} style={{ background:"#1a1a1a", border:"none", borderRadius:10, color:"#aaa", fontSize:13, cursor:"pointer", padding:"7px 13px", fontWeight:700 }}>← 뒤로</button>
          <div style={{ flex:1 }}/>
          {!p.done&&<button onClick={()=>onDoneProj(p.id)} style={{ background:"#0f2a0f", border:"1px solid #1a4a1a", borderRadius:10, color:"#22C55E", fontSize:12, cursor:"pointer", padding:"7px 12px", fontWeight:700 }}>✓ 완료</button>}
          <button onClick={()=>onDelProj(p.id)} style={{ background:"#1a0a0a", border:"1px solid #3a1a1a", borderRadius:10, color:"#ef4444", fontSize:12, cursor:"pointer", padding:"7px 12px" }}>삭제</button>
        </div>
      </div>

      {/* 히어로 */}
      <div style={{ background:GRADS[p.gi], padding:"22px 20px 18px", position:"relative" }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontSize:40 }}>{p.emoji}</span>
          <div>
            <div style={{ fontSize:20, fontWeight:900, color:"#fff" }}>{p.title}</div>
            {p.desc&&<div style={{ fontSize:12, color:"rgba(255,255,255,.75)", marginTop:2 }}>{p.desc}</div>}
          </div>
          <div style={{ position:"absolute", top:14, right:16, background:"rgba(0,0,0,.4)", borderRadius:20, padding:"3px 10px", fontSize:11, fontFamily:"'DM Mono',monospace", color:"#fff", fontWeight:700 }}>🔥{p.streak}</div>
        </div>
        <div style={{ marginTop:14, background:"rgba(0,0,0,.25)", borderRadius:12, padding:"10px 13px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
            <span style={{ fontSize:11, color:"rgba(255,255,255,.7)" }}>전체 달성률</span>
            <span style={{ fontSize:16, fontWeight:900, color:"#fff", fontFamily:"'DM Mono',monospace" }}>{pct}% <span style={{ fontSize:10, fontWeight:400, opacity:.7 }}>D-{p.dLeft}</span></span>
          </div>
          <PBar pct={pct} color="linear-gradient(90deg,rgba(255,255,255,.9),rgba(255,255,255,.5))" h={6}/>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display:"flex", gap:0, borderBottom:"1px solid #1a1a1a", background:"#080808", position:"sticky", top:57, zIndex:9 }}>
        {["핵심목표","일일히스토리","루틴통계"].map(t=>(
          <button key={t} onClick={()=>setPtab(t)} style={{ flex:1, padding:"12px 4px", background:"none", border:"none", cursor:"pointer", fontSize:11, fontWeight:700, color:ptab===t?"#22C55E":"#444", borderBottom:ptab===t?"2px solid #22C55E":"2px solid transparent", transition:"all .2s" }}>{t}</button>
        ))}
      </div>

      <div style={{ padding:"14px 18px", paddingBottom:100 }}>

        {/* ── 핵심목표 탭 ── */}
        {ptab==="핵심목표" && (
          <>
            {krs.map(kr=>{
              const kp = kr.type==="numeric"
                ? Math.min(100,Math.round((kr.cur||0)/(kr.target||1)*100))
                : (!kr.items?.length
                    ? (kr._done?100:0)
                    : Math.round(kr.items.filter(i=>i.done).length/kr.items.length*100));
              const isNumDone  = kr.type==="numeric" && (kr.cur||0) >= (kr.target||1);
              const isCheckDone = kr.type==="checklist" && ((!kr.items?.length && kr._done) || (kr.items?.length>0 && kr.items.every(i=>i.done)));
              const isDone = isNumDone || isCheckDone;

              return (
                <div key={kr.id} style={{ background:"#111", borderRadius:14, border:`1px solid ${isDone?"#1a3a1a":"#1e1e1e"}`, marginBottom:8, overflow:"hidden" }}>
                  <div
                    style={{ padding:"13px 14px", display:"flex", alignItems:"center", gap:11, cursor: kr.type==="checklist"&&kr.items?.length>0 ? "pointer" : "default" }}
                    onClick={() => toggleOpenItems(kr.id, kr.type==="checklist" && kr.items?.length > 0)}
                  >
                    {/* 체크박스 */}
                    <div onClick={e=>{ e.stopPropagation(); toggleKRCheck(kr); }} style={{ width:22, height:22, borderRadius:7, border:isDone?"none":"2px solid #333", background:isDone?kr.color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, transition:"all .2s" }}>
                      {isDone&&<span style={{ color:"#000", fontWeight:900, fontSize:11 }}>✓</span>}
                    </div>
                    {/* 제목 & 프로그레스 */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:isDone?"#555":"#e0e0e0", textDecoration:isDone?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{kr.title}</div>
                      {/* 프로그레스 바 */}
                      <div style={{ marginTop:4 }}><PBar pct={kp} color={`linear-gradient(90deg,${kr.color},${kr.color}88)`} h={3}/></div>
                      {/* 체크형: 세부항목 개수 */}
                      {kr.type==="checklist"&&kr.items?.length>0&&(
                        <div style={{ fontSize:9, color:"#444", fontFamily:"'DM Mono',monospace", marginTop:2 }}>{kr.items.filter(i=>i.done).length}/{kr.items.length}개 {openItems.has(kr.id)?"▲":"▼"}</div>
                      )}
                    </div>
                    {/* 퍼센트 */}
                    <div style={{ fontSize:11, color:kr.color, fontFamily:"'DM Mono',monospace", fontWeight:700, flexShrink:0 }}>{kp}%</div>
                    {/* › 화살표 → 상세 시트 열기 */}
                    <div onClick={e=>{ e.stopPropagation(); setDetailKR(kr); }} style={{ width:22, height:22, borderRadius:7, background:"#1a1a1a", border:"1px solid #252525", color:"#555", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, cursor:"pointer" }}>›</div>
                  </div>
                  {/* 수치형: 인라인 슬라이더 */}
                  {kr.type==="numeric" && !isNumDone && (
                    <NumericSlider kr={kr}/>
                  )}
                  {/* 수치형 완료 표시 */}
                  {kr.type==="numeric" && isNumDone && (
                    <div style={{ padding:"0 14px 10px" }}>
                      <span style={{ fontSize:10, color:kr.color, fontFamily:"'DM Mono',monospace" }}>{kr.cur}/{kr.target}{kr.unit} 달성 🎉</span>
                    </div>
                  )}
                  {/* 체크형: 세부항목 인라인 패널 */}
                  {kr.type==="checklist" && openItems.has(kr.id) && kr.items?.length>0 && (
                    <div style={{ padding:"0 14px 12px", borderTop:"1px solid #1a1a1a" }}>
                      {kr.items.map(item=>(
                        <div key={item.id} onClick={e=>{ e.stopPropagation(); onUpdateKR({...kr, items:kr.items.map(i=>i.id===item.id?{...i,done:!i.done}:i)}); }}
                          style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 0", borderBottom:"1px solid #141414", cursor:"pointer" }}>
                          <div style={{ width:17, height:17, borderRadius:5, border:item.done?"none":"2px solid #333", background:item.done?kr.color:"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .2s" }}>
                            {item.done&&<span style={{ color:"#000", fontWeight:900, fontSize:9 }}>✓</span>}
                          </div>
                          <span style={{ fontSize:12, color:item.done?"#555":"#ccc", textDecoration:item.done?"line-through":"none" }}>{item.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* 인라인 입력창 */}
            <div ref={inputWrap}>
              {krInputs.map((inp)=>(
                <div key={inp.id} style={{ background:"#0f1a0f", borderRadius:14, border:"1.5px solid #22C55E44", marginBottom:8, padding:"11px 14px", display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:22, height:22, borderRadius:7, border:"2px solid #333", background:"transparent", flexShrink:0 }}/>
                  <input
                    ref={el=>{ if(el)krRefs.current[inp.id]=el; }}
                    value={inp.text}
                    onChange={e=>updateInput(inp.id, e.target.value)}
                    onKeyDown={e=>handleKeyDown(e, inp.id, inp.text)}
                    onBlur={()=>commitInput(inp.id, inp.text)}
                    placeholder="핵심목표 입력 후 Enter…"
                    style={{ ...INP, marginBottom:0, background:"transparent", border:"none", padding:0, fontSize:13, flex:1 }}
                    autoFocus
                  />
                  <button onClick={()=>removeInput(inp.id)} style={{ background:"none", border:"none", color:"#444", fontSize:16, cursor:"pointer", padding:"0 4px" }}>×</button>
                </div>
              ))}
            </div>

            {!krs.length&&!krInputs.length&&<div style={{ textAlign:"center", color:"#333", fontSize:12, padding:"20px 0" }}>아래 + 버튼으로 핵심목표를 추가하세요</div>}
          </>
        )}

        {/* ── 일일히스토리 탭 (진행중 / 완료 섹션) ── */}
        {ptab==="일일히스토리" && (
          <>
            {/* 진행중 섹션 */}
            <div style={{ marginBottom:16 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#F59E0B" }}/>
                <span style={{ fontSize:12, fontWeight:700, color:"#F59E0B" }}>진행중</span>
                <span style={{ fontSize:10, color:"#444", fontFamily:"'DM Mono',monospace" }}>{inProgress.length}개</span>
              </div>
              {inProgress.length === 0 && (
                <div style={{ textAlign:"center", color:"#2a2a2a", fontSize:12, padding:"12px 0" }}>진행중인 할 일 없음</div>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {inProgress.map(t=>(
                  <SwipeRow key={t.id} onDelete={()=>delTask(t.id)} onEdit={()=>setAddTask({editTask:t})}>
                    <div onClick={()=>toggleTask(t.id)} style={{ background:"#111", borderRadius:11, padding:"10px 13px", border:"1px solid #1e1e1e", display:"flex", alignItems:"center", gap:9, cursor:"pointer" }}>
                      <div style={{ width:20, height:20, borderRadius:"50%", background:"transparent", border:"2px solid #333", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, color:"#ddd" }}>{t.text}</div>
                        <div style={{ fontSize:10, color:"#444", marginTop:1, fontFamily:"'DM Mono',monospace" }}>{fmtShort(t.date)||"날짜 미정"}</div>
                      </div>
                      <div style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background:(TC[t.tag]||"#333")+"20", color:TC[t.tag]||"#888" }}>{t.tag}</div>
                    </div>
                  </SwipeRow>
                ))}
              </div>
            </div>

            {/* 구분선 */}
            <div style={{ height:1, background:"#1a1a1a", marginBottom:16 }}/>

            {/* 완료 섹션 */}
            <div style={{ marginBottom:12 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#22C55E" }}/>
                <span style={{ fontSize:12, fontWeight:700, color:"#22C55E" }}>완료</span>
                <span style={{ fontSize:10, color:"#444", fontFamily:"'DM Mono',monospace" }}>{completed.length}개</span>
              </div>
              {completed.length === 0 && (
                <div style={{ textAlign:"center", color:"#2a2a2a", fontSize:12, padding:"12px 0" }}>완료한 할 일 없음</div>
              )}
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {completed.map(t=>(
                  <SwipeRow key={t.id} onDelete={()=>delTask(t.id)} onEdit={()=>setAddTask({editTask:t})}>
                    <div onClick={()=>toggleTask(t.id)} style={{ background:"#0c1a0c", borderRadius:11, padding:"10px 13px", border:"1px solid #1a3a1a", display:"flex", alignItems:"center", gap:9, cursor:"pointer" }}>
                      <div style={{ width:20, height:20, borderRadius:"50%", background:"#22C55E", border:"none", display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, flexShrink:0 }}>
                        <span style={{ color:"#000", fontWeight:900 }}>✓</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, color:"#555", textDecoration:"line-through" }}>{t.text}</div>
                        <div style={{ fontSize:10, color:"#444", marginTop:1, fontFamily:"'DM Mono',monospace" }}>{fmtShort(t.date)||"날짜 미정"}</div>
                      </div>
                      <div style={{ fontSize:10, padding:"2px 7px", borderRadius:20, background:(TC[t.tag]||"#333")+"20", color:TC[t.tag]||"#888" }}>{t.tag}</div>
                    </div>
                  </SwipeRow>
                ))}
              </div>
            </div>

            <button onClick={()=>setAddTask({lpid:p.id,period:"daily"})} style={{ width:"100%", marginTop:4, padding:10, background:"#0f0f0f", border:"1.5px dashed #222", borderRadius:11, color:"#444", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>+ 일일 할 일 추가</button>
          </>
        )}

        {/* ── 루틴통계 탭 (기존 방식 유지) ── */}
        {ptab==="루틴통계" && (
          <>
            <div style={{ display:"flex", gap:7, marginBottom:12 }}>
              <select value={rYear} onChange={e=>setRYear(parseInt(e.target.value))} style={{ ...INP, marginBottom:0, flex:1, padding:"7px 9px" }}>
                {[NOW_Y-1,NOW_Y,NOW_Y+1].map(y=><option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={rMon} onChange={e=>setRMon(parseInt(e.target.value))} style={{ ...INP, marginBottom:0, flex:1, padding:"7px 9px" }}>
                {MO.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            {routines.length===0&&<div style={{ textAlign:"center", color:"#333", fontSize:12, padding:16 }}>생성된 루틴이 없어요</div>}
            {routines.length>0&&(()=>{
              const md=mDates(rYear,rMon);
              const fdRaw=new Date(rYear,rMon-1,1).getDay(), fdMon=fdRaw===0?6:fdRaw-1;
              return (
                <div style={{ background:"#111", borderRadius:14, padding:12, border:"1px solid #1e1e1e", overflowX:"auto" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"80px repeat(7,1fr)", gap:3, marginBottom:5 }}>
                    <div/>{DL.map(d=><div key={d} style={{ textAlign:"center", fontSize:9, color:"#444" }}>{d}</div>)}
                  </div>
                  {routines.map(task=>{
                    const color=TC[task.tag]||"#6B7280";
                    const cells=[]; for(let i=0;i<fdMon;i++)cells.push(null);
                    md.forEach(d=>cells.push(doneDateCheck(task,d)));
                    while(cells.length%7!==0)cells.push(null);
                    const rows=[]; for(let r=0;r<cells.length/7;r++)rows.push(cells.slice(r*7,(r+1)*7));
                    return rows.map((row,ri)=>(
                      <div key={task.id+"-"+ri} style={{ display:"grid", gridTemplateColumns:"80px repeat(7,1fr)", gap:3, marginBottom:3 }}>
                        {ri===0?<div style={{ fontSize:9, color:"#aaa", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:3 }}><div style={{ width:5, height:5, borderRadius:"50%", background:color, flexShrink:0 }}/>{task.text}</div>:<div/>}
                        {row.map((isDone,ci)=>(
                          <div key={ci} style={{ aspectRatio:"1", borderRadius:3, background:isDone===null?"transparent":isDone?color+"cc":"#1e1e1e", border:isDone===null?"none":`1px solid ${isDone?color+"44":"#252525"}` }}/>
                        ))}
                      </div>
                    ));
                  })}
                </div>
              );
            })()}
            <button onClick={()=>setAddTask({lpid:p.id,period:"routine"})} style={{ width:"100%", marginTop:10, padding:10, background:"#0f0f0f", border:"1.5px dashed #222", borderRadius:11, color:"#444", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>+ 루틴 생성</button>
          </>
        )}
      </div>

      {/* 하단 + 버튼 (핵심목표 탭) */}
      {ptab==="핵심목표"&&(
        <button onClick={()=>addInputRow()} style={{ position:"fixed", bottom:28, right:"calc(50% - 195px + 18px)", width:52, height:52, borderRadius:"50%", background:"linear-gradient(135deg,#22C55E,#16A34A)", border:"none", cursor:"pointer", fontSize:24, color:"#000", fontWeight:900, boxShadow:"0 4px 20px rgba(34,197,94,.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:20 }}>+</button>
      )}

      {/* KR 상세 Bottom Sheet */}
      {detailKR && (
        <KRDetailSheet
          kr={detailKR}
          onClose={()=>setDetailKR(null)}
          onUpdate={(updated)=>{ onUpdateKR(updated); setDetailKR(prev=>({...prev,...updated})); }}
          onDelete={()=>{ onDelKR(detailKR.id); setDetailKR(null); }}
          projColor={GC[p.gi]}
        />
      )}
    </div>
  );
}

/* ═══ MINI CALENDAR ════════════════════════════════════════════════════════ */
function MiniCal({ year, month, selDate, setSelDate, data, routineVisible }) {
  const dim=new Date(year,month,0).getDate(), fd=new Date(year,month-1,1).getDay();
  const days=Array.from({length:dim},(_,i)=>`${year}-${String(month).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`);
  const WD=["일","월","화","수","목","금","토"];
  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:4 }}>
        {WD.map((d,i)=><div key={d} style={{ textAlign:"center", fontSize:10, color:i===0?"#ef6060":i===6?"#6090ef":"#444", padding:"3px 0" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"3px 2px" }}>
        {Array(fd).fill(null).map((_,i)=><div key={"e"+i}/>)}
        {days.map(d=>{
          const isSel=d===selDate, isT=d===todayStr();
          const dow=new Date(d+"T00:00:00").getDay();
          const hasEv=data.events.filter(e=>e.date===d).length>0;
          const hasTask=data.tasks.filter(t=>t.period==="daily"&&t.date===d).length>0||data.tasks.filter(t=>t.period==="routine"&&routineVisible(t,d)).length>0;
          const hasDiary=data.diaries.some(x=>x.date===d);
          return (
            <div key={d} onClick={()=>setSelDate(d)} style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"4px 0", cursor:"pointer", borderRadius:9, background:isSel?"#22C55E":isT?"#1a2a1a":"transparent", border:isT&&!isSel?"1px solid #22C55E44":"none" }}>
              <span style={{ fontSize:13, fontWeight:isSel||isT?800:400, color:isSel?"#000":isT?"#22C55E":dow===0?"#ef6060":dow===6?"#6090ef":"#ccc" }}>{parseInt(d.slice(8))}</span>
              <div style={{ display:"flex", gap:2, marginTop:1, minHeight:5 }}>
                {hasTask&&<div style={{ width:4, height:4, borderRadius:"50%", background:isSel?"#000":"#22C55E" }}/>}
                {hasEv&&<div style={{ width:4, height:4, borderRadius:"50%", background:isSel?"#000":"#F59E0B" }}/>}
                {hasDiary&&<div style={{ width:4, height:4, borderRadius:"50%", background:isSel?"#000":"#EC4899" }}/>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ MAIN APP ══════════════════════════════════════════════════════════════ */
export default function App() {
  const [data, setData] = useState(()=>load()||makeInit());
  const [tab,  setTab]  = useState("홈");
  const [flash, setFlash] = useState(null);
  const [conf,  setConf]  = useState(null);

  const [showPay,    setShowPay]    = useState(false);
  const [actProj,    setActProj]    = useState(null);
  const [addTaskCfg, setAddTaskCfg] = useState(null);
  const [editEvt,    setEditEvt]    = useState(null);
  const [evDate,     setEvDate]     = useState(todayStr());
  const [evTitle,    setEvTitle]    = useState("");
  const [evTime,     setEvTime]     = useState("");
  const [evColor,    setEvColor]    = useState("#3B82F6");
  const [actDiary,   setActDiary]   = useState(null);

  const [selDate,    setSelDate]    = useState(todayStr());
  const [taskFilter, setTaskFilter] = useState("일일");
  const [calView,    setCalView]    = useState("slider");
  const dateBarRef = useRef(null);

  const [histTab,  setHistTab]  = useState("프로젝트");
  const [histYear, setHistYear] = useState(NOW_Y);
  const [histMon,  setHistMon]  = useState(NOW_M);
  const [projFilter,setProjFilter]=useState("진행중");

  const [expFilter, setExpFilter] = useState("전체");

  const [settName, setSettName] = useState(data.profile.name);
  const [settAv,   setSettAv]   = useState(data.profile.avatar);

  const [showAddP,setShowAddP]=useState(false);
  const [npTitle,setNpTitle]=useState(""); const [npEmoji,setNpEmoji]=useState("🎯"); const [npGi,setNpGi]=useState(0); const [npDays,setNpDays]=useState("30"); const [npDesc,setNpDesc]=useState("");

  useEffect(()=>{ save(data); },[data]);
  useEffect(()=>{
    if(dateBarRef.current){
      const el=dateBarRef.current.querySelector("[data-today='true']");
      if(el)el.scrollIntoView({inline:"center",behavior:"smooth"});
    }
  },[tab,calView]);

  const mut=fn=>setData(prev=>{const next=JSON.parse(JSON.stringify(prev));fn(next);return next;});

  const selY=parseInt(selDate.slice(0,4)), selM=parseInt(selDate.slice(5,7));

  const routineVisible=(task,date)=>{
    const{startDate,endDate}=task;
    if(!startDate&&!endDate)return true;
    if(startDate&&!endDate)return date>=startDate;
    if(startDate&&endDate)return date>=startDate&&date<=endDate;
    return true;
  };
  const dailyOnDate   =date=>data.tasks.filter(t=>t.period==="daily"&&t.date===date);
  const routinesOnDate=date=>data.tasks.filter(t=>t.period==="routine"&&routineVisible(t,date));
  const routineDone   =(task,date)=>!!(task.completedDates&&task.completedDates.includes(date));

  const forFilter=(f,date)=>{
    const d=date||todayStr();
    if(f==="일일")return data.tasks.filter(t=>t.period==="daily"&&t.date===d);
    return data.tasks.filter(t=>t.period==="routine"&&routineVisible(t,d));
  };
  const filterPct=(f,date)=>{
    const d=date||todayStr(); const ts=forFilter(f,d); if(!ts.length)return{done:0,total:0,pct:0};
    const done=f==="루틴"?ts.filter(t=>routineDone(t,d)).length:ts.filter(t=>t.completed).length;
    return{done,total:ts.length,pct:Math.round(done/ts.length*100)};
  };
  const krPct=kr=>{
    if(kr.type==="numeric")return Math.min(100,Math.round((kr.cur||0)/kr.target*100));
    if(!kr.items||!kr.items.length)return kr._done?100:0;
    return Math.round(kr.items.filter(i=>i.done).length/kr.items.length*100);
  };
  const pctColor=pct=>pct>=67?"#22C55E":pct>=34?"#F59E0B":"#EF4444";
  const pctGrad =pct=>pct>=67?"linear-gradient(90deg,#22C55E,#86EFAC)":pct>=34?"linear-gradient(90deg,#F59E0B,#FBBF24)":"linear-gradient(90deg,#EF4444,#F87171)";
  const projPct=pid=>{
    const krs=data.krs.filter(k=>k.pid===pid); if(!krs.length)return 0;
    return Math.round(krs.reduce((a,k)=>a+krPct(k),0)/krs.length);
  };
  const todayPts=()=>{
    const daily=dailyOnDate(todayStr()); const routines=routinesOnDate(todayStr());
    const done=daily.filter(t=>t.completed).reduce((a,t)=>a+t.pts,0)+routines.filter(t=>routineDone(t,todayStr())).reduce((a,t)=>a+t.pts,0);
    const total=[...daily,...routines].reduce((a,t)=>a+t.pts,0);
    return{done,total};
  };
  const doneOnDate=(task,date)=>task.period==="routine"?!!(task.completedDates&&task.completedDates.includes(date)):(task.date===date&&!!task.completed);
  const getMonthDates=(y,m)=>{const dim=new Date(y,m,0).getDate();return Array.from({length:dim},(_,i)=>`${y}-${String(m).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`);};

  /* ── actions ── */
  const toggleTask=(id,targetDate)=>{
    const dt=targetDate||todayStr(); let delta=0;
    mut(d=>{
      const t=d.tasks.find(x=>x.id===id); if(!t)return;
      if(t.period==="routine"){
        t.completedDates=t.completedDates||[];
        const idx=t.completedDates.indexOf(dt);
        if(idx>=0){t.completedDates.splice(idx,1);delta=-t.pts;}
        else{t.completedDates.push(dt);delta=t.pts;}
      }else{t.completed=!t.completed;delta=t.completed?t.pts:-t.pts;}
    });
    if(delta>0){setFlash(`+${delta}pt 🎉`);mut(d=>{d.profile.pts+=delta;});}
  };
  const addTask=cfg=>{
    let task;
    if(cfg.period==="routine")task={id:uid(),lpid:cfg.lpid||null,text:cfg.text,period:"routine",startDate:cfg.startDate||null,endDate:cfg.endDate||null,time:cfg.time||"",tag:cfg.tag,pts:cfg.pts,completedDates:[],subs:[]};
    else task={id:uid(),lpid:cfg.lpid||null,text:cfg.text,period:"daily",date:cfg.date||todayStr(),time:cfg.time||"",completed:false,tag:cfg.tag,pts:cfg.pts,subs:[]};
    mut(d=>d.tasks.push(task));
    setFlash("할 일 추가됨 ✅");
  };
  const delTask=id=>setConf({msg:"이 할 일을 삭제할까요?",onYes:()=>{mut(d=>{d.tasks=d.tasks.filter(t=>t.id!==id);});setConf(null);}});
  const editTask=(updated)=>mut(d=>{const idx=d.tasks.findIndex(t=>t.id===updated.id);if(idx>=0)d.tasks[idx]={...d.tasks[idx],...updated};});

  const addProject=()=>{
    if(!npTitle.trim())return;
    mut(d=>d.projects.push({id:uid(),title:npTitle.trim(),emoji:npEmoji,gi:npGi,streak:0,dLeft:parseInt(npDays)||30,createdAt:todayStr(),desc:npDesc.trim(),done:false,doneAt:null}));
    setNpTitle("");setNpEmoji("🎯");setNpGi(0);setNpDays("30");setNpDesc("");setShowAddP(false);
  };
  const delProject=pid=>setConf({msg:"프로젝트를 삭제할까요?",onYes:()=>{mut(d=>{d.projects=d.projects.filter(p=>p.id!==pid);d.krs=d.krs.filter(k=>k.pid!==pid);});setActProj(null);setConf(null);}});
  const doneProject=pid=>setConf({msg:"프로젝트를 완료 처리할까요?",onYes:()=>{mut(d=>{const p=d.projects.find(x=>x.id===pid);if(p){p.done=true;p.doneAt=todayStr();}});setActProj(null);setConf(null);setFlash("프로젝트 완료! 🏆");}});

  const addKR=kr=>mut(d=>d.krs.push(kr));
  const updateKR=(updated)=>mut(d=>{const idx=d.krs.findIndex(x=>x.id===updated.id);if(idx>=0)d.krs[idx]={...d.krs[idx],...updated};});
  const delKR=id=>setConf({msg:"핵심목표를 삭제할까요?",onYes:()=>{mut(d=>{d.krs=d.krs.filter(k=>k.id!==id);});setConf(null);}});

  const saveEvent=()=>{
    if(!evTitle.trim())return;
    mut(d=>{
      if(editEvt&&editEvt!=="new"){const e=d.events.find(x=>x.id===editEvt.id);if(e){e.title=evTitle;e.date=evDate;e.time=evTime;e.color=evColor;}}
      else d.events.push({id:uid(),title:evTitle,date:evDate,time:evTime,color:evColor});
    });
    setEvTitle("");setEvDate(todayStr());setEvTime("");setEvColor("#3B82F6");setEditEvt(null);
  };
  const delEvent=id=>setConf({msg:"이 이벤트를 삭제할까요?",onYes:()=>{mut(d=>{d.events=d.events.filter(e=>e.id!==id);});setConf(null);}});

  const saveDiary=(date,fields)=>{
    mut(d=>{const idx=d.diaries.findIndex(x=>x.date===date);const entry={id:idx>=0?d.diaries[idx].id:uid(),date,...fields,pts:0};if(idx>=0)d.diaries[idx]=entry;else d.diaries.push(entry);});
    setActDiary(null);
  };
  const delDiary=date=>setConf({msg:"일기를 삭제할까요?",onYes:()=>{mut(d=>{d.diaries=d.diaries.filter(x=>x.date!==date);});setConf(null);}});

  const importTpl=tpl=>{
    const pid=uid();
    mut(d=>{
      d.projects.push({id:pid,title:tpl.title,emoji:tpl.emoji,gi:tpl.gi,streak:0,dLeft:tpl.days,createdAt:todayStr(),desc:tpl.desc,done:false,doneAt:null});
      tpl.krs.forEach(kr=>{
        const k={id:uid(),pid,title:kr.title,type:"checklist",color:kr.color,memo:"",items:(kr.items||[]).map(text=>({id:uid(),text,done:false}))};
        d.krs.push(k);
      });
    });
    setFlash("템플릿 추가됨 🎯");
  };

  /* ── TaskRow ── */
  const TaskRow=({task,selDate:sd})=>{
    const lp=task.lpid?data.projects.find(p=>p.id===task.lpid):null;
    const checkDate=sd||todayStr();
    const isDone=task.period==="routine"?routineDone(task,checkDate):!!task.completed;
    return (
      <SwipeRow onDelete={()=>delTask(task.id)} onEdit={()=>setAddTaskCfg({editTask:task})}>
        <div style={{ background:isDone?"#0c1a0c":"#111", borderRadius:12, border:isDone?"1px solid #1a3a1a":"1px solid #1e1e1e", overflow:"hidden" }}>
          <div style={{ padding:"9px 12px", display:"flex", alignItems:"center", gap:10, cursor:"pointer" }} onClick={()=>toggleTask(task.id,checkDate)}>
            <div style={{ width:20, height:20, borderRadius:"50%", border:isDone?"none":"2px solid #2a2a2a", background:isDone?"#22C55E":"transparent", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, flexShrink:0 }}>
              {isDone&&<span style={{ color:"#000", fontWeight:900 }}>✓</span>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:13, fontWeight:500, color:isDone?"#4a4a4a":"#e0e0e0", textDecoration:isDone?"line-through":"none", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.text}</div>
              <div style={{ display:"flex", gap:5, marginTop:1, alignItems:"center" }}>
                {task.time&&<span style={{ fontSize:10, color:"#444" }}>{task.time}</span>}
                {lp&&<span style={{ fontSize:9, background:GC[lp.gi]+"22", color:GC[lp.gi], padding:"1px 6px", borderRadius:7, fontWeight:600 }}>📌 {lp.title}</span>}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:2, flexShrink:0 }}>
              <div style={{ fontSize:10, padding:"2px 7px", borderRadius:18, background:(TC[task.tag]||"#333")+"20", color:TC[task.tag]||"#888", fontWeight:700 }}>{task.tag}</div>
              <div style={{ fontSize:9, color:"#333", fontFamily:"'DM Mono',monospace" }}>+{task.pts}pt</div>
            </div>
          </div>
        </div>
      </SwipeRow>
    );
  };

  const {done:ptsDone, total:ptsTotal} = todayPts();
  const activeProjs=data.projects.filter(p=>!p.done);
  const doneProjs=data.projects.filter(p=>p.done);

  /* ── HOME ── */
  const renderHome=()=>{
    const pct=ptsTotal?Math.round(ptsDone/ptsTotal*100):0;
    const daily=filterPct("일일",selDate), routine=filterPct("루틴",selDate);
    const selDiary=data.diaries.find(d=>d.date===selDate);
    const isToday=selDate===todayStr();
    const monthDates=getMonthDates(selY,selM);

    const goMonth=dir=>{
      const d=new Date(selY,selM-1+dir,1);
      setSelDate(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`);
    };

    return (
      <>
        <div style={{ padding:"14px 18px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontSize:10, color:"#2a2a2a", letterSpacing:2, textTransform:"uppercase", fontFamily:"'DM Mono',monospace" }}>{fmtFull(todayStr())}</div>
              <div style={{ fontSize:19, fontWeight:900, marginTop:3, letterSpacing:-0.5 }}>오늘도 성장해요 🔥</div>
            </div>
            <div style={{ background:"#111", borderRadius:12, padding:"6px 10px", border:"1px solid #1e1e1e", textAlign:"center", cursor:"pointer" }} onClick={()=>setShowPay(true)}>
              <div style={{ fontSize:9, color:"#444", fontFamily:"'DM Mono',monospace" }}>LV.{data.profile.lv}</div>
              <div style={{ fontSize:20 }}>{data.profile.avatar}</div>
              <div style={{ fontSize:9, color:"#22C55E", fontWeight:700, fontFamily:"'DM Mono',monospace" }}>{data.profile.pts}pt</div>
            </div>
          </div>
          <div style={{ marginTop:9, background:"#111", borderRadius:12, padding:"9px 13px", border:"1px solid #1e1e1e" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#555", marginBottom:5 }}>
              <span>⚡ 오늘 포인트</span>
              <span style={{ color:"#22C55E", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{ptsDone}/{ptsTotal}pt ({pct}%)</span>
            </div>
            <PBar pct={pct} color={pctGrad(pct)} h={5}/>
          </div>
        </div>

        <div style={{ padding:"9px 18px 0", display:"flex", gap:7 }}>
          {[["일일",daily],["루틴",routine]].map(([label,prog])=>(
            <div key={label} onClick={()=>setTaskFilter(label)} style={{ flex:1, background:"#111", borderRadius:11, padding:"8px 11px", border:"1px solid #1e1e1e", cursor:"pointer" }}>
              <div style={{ fontSize:9, color:"#444", marginBottom:2, fontFamily:"'DM Mono',monospace" }}>{label}</div>
              <div style={{ fontSize:17, fontWeight:900, color:pctColor(prog.pct), fontFamily:"'DM Mono',monospace" }}>{prog.pct}%</div>
              <div style={{ fontSize:9, color:"#333" }}>{prog.done}/{prog.total}</div>
              <PBar pct={prog.pct} color={pctGrad(prog.pct)} h={2}/>
            </div>
          ))}
        </div>

        {/* 목표 */}
        <div style={{ marginTop:14, padding:"0 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
            <div style={{ fontSize:13, fontWeight:800 }}>📌 목표</div>
            <button onClick={()=>setShowAddP(true)} style={{ fontSize:11, color:"#22C55E", background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>+ 추가</button>
          </div>
          <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:3 }}>
            {activeProjs.map(p=>{
              const pct2=projPct(p.id);
              return (
                <div key={p.id} onClick={()=>setActProj(p)} style={{ flexShrink:0, width:82, cursor:"pointer" }}>
                  <div style={{ width:82, height:82, borderRadius:14, background:GRADS[p.gi], display:"flex", alignItems:"center", justifyContent:"center", fontSize:28, position:"relative", marginBottom:5 }}>
                    {p.emoji}
                    <div style={{ position:"absolute", bottom:4, right:4, background:"rgba(0,0,0,.55)", borderRadius:9, padding:"1px 5px", fontSize:9, fontFamily:"'DM Mono',monospace", color:"#fff" }}>{pct2}%</div>
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color:"#e0e0e0" }}>{p.title}</div>
                  <div style={{ fontSize:9, color:"#555", fontFamily:"'DM Mono',monospace" }}>🔥{p.streak}·D-{p.dLeft}</div>
                  <PBar pct={pct2} color={GRADS[p.gi]} h={2}/>
                </div>
              );
            })}
            {!activeProjs.length&&<div style={{ fontSize:12, color:"#333", padding:"8px 0" }}>프로젝트 없음</div>}
            <div onClick={()=>setShowAddP(true)} style={{ flexShrink:0, width:82, height:82, background:"#0a0a0a", borderRadius:14, border:"1.5px dashed #222", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
              <span style={{ fontSize:20, color:"#2a2a2a" }}>+</span>
            </div>
          </div>
        </div>

        {/* 날짜/캘린더 섹션 */}
        <div style={{ marginTop:16, padding:"0 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:9 }}>
            <div style={{ fontSize:13, fontWeight:800 }}>📋 할 일 & 일정</div>
            <div style={{ display:"flex", gap:5 }}>
              <button onClick={()=>setCalView("slider")} style={{ padding:"4px 10px", borderRadius:8, border:"none", cursor:"pointer", fontSize:11, fontWeight:700, background:calView==="slider"?"#22C55E":"#1a1a1a", color:calView==="slider"?"#000":"#555" }}>━</button>
              <button onClick={()=>setCalView("month")}  style={{ padding:"4px 10px", borderRadius:8, border:"none", cursor:"pointer", fontSize:11, fontWeight:700, background:calView==="month"?"#22C55E":"#1a1a1a",  color:calView==="month"?"#000":"#555"  }}>⊞</button>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:9 }}>
            <button onClick={()=>goMonth(-1)} style={{ background:"#1a1a1a", border:"none", color:"#888", fontSize:13, cursor:"pointer", borderRadius:7, padding:"4px 10px" }}>‹</button>
            <select value={selY} onChange={e=>{ const y=parseInt(e.target.value); setSelDate(`${y}-${String(selM).padStart(2,"0")}-01`); }} style={{ ...INP, marginBottom:0, flex:1, padding:"5px 8px", fontSize:12 }}>
              {[NOW_Y-1,NOW_Y,NOW_Y+1].map(y=><option key={y} value={y}>{y}년</option>)}
            </select>
            <select value={selM} onChange={e=>{ const m=parseInt(e.target.value); setSelDate(`${selY}-${String(m).padStart(2,"0")}-01`); }} style={{ ...INP, marginBottom:0, flex:1, padding:"5px 8px", fontSize:12 }}>
              {MO.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
            </select>
            <button onClick={()=>goMonth(1)}  style={{ background:"#1a1a1a", border:"none", color:"#888", fontSize:13, cursor:"pointer", borderRadius:7, padding:"4px 10px" }}>›</button>
          </div>

          {calView==="slider" && (
            <div ref={dateBarRef} style={{ display:"flex", gap:4, overflowX:"auto", paddingBottom:3, marginBottom:10 }}>
              {getMonthDates(selY,selM).map(d=>{
                const isT=d===todayStr(),isSel=d===selDate;
                const hasTask=data.tasks.filter(t=>t.period==="daily"&&t.date===d).length>0||data.tasks.filter(t=>t.period==="routine"&&routineVisible(t,d)).length>0;
                const hasEv=data.events.filter(e=>e.date===d).length>0;
                return (
                  <div key={d} data-today={isT?"true":"false"} onClick={()=>setSelDate(d)}
                    style={{ flexShrink:0, width:38, padding:"5px 0", borderRadius:10, textAlign:"center", cursor:"pointer", background:isSel?"#22C55E":isT?"#1a2a1a":"#111", border:isT&&!isSel?"1px solid #22C55E44":"1px solid #1e1e1e" }}>
                    <div style={{ fontSize:8, color:isSel?"#000":isT?"#22C55E":"#444", fontFamily:"'DM Mono',monospace", marginBottom:2 }}>{dayLabel(d)}</div>
                    <div style={{ fontSize:12, fontWeight:isSel||isT?800:400, color:isSel?"#000":isT?"#22C55E":"#bbb" }}>{parseInt(d.slice(8))}</div>
                    {(hasTask||hasEv)&&<div style={{ display:"flex", gap:2, justifyContent:"center", marginTop:2 }}>
                      {hasTask&&<div style={{ width:3, height:3, borderRadius:"50%", background:isSel?"#000":"#22C55E" }}/>}
                      {hasEv&&<div style={{ width:3, height:3, borderRadius:"50%", background:isSel?"#000":"#F59E0B" }}/>}
                    </div>}
                  </div>
                );
              })}
            </div>
          )}

          {calView==="month" && (
            <div style={{ marginBottom:10 }}>
              <MiniCal year={selY} month={selM} selDate={selDate} setSelDate={setSelDate} data={data} routineVisible={routineVisible}/>
            </div>
          )}

          <div style={{ display:"flex", gap:7, marginBottom:9 }}>
            {["일일","루틴"].map(f=>(
              <button key={f} onClick={()=>setTaskFilter(f)} style={{ padding:"6px 16px", borderRadius:18, border:"none", cursor:"pointer", fontSize:12, fontWeight:700, background:taskFilter===f?"#22C55E":"#111", color:taskFilter===f?"#000":"#555" }}>{f}</button>
            ))}
          </div>

          {(()=>{ const prog=filterPct(taskFilter,selDate); return (
            <div style={{ background:"#111", borderRadius:11, padding:"8px 12px", border:"1px solid #1e1e1e", marginBottom:9 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#555", marginBottom:4 }}>
                <span>{taskFilter} 달성률 · {fmtShort(selDate)}</span>
                <span style={{ color:"#22C55E", fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{prog.done}/{prog.total} ({prog.pct}%)</span>
              </div>
              <PBar pct={prog.pct} h={4}/>
            </div>
          ); })()}

          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {forFilter(taskFilter,selDate).map(t=><TaskRow key={t.id} task={t} selDate={selDate}/>)}
            {!forFilter(taskFilter,selDate).length&&<div style={{ textAlign:"center", color:"#333", fontSize:12, padding:"14px 0" }}>{isToday?"할 일 없음 — 추가해보세요!":fmtShort(selDate)+" 할 일 없음"}</div>}
          </div>
          <button onClick={()=>setAddTaskCfg({initDate:selDate,initPeriod:taskFilter==="루틴"?"routine":"daily",initLpid:null})}
            style={{ width:"100%", marginTop:7, padding:9, background:"#0f0f0f", border:"1.5px dashed #222", borderRadius:11, color:"#333", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
            + 할 일 추가
          </button>

          {(()=>{
            const selEvs=data.events.filter(e=>e.date===selDate).sort((a,b)=>(a.time||"").localeCompare(b.time||""));
            return (
              <div style={{ marginTop:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#666" }}>🗓 {fmtShort(selDate)} 이벤트</div>
                  <button onClick={()=>{ setEvDate(selDate); setEvTitle(""); setEvTime(""); setEvColor("#3B82F6"); setEditEvt("new"); }} style={{ fontSize:11, color:"#22C55E", background:"none", border:"none", cursor:"pointer", fontWeight:700 }}>+ 추가</button>
                </div>
                {selEvs.length===0&&<div style={{ fontSize:11, color:"#333", padding:"5px 0" }}>이벤트 없음</div>}
                {selEvs.map(e=>(
                  <SwipeRow key={e.id} onDelete={()=>delEvent(e.id)}>
                    <div style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 12px", background:"#111", borderRadius:11, marginBottom:5, cursor:"pointer" }} onClick={()=>{ setEvTitle(e.title); setEvDate(e.date); setEvTime(e.time||""); setEvColor(e.color); setEditEvt(e); }}>
                      <div style={{ width:4, height:36, borderRadius:3, background:e.color, flexShrink:0 }}/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:600, color:"#e0e0e0" }}>{e.title}</div>
                        {e.time&&<div style={{ fontSize:10, color:"#555", fontFamily:"'DM Mono',monospace" }}>{e.time}</div>}
                      </div>
                    </div>
                  </SwipeRow>
                ))}
              </div>
            );
          })()}
        </div>

        <div style={{ margin:"14px 18px 0" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
            <div style={{ fontSize:13, fontWeight:800 }}>📓 {isToday?"오늘의 일기":`${fmtShort(selDate)} 일기`}</div>
            {data.diaries.find(d=>d.date===selDate)&&<button onClick={()=>delDiary(selDate)} style={{ fontSize:11, color:"#5a2a2a", background:"none", border:"none", cursor:"pointer" }}>삭제</button>}
          </div>
          {data.diaries.find(d=>d.date===selDate)?(
            <div onClick={()=>setActDiary(selDate)} style={{ background:"#111", borderRadius:12, padding:13, border:"1px solid #1e1e1e", cursor:"pointer", display:"flex", alignItems:"center", gap:11 }}>
              <span style={{ fontSize:24 }}>{data.diaries.find(d=>d.date===selDate).mood}</span>
              <div style={{ flex:1 }}>
                {data.diaries.find(d=>d.date===selDate).good&&<div style={{ fontSize:12, color:"#888" }}>🌟 {data.diaries.find(d=>d.date===selDate).good.slice(0,30)}{data.diaries.find(d=>d.date===selDate).good.length>30?"…":""}</div>}
                <div style={{ fontSize:10, color:"#22C55E", fontFamily:"'DM Mono',monospace", marginTop:1 }}>기록됨</div>
              </div>
            </div>
          ):(
            <div onClick={()=>setActDiary(selDate)} style={{ background:"#111", borderRadius:12, padding:12, border:"1.5px dashed #222", cursor:"pointer", display:"flex", alignItems:"center", gap:11 }}>
              <span style={{ fontSize:22 }}>📝</span>
              <span style={{ fontSize:12, color:"#555" }}>{isToday?"오늘 하루 어땠나요?":fmtShort(selDate)+" 일기 작성"}</span>
            </div>
          )}
        </div>
        <div style={{ height:22 }}/>
      </>
    );
  };

  /* ── HISTORY ── */
  const renderHistory=()=>{
    const routines=data.tasks.filter(t=>t.period==="routine");
    const md=getMonthDates(histYear,histMon);
    const fdRaw=new Date(histYear,histMon-1,1).getDay(), fdMon=fdRaw===0?6:fdRaw-1;
    const pList=(projFilter==="진행중"?data.projects.filter(p=>!p.done):data.projects.filter(p=>p.done)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    return (
      <div style={{ padding:"16px 18px 0" }}>
        <div style={{ fontSize:16, fontWeight:800, marginBottom:12 }}>📊 기록</div>
        <div style={{ display:"flex", gap:7, marginBottom:12 }}>
          {["프로젝트","루틴"].map(h=>(
            <button key={h} onClick={()=>setHistTab(h)} style={{ padding:"6px 16px", borderRadius:18, border:"none", cursor:"pointer", fontSize:12, fontWeight:700, background:histTab===h?"#22C55E":"#111", color:histTab===h?"#000":"#555" }}>{h}</button>
          ))}
        </div>
        {histTab==="프로젝트"&&(
          <>
            <div style={{ display:"flex", gap:7, marginBottom:12 }}>
              {["진행중","완료"].map(f=>(
                <button key={f} onClick={()=>setProjFilter(f)} style={{ padding:"5px 14px", borderRadius:18, border:"none", cursor:"pointer", fontSize:11, fontWeight:700, background:projFilter===f?"#22C55E":"#161616", color:projFilter===f?"#000":"#555" }}>{f}</button>
              ))}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
              {pList.map(p=>{
                const krs=data.krs.filter(k=>k.pid===p.id); const op=projPct(p.id);
                return (
                  <div key={p.id} onClick={()=>setActProj(p)} style={{ background:"#111", borderRadius:14, border:"1px solid #1e1e1e", overflow:"hidden", cursor:"pointer" }}>
                    <div style={{ background:GRADS[p.gi], padding:"11px 13px", display:"flex", alignItems:"center", gap:9 }}>
                      <span style={{ fontSize:20 }}>{p.emoji}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:"#fff" }}>{p.title}</div>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,.7)" }}>{p.done?`완료 · ${fmtShort(p.doneAt)}`:`D-${p.dLeft} · 🔥${p.streak}일`}</div>
                      </div>
                      <div style={{ fontSize:18, fontWeight:900, color:"#fff", fontFamily:"'DM Mono',monospace" }}>{op}%</div>
                    </div>
                    <div style={{ padding:"10px 13px" }}>
                      <PBar pct={op} color={GRADS[p.gi]} h={4}/>
                      {krs.map(kr=>{ const kp=krPct(kr); return (
                        <div key={kr.id} style={{ marginTop:7 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                            <div style={{ width:6, height:6, borderRadius:"50%", background:kr.color, flexShrink:0 }}/>
                            <span style={{ fontSize:11, color:"#aaa", flex:1 }}>{kr.title}</span>
                            <span style={{ fontSize:11, color:kr.color, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{kp}%</span>
                          </div>
                          <div style={{ paddingLeft:12 }}><PBar pct={kp} color={kr.color} h={3}/></div>
                        </div>
                      ); })}
                    </div>
                  </div>
                );
              })}
              {!pList.length&&<div style={{ textAlign:"center", color:"#333", fontSize:12, padding:"20px 0" }}>{projFilter==="완료"?"완료한 프로젝트 없음":"진행 중인 프로젝트 없음"}</div>}
            </div>
          </>
        )}
        {histTab==="루틴"&&(
          <>
            <div style={{ display:"flex", gap:7, marginBottom:10 }}>
              <select value={histYear} onChange={e=>setHistYear(parseInt(e.target.value))} style={{ ...INP, marginBottom:0, flex:1, padding:"7px 9px" }}>
                {[NOW_Y-1,NOW_Y,NOW_Y+1].map(y=><option key={y} value={y}>{y}년</option>)}
              </select>
              <select value={histMon} onChange={e=>setHistMon(parseInt(e.target.value))} style={{ ...INP, marginBottom:0, flex:1, padding:"7px 9px" }}>
                {MO.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
            {(()=>{
              const done=routines.reduce((acc,t)=>acc+md.filter(d=>doneOnDate(t,d)).length,0);
              const poss=routines.length*md.length; const pct=poss?Math.round(done/poss*100):0;
              return (
                <div style={{ display:"flex", gap:7, marginBottom:12 }}>
                  <div style={{ flex:1, background:"#111", borderRadius:12, padding:"11px 12px", border:"1px solid #1e1e1e" }}>
                    <div style={{ fontSize:9, color:"#444", fontFamily:"'DM Mono',monospace", marginBottom:2 }}>{histYear}년 {histMon}월 달성률</div>
                    <div style={{ fontSize:20, fontWeight:900, color:"#22C55E", fontFamily:"'DM Mono',monospace" }}>{pct}%</div>
                    <PBar pct={pct} h={3}/>
                  </div>
                  <div style={{ flex:1, background:"#111", borderRadius:12, padding:"11px 12px", border:"1px solid #1e1e1e" }}>
                    <div style={{ fontSize:9, color:"#444", fontFamily:"'DM Mono',monospace", marginBottom:2 }}>완료 일수</div>
                    <div style={{ fontSize:20, fontWeight:900, color:"#F59E0B", fontFamily:"'DM Mono',monospace" }}>{done}일</div>
                    <div style={{ fontSize:9, color:"#333" }}>/{poss}회 가능</div>
                  </div>
                </div>
              );
            })()}
            <div style={{ background:"#111", borderRadius:14, padding:"11px 12px", border:"1px solid #1e1e1e", marginBottom:10 }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:9, fontFamily:"'DM Mono',monospace" }}>루틴별 달성률</div>
              {routines.map(task=>{
                const color=TC[task.tag]||"#6B7280";
                const done2=md.filter(d=>doneOnDate(task,d)).length;
                const pct2=md.length?Math.round(done2/md.length*100):0;
                return (
                  <div key={task.id} style={{ marginBottom:9 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%", background:color, flexShrink:0 }}/>
                      <span style={{ fontSize:11, color:"#bbb", flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{task.text}</span>
                      <span style={{ fontSize:10, color, fontFamily:"'DM Mono',monospace", fontWeight:700 }}>{done2}/{md.length}일 ({pct2}%)</span>
                    </div>
                    <PBar pct={pct2} color={color} h={3}/>
                  </div>
                );
              })}
              {!routines.length&&<div style={{ textAlign:"center", color:"#333", fontSize:12 }}>루틴 없음</div>}
            </div>
            {routines.length>0&&(
              <div style={{ background:"#111", borderRadius:14, padding:12, border:"1px solid #1e1e1e", overflowX:"auto", marginBottom:12 }}>
                <div style={{ fontSize:10, color:"#555", marginBottom:8 }}>{histYear}년 {histMon}월 히트맵</div>
                <div style={{ display:"grid", gridTemplateColumns:"80px repeat(7,1fr)", gap:3, marginBottom:5 }}>
                  <div/>{["월","화","수","목","금","토","일"].map(d=><div key={d} style={{ textAlign:"center", fontSize:9, color:"#444" }}>{d}</div>)}
                </div>
                {routines.map(task=>{
                  const color=TC[task.tag]||"#6B7280";
                  const cells=[]; for(let i=0;i<fdMon;i++)cells.push(null);
                  md.forEach(d=>cells.push(doneOnDate(task,d)));
                  while(cells.length%7!==0)cells.push(null);
                  const rows=[]; for(let r=0;r<cells.length/7;r++)rows.push(cells.slice(r*7,(r+1)*7));
                  return rows.map((row,ri)=>(
                    <div key={task.id+"-"+ri} style={{ display:"grid", gridTemplateColumns:"80px repeat(7,1fr)", gap:3, marginBottom:3 }}>
                      {ri===0?<div style={{ fontSize:9, color:"#aaa", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:3 }}><div style={{ width:5, height:5, borderRadius:"50%", background:color, flexShrink:0 }}/>{task.text}</div>:<div/>}
                      {row.map((isDone,ci)=>(
                        <div key={ci} style={{ aspectRatio:"1", borderRadius:3, background:isDone===null?"transparent":isDone?color+"cc":"#1e1e1e", border:isDone===null?"none":`1px solid ${isDone?color+"44":"#252525"}` }}/>
                      ))}
                    </div>
                  ));
                })}
              </div>
            )}
          </>
        )}
        <div style={{ height:22 }}/>
      </div>
    );
  };

  /* ── EXPLORE ── */
  const renderExplore=()=>{
    const cats=["전체","학습","운동","독서","유튜브","재테크"];
    const filtered2=expFilter==="전체"?data.templates:data.templates.filter(t=>t.cat===expFilter);
    const myTitles=new Set(data.projects.map(p=>p.title));
    return (
      <div style={{ padding:"16px 18px 0" }}>
        <div style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>🔍 탐색</div>
        <div style={{ fontSize:11, color:"#444", marginBottom:12 }}>검증된 성장 템플릿을 가져오세요</div>
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:14 }}>
          {cats.map(c=><button key={c} onClick={()=>setExpFilter(c)} style={{ flexShrink:0, padding:"5px 13px", borderRadius:18, border:"none", cursor:"pointer", fontSize:11, fontWeight:700, background:expFilter===c?"#22C55E":"#111", color:expFilter===c?"#000":"#555" }}>{c}</button>)}
        </div>
        {filtered2.map(tpl=>{
          const owned=myTitles.has(tpl.title);
          return (
            <div key={tpl.id} style={{ background:"#111", borderRadius:14, overflow:"hidden", border:"1px solid #1e1e1e", marginBottom:10 }}>
              <div style={{ background:GRADS[tpl.gi], padding:"13px 14px", display:"flex", alignItems:"center", gap:11 }}>
                <span style={{ fontSize:28 }}>{tpl.emoji}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:800, color:"#fff" }}>{tpl.title}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.7)", marginTop:1 }}>{tpl.days}일 · 핵심목표 {tpl.krs.length}개</div>
                </div>
              </div>
              <div style={{ padding:"11px 13px" }}>
                <div style={{ fontSize:12, color:"#666", marginBottom:9 }}>{tpl.desc}</div>
                {tpl.krs.map((kr,ki)=>(
                  <div key={ki} style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:kr.color, flexShrink:0 }}/>
                    <span style={{ fontSize:11, color:"#888" }}>{kr.title}</span>
                  </div>
                ))}
                <button onClick={()=>{ if(!owned)importTpl(tpl); }} style={{ width:"100%", marginTop:9, padding:"8px", background:owned?"#1a1a1a":"#22C55E", border:"none", borderRadius:10, color:owned?"#444":"#000", fontSize:12, fontWeight:700, cursor:owned?"default":"pointer" }}>
                  {owned?"✓ 추가됨":"가져오기"}
                </button>
              </div>
            </div>
          );
        })}
        <div style={{ height:22 }}/>
      </div>
    );
  };

  /* ── MORE ── */
  const renderMore=()=>(
    <div style={{ padding:"16px 18px 0" }}>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:14 }}>⚙️ 더보기</div>
      <div onClick={()=>setShowPay(true)} style={{ background:"linear-gradient(135deg,#0f2a0f,#1a1a2a)", borderRadius:16, padding:16, border:"1px solid #22C55E33", marginBottom:12, cursor:"pointer" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div><div style={{ fontSize:13, fontWeight:700, color:"#22C55E" }}>🚀 프리미엄 플랜</div><div style={{ fontSize:11, color:"#555", marginTop:2 }}>무료 체험 중</div></div>
          <div style={{ fontSize:12, color:"#22C55E", fontWeight:700 }}>업그레이드 →</div>
        </div>
      </div>
      <div style={{ background:"linear-gradient(135deg,#111,#1a2a1a)", borderRadius:16, padding:16, border:"1px solid #1e3a1e", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:10 }}>
          <div style={{ fontSize:44, lineHeight:1 }}>{data.profile.avatar}</div>
          <div><div style={{ fontSize:17, fontWeight:900 }}>{data.profile.name}</div><div style={{ fontSize:11, color:"#22C55E", fontFamily:"'DM Mono',monospace" }}>LV.{data.profile.lv} · {data.profile.pts}pt</div></div>
        </div>
        <PBar pct={Math.min(100,Math.round((data.profile.pts%500)/5))} h={4}/>
        <div style={{ fontSize:10, color:"#444", marginTop:3 }}>다음 레벨까지 {500-data.profile.pts%500}pt</div>
      </div>
      <div style={{ background:"#111", borderRadius:14, padding:15, border:"1px solid #1e1e1e", marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>프로필 수정</div>
        <input style={INP} placeholder="닉네임" value={settName} onChange={e=>setSettName(e.target.value)}/>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
          {EMOJIS.slice(0,8).map(e=><button key={e} onClick={()=>setSettAv(e)} style={{ fontSize:20, background:settAv===e?"#1a2a1a":"transparent", border:settAv===e?"1.5px solid #22C55E":"1.5px solid transparent", borderRadius:9, padding:"3px 6px", cursor:"pointer" }}>{e}</button>)}
        </div>
        <button onClick={()=>mut(d=>{d.profile.name=settName;d.profile.avatar=settAv;})} style={{ ...BTN_G, padding:10 }}>저장</button>
      </div>
      <div style={{ background:"#111", borderRadius:14, padding:15, border:"1px solid #1e1e1e", marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>📈 나의 통계</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
          {[["총 프로젝트",data.projects.length+"개"],["완료 프로젝트",doneProjs.length+"개"],["완료 할 일",data.tasks.filter(t=>t.completed).length+"개"],["작성 일기",data.diaries.length+"개"]].map(([label,val])=>(
            <div key={label} style={{ background:"#0f0f0f", borderRadius:10, padding:"9px 11px", border:"1px solid #1a1a1a" }}>
              <div style={{ fontSize:10, color:"#444", marginBottom:2 }}>{label}</div>
              <div style={{ fontSize:16, fontWeight:800, color:"#22C55E", fontFamily:"'DM Mono',monospace" }}>{val}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:"#111", borderRadius:14, padding:15, border:"1px solid #1e1e1e", marginBottom:10 }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>💾 데이터</div>
        <button onClick={()=>{ const s=JSON.stringify(data,null,2); const b=new Blob([s],{type:"application/json"}); const u=URL.createObjectURL(b); const a=document.createElement("a"); a.href=u; a.download="selfgrowth.json"; a.click(); }} style={{ width:"100%", padding:10, background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:10, color:"#aaa", fontSize:12, cursor:"pointer", marginBottom:7 }}>📤 내보내기</button>
        <button onClick={()=>setConf({msg:"모든 데이터를 초기화할까요?",onYes:()=>{ const f=makeInit(); setData(f); save(f); setConf(null); }})} style={{ width:"100%", padding:10, background:"#1a0a0a", border:"1px solid #3a1a1a", borderRadius:10, color:"#7f3a3a", fontSize:12, cursor:"pointer" }}>🗑️ 초기화</button>
      </div>
      <div style={{ height:22 }}/>
    </div>
  );

  const NAV=[{icon:"⊞",label:"홈"},{icon:"🔍",label:"탐색"},{icon:"📊",label:"기록"},{icon:"⚙️",label:"더보기"}];

  return (
    <div style={{ background:"#080808", minHeight:"100vh", maxWidth:390, margin:"0 auto", fontFamily:"Pretendard, -apple-system, sans-serif", color:"#fff", position:"relative" }}>
      <style>{`@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css'); @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} ::-webkit-scrollbar{display:none;} input[type=date],input[type=time],input[type=range],select{color-scheme:dark;} textarea{color-scheme:dark;} @keyframes fp{0%{opacity:0;transform:translateX(-50%) scale(.8);}15%{opacity:1;transform:translateX(-50%) scale(1.04);}80%{opacity:1;}100%{opacity:0;transform:translateX(-50%) scale(.95);}} *{font-feature-settings:"kern" 1,"liga" 1;-webkit-font-smoothing:antialiased;} body,input,textarea,select,button{font-family:Pretendard,-apple-system,BlinkMacSystemFont,sans-serif;}`}</style>

      {showPay&&<Paywall onClose={()=>setShowPay(false)} onSelect={plan=>{mut(d=>{d.sub.plan=plan;});setShowPay(false);setFlash("구독 시작! 🎉");}}/>}
      {flash&&<Flash msg={flash} onDone={()=>setFlash(null)}/>}
      {conf&&<Confirm msg={conf.msg} onYes={conf.onYes} onNo={()=>setConf(null)}/>}

      <div style={{ padding:"13px 18px 0", display:"flex", justifyContent:"space-between", fontSize:11 }}>
        <span style={{ fontFamily:"'DM Mono',monospace", color:"#666" }}>9:41</span>
        <span style={{ fontFamily:"'DM Mono',monospace", color:"#666" }}>🔋 LTE</span>
      </div>

      <div style={{ height:"calc(100vh - 72px)", overflowY:"auto", paddingBottom:20 }}>
        {tab==="홈"    && renderHome()}
        {tab==="탐색"  && renderExplore()}
        {tab==="기록"  && renderHistory()}
        {tab==="더보기"&& renderMore()}
      </div>

      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:390, background:"rgba(8,8,8,.97)", borderTop:"1px solid #141414", backdropFilter:"blur(24px)", display:"flex", justifyContent:"space-around", padding:"9px 0 18px", zIndex:100 }}>
        {NAV.map(item=>(
          <button key={item.label} onClick={()=>setTab(item.label)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, minWidth:50, padding:0 }}>
            <span style={{ fontSize:18, lineHeight:1 }}>{item.icon}</span>
            <span style={{ fontSize:10, color:tab===item.label?"#22C55E":"#3a3a3a", fontWeight:tab===item.label?700:400 }}>{item.label}</span>
          </button>
        ))}
      </div>

      {/* 프로젝트 전체화면 */}
      {actProj&&(
        <ProjPage
          proj={actProj}
          krs={data.krs.filter(k=>k.pid===actProj.id)}
          allTasks={data.tasks}
          data={data}
          routineVisible={routineVisible}
          onClose={()=>setActProj(null)}
          onDelProj={delProject}
          onDoneProj={doneProject}
          onAddKR={addKR}
          setAddTask={cfg=>setAddTaskCfg(cfg.editTask?{editTask:cfg.editTask}:{initDate:todayStr(),initPeriod:cfg.period||"daily",initLpid:cfg.lpid||null})}
          toggleTask={toggleTask}
          delTask={delTask}
          projPct={projPct}
          krPct={krPct}
          onUpdateKR={updateKR}
          onToggleKRItem={()=>{}}
          onDelKR={delKR}
          pctColor={pctColor}
          pctGrad={pctGrad}
        />
      )}

      {showAddP&&(
        <Sheet onClose={()=>setShowAddP(false)} title="새 프로젝트">
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
            {EMOJIS.map(e=><button key={e} onClick={()=>setNpEmoji(e)} style={{ fontSize:19, background:npEmoji===e?"#1a2a1a":"#161616", border:npEmoji===e?"1.5px solid #22C55E":"1.5px solid #1e1e1e", borderRadius:10, padding:"3px 6px", cursor:"pointer" }}>{e}</button>)}
          </div>
          <input style={INP} placeholder="프로젝트 이름 *" value={npTitle} onChange={e=>setNpTitle(e.target.value)}/>
          <input style={INP} placeholder="한 줄 설명" value={npDesc} onChange={e=>setNpDesc(e.target.value)}/>
          <input style={INP} placeholder="목표 기간 (일)" type="number" value={npDays} onChange={e=>setNpDays(e.target.value)}/>
          <div style={{ fontSize:11, color:"#444", marginBottom:7 }}>색상</div>
          <div style={{ display:"flex", gap:7, marginBottom:14 }}>
            {GRADS.map((_,i)=><div key={i} onClick={()=>setNpGi(i)} style={{ width:26, height:26, borderRadius:"50%", background:GRADS[i], cursor:"pointer", border:npGi===i?"2.5px solid #fff":"2.5px solid transparent" }}/>)}
          </div>
          <button onClick={addProject} style={BTN_G}>만들기</button>
        </Sheet>
      )}

      {addTaskCfg&&(
        <TaskForm
          initDate={addTaskCfg.initDate} initPeriod={addTaskCfg.initPeriod} initLpid={addTaskCfg.initLpid}
          editTask={addTaskCfg.editTask||null}
          projects={data.projects}
          onAdd={addTask}
          onEdit={editTask}
          onClose={()=>setAddTaskCfg(null)}
        />
      )}

      {editEvt&&(
        <Sheet onClose={()=>setEditEvt(null)} title={editEvt==="new"?"이벤트 추가":"이벤트 수정"}>
          <input style={INP} placeholder="이벤트 이름 *" value={evTitle} onChange={e=>setEvTitle(e.target.value)}/>
          <div style={{ display:"flex", gap:7, marginBottom:10 }}>
            <input style={{ ...INP, marginBottom:0, flex:1 }} type="date" value={evDate} onChange={e=>setEvDate(e.target.value)}/>
            <input style={{ ...INP, marginBottom:0, flex:1 }} type="time" value={evTime} onChange={e=>setEvTime(e.target.value)}/>
          </div>
          <div style={{ display:"flex", gap:7, marginBottom:14 }}>
            {EVCOLS.map(c=><div key={c} onClick={()=>setEvColor(c)} style={{ width:26, height:26, borderRadius:"50%", background:c, cursor:"pointer", border:evColor===c?"2.5px solid #fff":"2.5px solid transparent" }}/>)}
          </div>
          <button onClick={saveEvent} style={BTN_G}>{editEvt==="new"?"추가하기":"저장하기"}</button>
        </Sheet>
      )}

      {actDiary&&(
        <DiaryModal date={actDiary} existing={data.diaries.find(d=>d.date===actDiary)}
          onClose={()=>setActDiary(null)} onSave={fields=>saveDiary(actDiary,fields)}/>
      )}
    </div>
  );
}
