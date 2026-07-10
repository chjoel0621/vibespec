/* -------------------------------- PRD -------------------------------- */
function prdField(k, ph){ return `<div class="prd-field field" contenteditable data-prd-field="${k}">${esc(SOT.prd[k]||"")}</div>`; }
function prdList(k, ordered){
  const arr=SOT.prd[k]||[];
  const items=arr.map((x,i)=>`<li><span class="field" contenteditable data-prd-list="${k}#${i}">${esc(x)}</span><button class="ac-del" data-prd-del="${k}#${i}" title="${t('삭제','Delete')}">×</button></li>`).join("") || `<li class="empty" style="list-style:none">${t('비어 있음','Empty')}</li>`;
  return `<${ordered?'ol':'ul'} class="prd-list">${items}</${ordered?'ol':'ul'}><button class="addbtn sm" data-prd-add="${k}">${t('＋ 추가','＋ Add')}</button>`;
}
function prdChips(k){
  const arr=SOT.prd[k]||[];
  return `<div class="prd-chips">${arr.map((x,i)=>`<span class="persona field" contenteditable data-prd-list="${k}#${i}">${esc(x)}</span><button class="chip-del ac-del" data-prd-del="${k}#${i}" title="${t('삭제','Delete')}">×</button>`).join("")}<button class="addbtn sm" data-prd-add="${k}">＋</button></div>`;
}
function renderPersonas(){
  const arr=SOT.prd.targets||[];
  const cards=arr.map((p,i)=>`<div class="pcard"><div class="pcard-h"><span class="field pc-name" contenteditable data-persona="${i}#name">${esc(p.name)}</span><span class="pc-role field" contenteditable data-persona="${i}#role">${esc(p.role)}</span><button class="mini" data-persona-del="${i}" title="${t('삭제','Delete')}">×</button></div><div class="pcard-row"><span class="pc-k">${t('니즈','Needs')}</span><span class="field" contenteditable data-persona="${i}#needs">${esc(p.needs)}</span></div><div class="pcard-row"><span class="pc-k">${t('페인','Pain')}</span><span class="field" contenteditable data-persona="${i}#pain">${esc(p.pain)}</span></div></div>`).join("") || `<div class="empty">${t('페르소나가 없습니다.','No personas yet.')}</div>`;
  return `<div class="pgrid">${cards}</div><button class="addbtn sm" data-persona-add>${t('＋ 페르소나','＋ Persona')}</button>`;
}
function renderScenarios(){
  const arr=SOT.prd.scenarios||[]; const pages=allPages();
  const rows=arr.map((s,i)=>{ const opts=pages.map(p=>`<option value="${p.id}" ${s.start===p.id?'selected':''}>${esc(p.label)}</option>`).join(""); const go=s.start?`<button class="scn-go" data-scn-go="${s.start}" title="${t('유저플로우에서 보기','View in user flow')}">${t('▶ 플로우','▶ Flow')}</button>`:""; return `<li class="scn-row"><span class="field scn-text" contenteditable data-scn-text="${i}">${esc(s.text)}</span><span class="scn-ctl"><select data-scn-start="${i}"><option value="">${t('시작화면 연결…','Link start screen…')}</option>${opts}</select>${go}<button class="mini" data-scn-del="${i}" title="${t('삭제','Delete')}">×</button></span></li>`; }).join("") || `<li class="empty" style="list-style:none">${t('시나리오가 없습니다.','No scenarios yet.')}</li>`;
  return `<ol class="prd-list scn-list">${rows}</ol><button class="addbtn sm" data-scn-add>${t('＋ 시나리오','＋ Scenario')}</button>`;
}
function renderKpis(){
  const arr=SOT.prd.kpis||[]; const cat=specCatalog();
  const rows=arr.map((k,i)=>{ const chips=(k.refs||[]).map((rid,j)=>`<span class="kpi-ref">${esc(refTitle(rid))}<button class="ac-del" data-kpi-refdel="${i}#${j}" title="${t('연결 해제','Unlink')}">×</button></span>`).join(""); const avail=cat.filter(c=>!(k.refs||[]).includes(c.id)).map(c=>`<option value="${c.id}">${esc(c.label)}</option>`).join(""); return `<div class="kcard"><div class="kcard-h"><span class="field k-name" contenteditable data-kpi="${i}#name">${esc(k.name)}</span><button class="mini" data-kpi-del="${i}" title="${t('삭제','Delete')}">×</button></div><div class="kcard-grid"><label>${t('목표치','Target')}<span class="field" contenteditable data-kpi="${i}#target">${esc(k.target)}</span></label><label>${t('기준값','Baseline')}<span class="field" contenteditable data-kpi="${i}#baseline">${esc(k.baseline)}</span></label><label>${t('측정','Measure')}<span class="field" contenteditable data-kpi="${i}#method">${esc(k.method)}</span></label></div><div class="kcard-refs"><span class="kpi-reflabel">${t('관련 기능','Related features')}</span>${chips}<select data-kpi-refadd="${i}"><option value="">${t('＋ 기능 연결','＋ Link feature')}</option>${avail}</select></div></div>`; }).join("") || `<div class="empty">${t('KPI가 없습니다.','No KPIs yet.')}</div>`;
  return `<div class="kgrid">${rows}</div><button class="addbtn sm" data-kpi-add>${t('＋ KPI','＋ KPI')}</button>`;
}
function renderPRD(){
  return `<div class="prd-doc">
    <h1><span class="field" contenteditable data-prod>${esc(SOT.title||"제품")}</span></h1>
    <div class="kv">Product Requirements Document</div>

    <section><h2>${t('1. 개요','1. Overview')}</h2>
      <div class="prd-row"><span class="prd-k">${t('한 줄 정의','One-liner')}</span>${prdField("oneLiner")}</div>
      <div class="prd-row"><span class="prd-k">${t('성과 목표','Goal (outcome)')}</span>${prdField("goal")}</div>
      <div class="prd-row"><span class="prd-k">${t('왜 지금','Why now')}</span>${prdField("whyNow")}</div>
      <div class="prd-row"><span class="prd-k">${t('카테고리','Category')}</span>${prdField("category")}</div>
      <div class="prd-row"><span class="prd-k">${t('사용 환경','Platforms')}</span>${prdChips("platforms")}</div>
    </section>

    <section><h2>${t('2. 문제 · 가치','2. Problem · Value')}</h2>
      <div class="prd-row"><span class="prd-k">${t('사용자 문제','User problem')}</span>${prdField("problem")}</div>
      <div class="prd-row"><span class="prd-k">${t('해결 방식','Solution')}</span>${prdField("solution")}</div>
      <div class="prd-row"><span class="prd-k">${t('대안 · 경쟁','Alternatives')}</span>${prdField("alternatives")}</div>
      <div class="prd-row"><span class="prd-k">${t('차별점','Differentiator')}</span>${prdField("differentiator")}</div>
    </section>

    <section><h2>${t('3. 사용자','3. Users')}</h2>
      <h3 class="prd-sub">${t('타겟 · 페르소나','Targets · Personas')}</h3>${renderPersonas()}
      <h3 class="prd-sub">${t('유저 스토리 · 시나리오','User stories · Scenarios')} <span class="prd-hint">${t('(시작화면을 연결하면 유저플로우로 이동)','(link a start screen to jump to the user flow)')}</span></h3>${renderScenarios()}
    </section>

    <section><h2>${t('4. 성공 지표','4. Success Metrics')}</h2>
      <div class="prd-row"><span class="prd-k">North Star</span>${prdField("northStar")}</div>
      <h3 class="prd-sub">${t('핵심 KPI','Key KPIs')} <span class="prd-hint">${t('(지표·목표치·기준·측정 + 관련 기능 연결)','(metric · target · baseline · measure + feature links)')}</span></h3>${renderKpis()}
    </section>

    <section><h2>${t('5. 범위','5. Scope')}</h2>
      <h3 class="prd-sub">${t('포함 범위 · MVP','In scope · MVP')}</h3>${prdList("inScope")}
      <h3 class="prd-sub">${t('비목표 (범위 밖)','Non-goals (out of scope)')}</h3>${prdList("nonGoals")}
    </section>

    <section><h2>${t('6. 리스크 · 가정','6. Risks · Assumptions')}</h2>
      <h3 class="prd-sub">${t('가정','Assumptions')}</h3>${prdList("assumptions")}
      <h3 class="prd-sub">${t('리스크','Risks')}</h3>${prdList("risks")}
      <h3 class="prd-sub">${t('미해결 질문','Open questions')}</h3>${prdList("openQuestions")}
      <h3 class="prd-sub">${t('제약 · 의존성','Constraints · Dependencies')}</h3>${prdList("constraints")}
    </section>
  </div>`;
}
