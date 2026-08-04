/* ---- derived Semantic Assurance report (read-only) ---- */
function semanticStatusLabel(value){
  const labels={ready:["준비됨","Ready"],"at-risk":["주의 필요","At risk"],blocked:["차단됨","Blocked"],passed:["통과","Passed"],failed:["실패","Failed"],unknown:["판정 불가","Unknown"],"not-assessed":["미검토","Not assessed"]};
  const item=labels[value]||[value||"-",value||"-"]; return t(item[0],item[1]);
}
function renderSemanticReview(){
  const report=SEMANTIC_REPORT;
  const stale=SEMANTIC_REPORT_STALE;
  const kpis=(SOT.prd&&SOT.prd.kpis)||[];
  const measurementRows=kpis.map(k=>{
    const m=k.measurement||{};
    return `<div class="sem-measure"><b>${esc(k.id||"-")}</b><span>${esc(k.name||"")}</span><code>${esc(m.mode||t("측정 정의 없음","No measurement"))}</code></div>`;
  }).join("");
  if(!report){
    return `<div class="semantic-view"><h1>${t("의미 검토","Semantic Review")}</h1><div class="sem-notice">${t("이 HTML에는 의미 검토 결과가 포함되어 있지 않습니다. review-semantic을 실행한 뒤 HTML을 다시 생성하세요.","This HTML has no semantic report. Run review-semantic and rebuild the HTML.")}</div><div class="sem-measures">${measurementRows}</div></div>`;
  }
  const assessment=report.assessment&&report.assessment.status;
  const readiness=report.readiness&&report.readiness.measurement;
  const findings=(report.findings||[]).map(f=>`<div class="sem-finding ${esc(f.severity||"warning")}"><div class="sem-find-head"><code>${esc(f.ruleId)}</code><span>${semanticStatusLabel(f.assessment)}</span></div><div>${esc(f.summary)}</div><small>${esc((f.subjectRefs||[]).join(" · "))}</small></div>`).join("")||`<div class="sem-empty">${t("측정 근거 관계에서 발견된 문제가 없습니다.","No measurement-evidence issues were found.")}</div>`;
  return `<div class="semantic-view">
    <div class="sem-title"><div><h1>${t("의미 검토","Semantic Review")}</h1><p>${t("KPI 측정 근거의 설계 완전성을 검토합니다. 실제 분석 결과나 SQL 정확성을 보증하지 않습니다.","Checks the design completeness of KPI measurement evidence, not analytics results or SQL correctness.")}</p></div><span class="sem-contract">${esc(report.semanticContractVersion||"")}</span></div>
    ${stale?`<div class="sem-notice stale">${t("SOT가 수정되어 이 결과는 오래되었습니다. 저장 후 review-semantic을 다시 실행하고 HTML을 재생성하세요.","The SOT changed, so this report is stale. Save, rerun review-semantic, and rebuild the HTML.")}</div>`:""}
    <div class="sem-summary ${stale?"stale":esc(readiness||"not-assessed")}"><div><small>${t("판정","Assessment")}</small><b>${stale?t("재검토 필요","Review required"):semanticStatusLabel(assessment)}</b></div><div><small>${t("측정 준비도","Measurement readiness")}</small><b>${stale?"-":semanticStatusLabel(readiness)}</b></div><div><small>${t("발견","Findings")}</small><b>${report.findings.length}</b></div></div>
    <h2>${t("KPI 측정 방식","KPI measurements")}</h2><div class="sem-measures">${measurementRows}</div>
    <h2>${t("발견 사항","Findings")}</h2><div class="sem-findings">${findings}</div>
  </div>`;
}
