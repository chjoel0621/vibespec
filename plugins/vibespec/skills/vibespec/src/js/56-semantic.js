/* ---- derived Semantic Assurance report (read-only) ---- */
function semanticStatusLabel(value){
  const labels={ready:["측정 가능","Ready to measure"],"at-risk":["조건부 측정 가능","At risk"],blocked:["아직 측정할 수 없음","Not ready to measure"],passed:["검토 완료","Review complete"],failed:["결정 또는 보완 필요","Action required"],unknown:["확인 필요","Needs review"],"not-assessed":["점검 전","Not checked"]};
  const item=labels[value]||[value||"-",value||"-"]; return t(item[0],item[1]);
}
function semanticModeMeta(mode){
  const modes={
    "event-ratio":["이벤트 비율","Event ratio","전체 대상 중 조건을 충족한 비율을 시스템 기록으로 계산합니다.","Calculates the share of a population that meets a condition from system records."],
    "event-count":["이벤트 수","Event count","정해진 기간에 발생한 사건의 횟수를 계산합니다.","Counts how often an event occurs in a defined window."],
    survey:["설문","Survey","설문 응답을 기준으로 측정합니다.","Measures from survey responses."],
    manual:["수동 점검","Manual review","담당자가 정해진 절차와 주기에 따라 직접 확인합니다.","A responsible person checks it on a defined process and cadence."],
    external:["외부 데이터","External data","외부 시스템이나 데이터 출처의 지표를 사용합니다.","Uses a metric supplied by an external system or data source."]
  };
  const item=modes[mode]||[mode||"측정 정의 없음",mode||"No measurement","측정 방법에 대한 설명이 없습니다.","No measurement method is defined."];
  return {label:t(item[0],item[1]),description:t(item[2],item[3])};
}
function semanticReference(ref){
  const kpi=((SOT.prd&&SOT.prd.kpis)||[]).find(item=>item.id===ref);
  if(kpi) return {kind:t("KPI","KPI"),label:kpi.name||ref,kpi};
  const semantic=SOT.semantic||{};
  const decision=(semantic.decisions||[]).find(item=>item.id===ref);
  if(decision) return {kind:t("결정","Decision"),label:decision.question||ref,decision};
  const event=(semantic.events||[]).find(item=>item.id===ref);
  if(event) return {kind:t("측정 이벤트","Measurement event"),label:event.name||ref};
  for(const requirement of SOT.requirements||[]){
    if(requirement.id===ref) return {kind:t("요구사항","Requirement"),label:requirement.title||ref};
    const feature=(requirement.features||[]).find(item=>item.id===ref||String(ref).split(":")[0]===item.id);
    if(feature) return {kind:t("기능","Feature"),label:feature.title||ref};
  }
  let matchedPage=null;
  const walk=pages=>(pages||[]).some(page=>{if(page.id===ref){matchedPage=page;return true;}return walk(page.children);});
  for(const section of (SOT.ia&&SOT.ia.sections)||[]){if(walk(section.pages)) break;}
  if(matchedPage) return {kind:t("화면","Screen"),label:matchedPage.title||ref};
  return {kind:t("관련 항목","Related item"),label:ref};
}
function semanticRuleMeta(ruleId){
  const rules={
    "open-decision-blocks-measurement":["측정 기준을 결정해야 합니다.","Measurement criteria need a decision.","결정 질문에 답하고 그 내용을 기획에 반영한 뒤 다시 점검하세요.","Answer the decision question, update the plan, and run the check again."],
    "measurement-event-producer-required":["측정 데이터를 만드는 근거가 필요합니다.","The measurement needs production evidence.","이벤트를 실제로 만드는 기능, 시스템 작업, 외부 연동 또는 수동 절차를 연결하세요.","Connect the feature, system task, external dependency, or manual process that actually produces the event."],
    "event-producer-type-compatible":["측정 이벤트와 생산 근거가 맞지 않습니다.","The event and its producer do not match.","이벤트 유형에 맞는 실제 생산 근거로 수정하세요.","Use production evidence that matches the event type."],
    "user-event-interaction-evidence-required":["사용자 행동이 일어나는 화면이나 흐름이 필요합니다.","The user action needs a screen or flow.","사용자가 해당 행동을 수행하는 화면 또는 유저플로우를 연결하세요.","Connect the screen or user flow where the action happens."],
    "normalized-metric-denominator-required":["비율을 계산할 전체 대상이 필요합니다.","The ratio needs a denominator.","전체 대상을 정의하는 이벤트를 추가하거나 적합한 측정 방식으로 바꾸세요.","Define the population event or choose a suitable measurement method."],
    "ratio-population-consistent":["비율의 분자와 분모 기준이 다릅니다.","The ratio uses inconsistent populations.","분자와 분모가 같은 전체 대상을 기준으로 계산되도록 수정하세요.","Make the numerator and denominator use the same population."],
    "semantic-reference-exists":["연결된 기획 항목을 찾을 수 없습니다.","A linked planning item is missing.","삭제되거나 잘못 입력된 참조를 실제 항목으로 다시 연결하세요.","Reconnect the missing or invalid reference to an existing item."],
    "semantic-id-unique":["측정 항목 ID가 중복되었습니다.","A measurement item ID is duplicated.","각 KPI, 이벤트, 결정에 서로 다른 ID를 지정하세요.","Give every KPI, event, and decision a unique ID."],
    "kpi-stable-id-required":["KPI를 추적할 ID가 필요합니다.","The KPI needs a stable ID.","KPI에 고유한 K# ID를 지정한 뒤 다시 점검하세요.","Assign a unique K# ID to the KPI and run the check again."],
    "kpi-measurement-required":["KPI 측정 방법이 정의되지 않았습니다.","The KPI has no measurement method.","무엇을, 어떤 자료로, 얼마나 자주 측정할지 정의하세요.","Define what is measured, from which evidence, and how often."],
    "decision-resolution-required":["완료된 결정의 확정 내용이 없습니다.","A completed decision has no resolution.","결정 내용을 기록하거나 상태를 다시 미결정으로 바꾸세요.","Record the resolution or return the decision to open status."]
  };
  const item=rules[ruleId]||["확인이 필요한 측정 항목이 있습니다.","A measurement item needs review.","아래 이유와 관련 항목을 확인해 기획을 보완하세요.","Review the reason and related items below, then update the plan."];
  return {title:t(item[0],item[1]),action:t(item[2],item[3])};
}
function semanticFindingStatus(finding){
  if(finding.ruleId==="open-decision-blocks-measurement") return t("결정 필요","Decision needed");
  if(finding.assessment==="failed") return t("보완 필요","Update needed");
  return semanticStatusLabel(finding.assessment);
}
function semanticDecisionStatus(decision){
  if(decision.status==="decided") return t("결정 반영 완료","Decision applied");
  if((decision.resolution||"").trim()) return t("답변 작성됨 · 반영 대기","Answer saved · awaiting application");
  return t("답변 필요","Answer needed");
}
function semanticHandoffPrompt(decision){
  return t(
    `첨부한 VibeSpec SOT에서 아래 결정 답변을 실제 기획에 반영해줘.\n\n결정 질문: ${decision.question||""}\n확정 답변: ${decision.resolution||""}\n\n관련 KPI·측정 이벤트·생산 기능·화면·플로우 중 필요한 항목만 ID 기반 변경 계획으로 수정해줘. 요청 범위 밖 내용은 유지하고, 적용 후 validate-sot, review-sot, review-semantic을 다시 실행해줘. 점검을 통과한 경우에만 이 결정을 완료 상태로 변경하고 최신 SOT JSON과 HTML을 만들어줘.`,
    `Apply the decision below to the attached VibeSpec SOT.\n\nDecision question: ${decision.question||""}\nConfirmed answer: ${decision.resolution||""}\n\nUse an ID-based change plan to update only the affected KPIs, measurement events, producer features, pages, and flows. Preserve everything outside the requested scope. After applying the change, rerun validate-sot, review-sot, and review-semantic. Mark this decision as decided only if the checks pass, then regenerate the latest SOT JSON and HTML.`
  );
}
function renderSemanticDecision(decision){
  const impactRefs=[...new Set((decision.impacts||[]).flatMap(impact=>impact.refs||[]))];
  const related=impactRefs.map(ref=>({ref,...semanticReference(ref)}));
  const relatedHtml=related.map(item=>`<span class="sem-ref"><b>${esc(item.ref)}</b><span>${esc(item.kind)} · ${esc(item.label)}</span></span>`).join("");
  const affectedNames=related.filter(item=>item.kpi).map(item=>`${item.ref} ${item.label}`).join(", ");
  const impactText=affectedNames
    ?t(`${affectedNames}의 측정 가능 여부가 이 결정에 달려 있습니다.`,`${affectedNames} depends on this decision for measurement readiness.`)
    :t("아래 관련 기획 항목의 측정 가능 여부가 이 결정에 달려 있습니다.","The related planning items below depend on this decision for measurement readiness.");
  const answerText=decision.resolution||"";
  const handoff=decision.status==="open"&&answerText.trim()?`<div class="sem-ai-handoff"><small>${t("AI에 전달하기","Send to AI")}</small><ol><li>${t("상단의 저장을 눌러 답변이 포함된 SOT JSON을 저장합니다.","Use Save at the top to save the SOT JSON containing this answer.")}</li><li>${t("저장한 JSON을 Claude 또는 Codex에 첨부합니다.","Attach the saved JSON to Claude or Codex.")}</li><li>${t("아래 요청 문구를 함께 전달합니다.","Send the request below with it.")}</li></ol><textarea readonly data-sem-prompt="${esc(decision.id||"")}">${esc(semanticHandoffPrompt(decision))}</textarea><button type="button" data-sem-copyprompt="${esc(decision.id||"")}">${t("요청 문구 복사","Copy request")}</button><span class="sem-copy-status" aria-live="polite"></span></div>`:"";
  const resolution=`<div class="sem-decision-action ${decision.status==="decided"?"resolved":""}"><small>${t("결정 내용","Decision")}</small><p>${decision.status==="decided"?t("이미 기획에 반영된 결정입니다. 답변을 수정하면 다시 반영하고 점검해야 합니다.","This decision is already applied. Editing it requires application and review again."):t("답변을 저장한 뒤 VibeSpec에 기획 반영과 재점검을 요청하세요. 답변 저장만으로 문제를 해결 처리하지 않습니다.","Save the answer, then ask VibeSpec to apply it to the plan and run the check again. Saving alone does not resolve the issue.")}</p><textarea data-sem-answer="${esc(decision.id||"")}" placeholder="${t("결정 내용을 작성하세요.","Write the decision.")}">${esc(answerText)}</textarea><div class="sem-decision-actions"><button type="button" data-sem-saveanswer="${esc(decision.id||"")}">${decision.status==="decided"?t("수정 답변 저장","Save revised answer"):t("답변 저장","Save answer")}</button><span class="sem-answer-error" hidden>${t("결정 내용을 먼저 작성하세요.","Write the decision first.")}</span></div></div>`;
  return `<article class="sem-decision-card ${esc(decision.status||"open")}" id="sem-decision-${esc(decision.id||"")}">
    <div class="sem-decision-head"><span>${semanticDecisionStatus(decision)}</span><small>${t("시스템 참조 ID","System reference ID")} ${esc(decision.id||"")}</small></div>
    <h3>${esc(decision.question||t("결정 질문 없음","No decision question"))}</h3>
    <div class="sem-decision-impact"><small>${t("이 결정이 필요한 이유","Why this decision matters")}</small><p>${esc(impactText)}</p><div class="sem-refs">${relatedHtml}</div></div>
    ${resolution}
    ${handoff}
  </article>`;
}
function renderSemanticFinding(finding){
  const meta=semanticRuleMeta(finding.ruleId);
  const refs=(finding.subjectRefs||[]).map(ref=>({ref,...semanticReference(ref)}));
  const decisionRef=refs.find(item=>item.decision);
  const kpiRef=refs.find(item=>item.kpi);
  const title=finding.ruleId==="open-decision-blocks-measurement"&&kpiRef
    ?`${kpiRef.ref} ${kpiRef.label}: ${t("측정 세부 기준이 미정입니다.","measurement criteria are unresolved.")}`
    :meta.title;
  const reason=finding.ruleId==="open-decision-blocks-measurement"&&kpiRef&&decisionRef
    ?t(`${kpiRef.ref}은 ${semanticModeMeta(kpiRef.kpi.measurement&&kpiRef.kpi.measurement.mode).label} 방법이 정해져 있지만, “${decisionRef.decision.question}”에 대한 답이 없어 같은 기준으로 결과를 계산할 수 없습니다.`,`${kpiRef.ref} has a ${semanticModeMeta(kpiRef.kpi.measurement&&kpiRef.kpi.measurement.mode).label} method, but “${decisionRef.decision.question}” has no answer, so results cannot yet be calculated consistently.`)
    :finding.summary;
  const related=refs.filter(item=>!item.decision).map(item=>`<span class="sem-ref"><b>${esc(item.ref)}</b><span>${esc(item.kind)} · ${esc(item.label)}</span></span>`).join("");
  const decision=decisionRef?`<div class="sem-find-section decision"><small>${t("필요한 제품 결정","Required product decision")}</small><p>${esc(decisionRef.decision.question||"")}</p><a href="#sem-decision-${esc(decisionRef.ref)}">${t("결정 사항에서 답변 방법 보기","See how to answer in Decisions")}</a></div>`:"";
  return `<article class="sem-finding ${esc(finding.severity||"warning")}">
    <div class="sem-find-head"><div><span class="sem-find-status">${semanticFindingStatus(finding)}</span><h3>${esc(title)}</h3></div></div>
    <div class="sem-find-section"><small>${t("확인된 이유","Why this was flagged")}</small><p>${esc(reason)}</p></div>
    ${decision}
    <div class="sem-find-section"><small>${t("관련 기획 항목","Related planning items")}</small><div class="sem-refs">${related}</div></div>
    <div class="sem-find-section next"><small>${t("다음 단계","Next step")}</small><p>${esc(meta.action)}</p></div>
    <details class="sem-rule"><summary>${t("검사 정보","Check details")}</summary><code>${esc(finding.ruleId)}</code><span>${esc(finding.id||"")}</span></details>
  </article>`;
}
function renderSemanticReview(){
  const report=SEMANTIC_REPORT;
  const stale=SEMANTIC_REPORT_STALE;
  const kpis=(SOT.prd&&SOT.prd.kpis)||[];
  const affectedKpiIds=new Set(((report&&report.findings)||[]).flatMap(finding=>(finding.subjectRefs||[]).filter(ref=>/^K\d+$/.test(ref))));
  const measurementRows=kpis.map(k=>{
    const m=k.measurement||{};
    const mode=semanticModeMeta(m.mode);
    const affected=affectedKpiIds.has(k.id);
    const status=!report?t("점검 전","Not checked"):affected?t("확인 필요","Needs review"):t("현재 문제 없음","No current issue");
    return `<div class="sem-measure ${affected?"issue":"clear"}"><b>${esc(k.id||"-")}</b><div><strong>${esc(k.name||"")}</strong><small>${esc(k.method||"")}</small><span class="sem-kpi-status">${esc(status)}</span></div><div class="sem-mode"><b>${esc(mode.label)}</b><small>${esc(mode.description)}</small></div></div>`;
  }).join("");
  if(!report){
    return `<div class="semantic-view"><h1>${t("측정 점검","Measurement Check")}</h1><div class="sem-notice">${t("아직 측정 점검 결과가 없습니다. VibeSpec에서 측정 점검을 실행한 뒤 HTML을 다시 생성하세요.","No measurement check is available yet. Run the VibeSpec measurement check and rebuild the HTML.")}</div><div class="sem-measures">${measurementRows}</div></div>`;
  }
  const assessment=report.assessment&&report.assessment.status;
  const readiness=report.readiness&&report.readiness.measurement;
  const actionNeeded=!stale&&(assessment==="failed"||readiness==="blocked");
  const affectedKpis=kpis.filter(kpi=>affectedKpiIds.has(kpi.id));
  const clearKpis=kpis.filter(kpi=>!affectedKpiIds.has(kpi.id));
  const affectedNames=affectedKpis.map(kpi=>`${kpi.id} ${kpi.name}`).join(", ");
  const clearNames=clearKpis.map(kpi=>kpi.id).join("·");
  const decisions=(SOT.semantic&&SOT.semantic.decisions)||[];
  const openDecisions=decisions.filter(decision=>decision.status==="open");
  const decidedDecisions=decisions.filter(decision=>decision.status==="decided");
  const nonDecisionFindings=(report.findings||[]).filter(finding=>finding.ruleId!=="open-decision-blocks-measurement");
  const actionCount=openDecisions.length+nonDecisionFindings.length;
  const actionCards=[...openDecisions.map(renderSemanticDecision),...nonDecisionFindings.map(renderSemanticFinding)].join("")||`<div class="sem-empty">${t("지금 해결해야 할 측정 문제가 없습니다.","There are no measurement issues to resolve now.")}</div>`;
  const completedCards=decidedDecisions.map(renderSemanticDecision).join("");
  const issueSummary=affectedKpis.length
    ?t(`${affectedNames}에서 ${actionCount}개 항목을 해결해야 합니다.${clearNames?` ${clearNames}에서는 현재 문제가 발견되지 않았습니다.`:""}`,`${affectedNames} has ${actionCount} item(s) to resolve.${clearNames?` No current issue was found for ${clearNames}.`:""}`)
    :t("현재 정의된 KPI에서 확인할 문제가 발견되지 않았습니다.","No current issue was found for the defined KPIs.");
  const nextNotice=actionNeeded?`<div class="sem-next"><div><b>${t("지금 할 일","What to do now")}</b><p>${esc(issueSummary)}</p><p>${t("아래 해결할 항목에서 결정을 입력하거나 누락된 근거를 보완하세요.","Enter the decisions or add the missing evidence in the items below.")}</p></div><ol><li>${t("강조된 KPI를 확인합니다.","Review the highlighted KPI.")}</li><li>${t("결정 내용을 입력하고 답변을 저장합니다.","Enter the decision and save the answer.")}</li><li>${t("표시되는 가이드로 SOT를 AI에 전달합니다.","Use the displayed guide to send the SOT to AI.")}</li></ol></div>`:`<div class="sem-next ready"><b>${t("현재 KPI는 정의된 근거로 측정할 수 있습니다.","The current KPIs can be measured from their defined evidence.")}</b></div>`;
  const affectedIds=affectedKpis.map(kpi=>kpi.id).join("·");
  const findingCount=affectedKpis.length?t(`${affectedIds}에서 ${actionCount}개`,`${affectedIds}: ${actionCount}`):`${actionCount}${t("개","")}`;
  return `<div class="semantic-view">
    <div class="sem-title"><div><h1>${t("KPI 측정 점검","KPI Measurement Check")}</h1><p>${t("KPI가 실제 기능과 데이터로 측정 가능한지 확인합니다. 실제 성과 수치나 분석 결과의 정확성을 보증하는 검사는 아닙니다.","Checks whether KPIs can be measured from real product functions and data. It does not verify actual performance values or analytics accuracy.")}</p></div></div>
    <div class="sem-scope"><b>${t("이번 점검 범위","Scope of this check")}</b><p>${t("현재 버전은 KPI가 기능과 데이터로 실제 측정 가능한지만 확인합니다. 사용자 문제와 기능의 적합성, 범위 충돌, 정책 일관성 등 전체 기획 품질을 모두 판정하는 화면은 아닙니다.","This version checks only whether KPIs are measurable from real functions and data. It does not assess all planning quality, such as problem-feature fit, scope conflicts, or policy consistency.")}</p></div>
    ${stale?`<div class="sem-notice stale">${t("기획이 수정되어 이 점검 결과는 최신 상태가 아닙니다. VibeSpec에서 다시 점검하고 HTML을 재생성하세요.","The plan changed, so this check is stale. Run the check again in VibeSpec and rebuild the HTML.")}</div>`:""}
    <div class="sem-summary ${stale?"stale":esc(readiness||"not-assessed")}"><div><small>${t("현재 상태","Current status")}</small><b>${stale?t("다시 점검 필요","Check again"):semanticStatusLabel(assessment)}</b></div><div><small>${t("측정 가능 여부","Measurement status")}</small><b>${stale?"-":semanticStatusLabel(readiness)}</b></div><div><small>${t("확인할 항목","Items to review")}</small><b>${esc(findingCount)}</b></div></div>
    ${nextNotice}
    <div class="sem-section-title"><div><h2>${t("해결할 항목","Items to resolve")}</h2><p>${t(`${actionCount}개`,`${actionCount} item(s)`)}</p></div></div><div class="sem-actions">${actionCards}</div>
    ${decidedDecisions.length?`<details class="sem-completed"><summary>${t(`완료된 결정 ${decidedDecisions.length}개`,`${decidedDecisions.length} completed decision(s)`)}</summary><div class="sem-decisions">${completedCards}</div></details>`:""}
    <h2>${t("KPI와 측정 방법","KPIs and measurement methods")}</h2><div class="sem-measures">${measurementRows}</div>
    <div class="sem-contract-note">${t("검사 계약","Check contract")}: <code>${esc(report.semanticContractVersion||"")}</code></div>
  </div>`;
}
