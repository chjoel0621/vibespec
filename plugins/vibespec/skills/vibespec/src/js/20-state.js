/* ========================================================================
   SINGLE SOURCE OF TRUTH
   PRD · 기능명세서 · IA · 유저플로우 · 트리 뷰가 전부 이 하나의 객체만 읽고 씁니다.
   상단 "불러오기"로 스킬이 생성한 JSON을 열면 아래 SEED가 대체됩니다.
   ======================================================================== */
const SEED = {
  schemaVersion: "1.0",
  title: "회의실 예약 관리",
  lang: "ko",
  overview: "사내 구성원이 회의실을 빠르게 검색·예약하고, 실시간 이용 현황을 확인할 수 있는 앱. 중복 예약과 노쇼를 줄이고, 회의실 활용도를 데이터로 관리하는 것을 목표로 한다.",
  goals: [
    "3번의 탭 이내로 회의실 예약을 완료할 수 있다.",
    "예약 확정/변경/취소가 실시간 알림으로 전달된다.",
    "관리자는 회의실별 이용률을 대시보드로 확인할 수 있다."
  ],
  personas: ["일반 직원 (예약자)", "팀 리더 (참석자 관리)", "총무/관리자 (회의실 운영)"],
  prd: {
    oneLiner: "사내 구성원이 3번의 탭으로 빈 회의실을 찾아 예약하고 실시간 현황을 확인하는 앱",
    goal: "출시 6개월 내 사내 회의실 예약의 80%를 앱으로 전환하고 노쇼율을 5% 이하로 낮춘다.",
    whyNow: "하이브리드 근무로 회의실 수요가 몰리는데 예약이 메신저·구두로 이뤄져 중복·노쇼가 늘었고, 공간 운영 데이터의 필요가 커졌다.",
    problem: "예약 현황이 흩어져 있어 빈 회의실을 찾기 어렵고(직원의 Job: 지금 당장 빈 방을 잡고 싶다), 중복 예약과 노쇼가 반복된다.",
    solution: "실시간 현황 기반의 빠른 예약과 확정·리마인더 알림, 관리자용 이용 통계 대시보드를 제공한다.",
    alternatives: "현재는 사내 메신저 공지·종이 예약표·범용 캘린더(구글 캘린더)로 대체 — 실시간 현황과 노쇼 관리가 안 된다.",
    differentiator: "사내 계정(SSO)과 회의실 현황을 결합해 '빈 방 즉시 예약'과 노쇼 자동 집계를 지원한다.",
    targets: [
      { name:"직원 A", role:"예약자", needs:"지금 당장 빈 회의실을 빠르게 잡고 싶다", pain:"현황이 흩어져 있어 빈 방 찾기가 번거롭다" },
      { name:"팀 리더", role:"참석자 관리", needs:"참석자에게 일정·장소를 한 번에 공유", pain:"구두·메신저 공지로 누락이 생긴다" },
      { name:"총무·관리자", role:"회의실 운영", needs:"이용률·노쇼를 데이터로 관리", pain:"운영 판단에 쓸 데이터가 없다" }
    ],
    scenarios: [
      { text:"직원 A는 오후 2시 회의를 위해 홈에서 빈 회의실을 확인하고, 3층 회의실을 골라 참석자 4명을 추가한 뒤 예약을 확정한다. 확정 알림이 참석자에게 전송된다.", start:"P6" },
      { text:"관리자 B는 주간 대시보드에서 회의실별 이용률과 노쇼율을 확인하고, 이용률이 낮은 회의실의 운영 시간을 조정한다.", start:"" }
    ],
    northStar: "주간 앱 예약 완료 건수 (Weekly Completed Bookings)",
    kpis: [
      { name:"예약 완료까지 평균 탭 수", target:"≤ 3", baseline:"6", method:"완료 이벤트까지의 탭 수 로그 평균", refs:["F3","F6"] },
      { name:"월간 노쇼율", target:"≤ 5%", baseline:"18%", method:"예약 후 미체크인 / 총예약", refs:["F7"] },
      { name:"주간 활성 예약자 비율(WAU/직원)", target:"≥ 40%", baseline:"22%", method:"주간 예약자 수 / 전체 직원", refs:["F3"] }
    ],
    inScope: ["실시간 회의실 현황 조회", "예약 생성·취소·변경", "확정/리마인더 알림", "관리자 이용 통계 대시보드"],
    nonGoals: ["외부 게스트 예약", "유료 결제·정산", "화상회의 솔루션 연동(초기 제외)", "좌석(데스크) 예약"],
    assumptions: ["전 직원이 사내 SSO 계정을 보유한다", "회의실 목록·수용 인원 데이터를 총무팀이 제공한다", "노쇼는 예약 후 미체크인으로 판별 가능하다"],
    risks: ["사내 계정(SSO) 연동 일정 불확실", "센서 미설치 공간의 현황 정확도 이슈", "초기 데이터 부족으로 통계 신뢰도 낮음"],
    openQuestions: ["체크인은 QR·NFC 중 무엇으로 할까?", "노쇼 패널티 정책을 둘 것인가?", "예약 시간 단위는 15/30분?"],
    constraints: ["사내망(VPN) 환경에서 동작해야 함", "개인정보는 사내 정책상 외부 저장 불가", "iOS·Android·웹 동시 지원 필요"],
    category: "사내 업무용 예약 관리 (B2B SaaS)",
    platforms: ["웹", "iOS", "Android"]
  },
  requirements: [
    { id:"R1", title:"회원 관리", desc:"조직 구성원이 계정을 만들고 안전하게 로그인할 수 있어야 한다.",
      features:[
        { id:"F1", title:"회원가입", priority:"mid", status:"done",
          specs:["이메일/비밀번호 기반 회원가입","소셜 로그인 (카카오, 구글)","사번 인증 및 부서 매핑"] },
        { id:"F2", title:"로그인/로그아웃", priority:"mid", status:"done",
          specs:["자동 로그인 / 로그아웃 처리","비밀번호 찾기 및 재설정"] },
      ]},
    { id:"R2", title:"예약 관리", desc:"원하는 회의실과 시간대를 골라 예약을 생성·변경할 수 있어야 한다.",
      features:[
        { id:"F3", title:"예약 생성", priority:"high", status:"doing",
          specs:["회의실 및 시간대 선택","참석자 추가 및 인원 제한 설정","예약 확인 및 확정 알림 발송"] },
        { id:"F4", title:"예약 조회/변경", priority:"high", status:"todo",
          specs:["내 예약 목록 조회","예약 수정 및 취소","주간 캘린더 뷰"] },
      ]},
    { id:"R3", title:"회의실 관리", desc:"관리자가 회의실 정보를 등록하고 실시간 현황을 파악할 수 있어야 한다.",
      features:[
        { id:"F5", title:"회의실 등록", priority:"mid", status:"todo",
          specs:["회의실 정보(위치/사진) 등록","수용 인원 및 장비 설정","사용 가능 시간대 설정"] },
        { id:"F6", title:"실시간 현황", priority:"low", status:"todo",
          specs:["회의실별 이용 현황 보드","잔여 시간 및 다음 예약 표시"] },
      ]},
    { id:"R4", title:"알림 및 관리자", desc:"예약 관련 알림을 보내고 운영 지표를 관리할 수 있어야 한다.",
      features:[
        { id:"F7", title:"알림", priority:"mid", status:"todo",
          specs:["예약 시작 전 리마인더","변경/취소 알림"] },
        { id:"F8", title:"운영 대시보드", priority:"low", status:"todo",
          specs:["회의실별 이용률 통계","노쇼/취소율 리포트"] },
      ]},
  ],
  ia: { sections: [
    { id:"S1", title:"인증·온보딩", pages:[
      { id:"P1", title:"랜딩 페이지", type:"top", refs:[], children:[
        { id:"P2", title:"회원가입", type:"page", refs:["F1","F1:0","F1:2"], children:[
          { id:"P3", title:"소셜 로그인", type:"action", refs:["F1:1"], children:[] } ] },
        { id:"P4", title:"로그인", type:"page", refs:["F2","F2:0"], children:[
          { id:"P5", title:"비밀번호 재설정", type:"action", refs:["F2:1"], children:[] } ] } ] } ] },
    { id:"S2", title:"예약", pages:[
      { id:"P6", title:"홈 / 대시보드", type:"top", refs:[], children:[
        { id:"P7", title:"예약하기", type:"page", refs:["F3","F3:1"], children:[
          { id:"P8", title:"회의실·시간 선택", type:"action", refs:["F3:0"], children:[] },
          { id:"P9", title:"예약 확정", type:"action", refs:["F3:2"], children:[] } ] },
        { id:"P10", title:"내 예약", type:"page", refs:["F4","F4:0","F4:2"], children:[
          { id:"P11", title:"예약 취소", type:"action", refs:["F4:1"], children:[] } ] } ] } ] },
    { id:"S3", title:"회의실 관리", pages:[
      { id:"P12", title:"관리자 홈", type:"top", refs:[], children:[
        { id:"P13", title:"회의실 등록", type:"page", refs:["F5","F5:0","F5:1","F5:2"], children:[] },
        { id:"P14", title:"실시간 현황", type:"page", refs:["F6","F6:0","F6:1"], children:[] } ] } ] },
    { id:"S4", title:"알림·설정", pages:[
      { id:"P15", title:"설정", type:"top", refs:[], children:[
        { id:"P16", title:"알림 설정", type:"page", refs:["F7","F7:0","F7:1"], children:[] },
        { id:"P17", title:"운영 대시보드", type:"page", refs:["F8","F8:0","F8:1"], children:[] } ] } ] }
  ] },
  flow: { start:"P1", transitions:[
    {from:"P1",to:"P2",label:"회원가입"},
    {from:"P1",to:"P4",label:"로그인"},
    {from:"P2",to:"P4",label:"가입 완료"},
    {from:"P4",to:"P6",label:"로그인 성공"},
    {from:"P6",to:"P7",label:"예약하기"},
    {from:"P7",to:"P8",label:"회의실·시간 선택"},
    {from:"P8",to:"P9",label:"확인"},
    {from:"P9",to:"P6",label:"예약 완료"},
    {from:"P6",to:"P10",label:"내 예약"},
    {from:"P10",to:"P11",label:"취소하기"},
    {from:"P11",to:"P10",label:"취소 완료"},
    {from:"P6",to:"P12",label:"관리자"},
    {from:"P6",to:"P15",label:"설정"}
  ] }
};
/* enrich seed with detail-level fields (설명 / 수용 기준 / 상태 / 중요도) */
(function seedDetail(){
  const R=id=>SEED.requirements.find(r=>r.id===id);
  const F=id=>SEED.requirements.flatMap(r=>r.features).find(f=>f.id===id);
  R("R1").status="done"; R("R1").priority="mid";
  R("R2").status="doing"; R("R2").priority="high";
  R("R2").acceptance=[{text:"사용자는 회의실과 시간대를 선택해 예약할 수 있어야 한다.",done:true},{text:"중복된 시간대 예약은 차단되어야 한다.",done:false}];
  F("F3").desc="사용자가 원하는 회의실과 시간대를 선택해 예약을 생성한다. 중복 예약을 방지하고, 확정 시 참석자에게 알림을 발송한다.";
  F("F3").acceptance=[{text:"회의실 목록에서 하나를 선택할 수 있어야 한다.",done:true},{text:"시작/종료 시간 선택 시 중복 예약이 차단되어야 한다.",done:false},{text:"예약 확정 시 예약자에게 알림이 발송되어야 한다.",done:false}];
  F("F1").desc="이메일/비밀번호 또는 소셜 계정으로 회원가입하고, 사번 인증으로 부서를 매핑한다.";
  F("F1").acceptance=[{text:"이메일 형식과 비밀번호 규칙을 검증해야 한다.",done:true},{text:"사번 인증 실패 시 가입이 제한되어야 한다.",done:false}];
})();
function normalize(s){
  if(!s.prd) s.prd={};
  const pd=s.prd;
  if(s.overview && !pd.oneLiner) pd.oneLiner=s.overview;
  if(Array.isArray(s.goals) && s.goals.length && !pd.goal) pd.goal=s.goals.join(" / ");
  if(Array.isArray(s.personas) && s.personas.length && (!Array.isArray(pd.targets)||!pd.targets.length)) pd.targets=s.personas.slice();
  delete s.overview; delete s.goals; delete s.personas;
  s.requirements.forEach(r=>{
    if(r.status==null) r.status="todo";
    if(r.priority==null) r.priority="mid";
    if(r.desc==null) r.desc="";
    if(!r.acceptance) r.acceptance=[];
    r.features.forEach(f=>{ if(f.desc==null) f.desc=""; if(!f.acceptance) f.acceptance=[];
      f.specs = f.specs.map(sp=>{
        if(typeof sp==="string") return {title:sp, desc:"", acceptance:[]};
        if(sp.desc==null) sp.desc=""; if(!sp.acceptance) sp.acceptance=[]; return sp;
      });
    });
  });
  if(pd.background && !pd.whyNow) pd.whyNow=pd.background;
  if(Array.isArray(pd.roles) && pd.roles.length){ if(!Array.isArray(pd.targets)) pd.targets=[]; pd.roles.forEach(r=>{ if(!pd.targets.includes(r)) pd.targets.push(r); }); }
  delete pd.background; delete pd.roles;
  ["oneLiner","goal","whyNow","problem","solution","alternatives","differentiator","northStar","category"].forEach(k=>{ if(pd[k]==null) pd[k]=""; });
  ["targets","scenarios","kpis","inScope","nonGoals","assumptions","risks","openQuestions","constraints","platforms"].forEach(k=>{ if(!Array.isArray(pd[k])) pd[k]=[]; });
  pd.kpis = pd.kpis.map(k=> typeof k==="string" ? {name:k,target:"",baseline:"",method:"",refs:[]} : {name:k.name||"",target:k.target||"",baseline:k.baseline||"",method:k.method||"",refs:Array.isArray(k.refs)?k.refs:[]});
  pd.scenarios = pd.scenarios.map(x=> typeof x==="string" ? {text:x,start:""} : {text:x.text||"",start:x.start||""});
  pd.targets = pd.targets.map(t=> typeof t==="string" ? {name:t,role:"",needs:"",pain:""} : {name:t.name||"",role:t.role||"",needs:t.needs||"",pain:t.pain||""});
  if(!s.title) s.title=pd.oneLiner||"Untitled VibeSpec";
  if(s.lang!=="en") s.lang="ko";
  if(!s.ia) s.ia={sections:[]};
  const fix=arr=>arr.forEach(p=>{ if(!p.type)p.type="page"; if(!p.refs)p.refs=[]; if(!p.children)p.children=[]; fix(p.children); });
  s.ia.sections.forEach(sec=>{ if(!sec.pages)sec.pages=[]; fix(sec.pages); });
  if(s.flow && Array.isArray(s.flow.transitions)){
    s.flow.transitions = s.flow.transitions.map(t=>{
      const o={ from: t.from||t.source||t.fromPage||t.fromId||t.start, to: t.to||t.target||t.toPage||t.toId||t.end };
      if(t.ref) o.ref=t.ref; else { const l=t.label||t.action||t.name||t.trigger||t.title||""; if(l) o.label=l; }
      return o;
    }).filter(t=>t.from&&t.to);
    if(s.flow.start==null) s.flow.start=s.flow.entry||s.flow.from||null;
  }
  if(!s.flow || !Array.isArray(s.flow.transitions) || !s.flow.transitions.length) s.flow=deriveFlow(s);
  return s;
}
function deriveFlow(s){
  const trans=[], tops=[];
  s.ia.sections.forEach(sec=>{ if(sec.pages[0]) tops.push(sec.pages[0].id);
    const walk=p=>{ (p.children||[]).forEach(c=>{ trans.push(flowTransition(p.id,c.id)); walk(c); }); };
    sec.pages.forEach(walk);
  });
  for(let i=0;i<tops.length-1;i++) trans.push(flowTransition(tops[i],tops[i+1]));
  return {start:tops[0]||null, transitions:trans};
}
function flowTransition(from,to,ref="",label=""){
  const transition={from,to};
  if(ref) transition.ref=ref;
  else if(label) transition.label=label;
  return transition;
}
let SOT = normalize(structuredClone(SEED));
const DEEP_LINK_VIEWS = new Set(["prd", "spec", "tree", "ia", "flow"]);
const requestedView = typeof window!=="undefined" && typeof URLSearchParams!=="undefined" ? new URLSearchParams(window.location.search).get("view") : null;
let VIEW = DEEP_LINK_VIEWS.has(requestedView) ? requestedView : "prd";
function syncViewInUrl(){
  try{
    const url=new URL(window.location.href);
    if(VIEW==="prd") url.searchParams.delete("view");
    else url.searchParams.set("view",VIEW);
    window.history.replaceState(null,"",url);
  }catch(_){ /* file previews can restrict history changes */ }
}
let selReq, selFeat, selNode;
let colReqCol = false, colFeatCol = false;
let selSec, selPage;
let idc = 100;
const nid = p => p + (++idc);
/* ---- mutation helpers: every edit funnels through here, then render() ---- */
function commit(){ normalize(SOT); render(); flash(); pushHistory(); }
function flash(){ const f=document.getElementById("flash"); f.classList.add("show"); clearTimeout(flash._t); flash._t=setTimeout(()=>f.classList.remove("show"),1200); }
function find(id){ return SOT.requirements.find(r=>r.id===id); }
function findF(fid){ for(const r of SOT.requirements){ const f=r.features.find(x=>x.id===fid); if(f) return {r,f}; } return {}; }
