const PRIO = {high:{c:"high",t:"높음",e:"High"}, mid:{c:"mid",t:"보통",e:"Mid"}, low:{c:"low",t:"낮음",e:"Low"}};
const STAT = {todo:{c:"st-todo",t:"시작전",e:"To do"}, doing:{c:"st-doing",t:"진행중",e:"In progress"}, done:{c:"st-done",t:"완료",e:"Done"}};
const esc = s => (s||"").replace(/[&<>]/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[m]));
// SOT body data must never be persisted in web storage. This legacy key exists
// only so a one-time migration can offer the user a download before removing it.
const LEGACY_SOT_KEY="sot-proto-v3-flow";
const LANG_KEY="vibespec-lang";
const VIEWNAME={prd:"PRD",spec:"기능명세서",tree:"트리",ia:"IA",flow:"유저플로우"};
const VIEWNAME_EN={prd:"PRD",spec:"Feature Spec",tree:"Tree",ia:"IA",flow:"User Flow"};
const PTYPE = {top:"섹션 최상위", page:"페이지", action:"행동"};
const PTYPE_EN = {top:"Section top", page:"Page", action:"Action"};
const INIT_STATUS = {proposed:{t:"제안됨",e:"Proposed"}, approved:{t:"승인됨",e:"Approved"}, implemented:{t:"구현됨",e:"Implemented"}, dropped:{t:"폐기됨",e:"Dropped"}};
// Schema version is derived from the document (initiative meta ⇒ 1.1),
// never hardcoded — saving must not downgrade a 1.1 initiative to 1.0.
function schemaVersionFor(s){ return s && s.initiative ? "1.1" : "1.0"; }
// Read-only mode (product map and the documents opened from it). A map is a
// snapshot: edits belong in the source files. A map must never mutate a source
// document or establish a file connection.
let RO = false;
// Deny-by-default: in RO every control is disabled unless it is navigation.
// A new editing control added later is therefore read-only until someone
// deliberately lists it here. data-jump/data-zoom/data-expand/data-collapse are
// view navigation (scroll, pan, fold) — no document mutation — so they stay live.
const RO_ALLOW = ".tab,#langBtn,[data-jump],[data-zoom],[data-expand],[data-collapse],[data-ro-ok]";
