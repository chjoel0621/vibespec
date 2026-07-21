let LANG = "ko";
function t(ko,en){ return LANG==="en" ? en : ko; }
function applyStaticI18n(){
  document.querySelectorAll("[data-i18n]").forEach(el=>{ const p=el.dataset.i18n.split("|"); el.textContent = LANG==="en"?(p[1]||p[0]):p[0]; });
  document.querySelectorAll("[data-i18n-title]").forEach(el=>{ const p=el.dataset.i18nTitle.split("|"); el.title = LANG==="en"?(p[1]||p[0]):p[0]; });
  const lb=document.getElementById("langBtn"); if(lb) lb.textContent = LANG==="en"?"한글":"EN";
}
function ptype(k){ return t(PTYPE[k]||k, PTYPE_EN[k]||k); }
