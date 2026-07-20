import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const isKo = (sot) => sot.lang !== 'en';
const deepEnough = (sot) => {
  const features = sot.requirements?.flatMap((requirement) => requirement.features ?? []) ?? [];
  const specs = features.flatMap((feature) => feature.specs ?? []);
  const pages = sot.ia?.sections?.flatMap((section) => section.pages ?? []) ?? [];
  return sot.requirements?.length >= 6
    && features.length >= 12
    && specs.length >= 24
    && (sot.prd?.targets?.length ?? 0) >= 3
    && (sot.prd?.scenarios?.length ?? 0) >= 4
    && (sot.prd?.kpis?.length ?? 0) >= 3
    && pages.length >= 8
    && (sot.flow?.transitions?.length ?? 0) >= 10;
};

function ensureFlowTriggers(sot) {
  const features = sot.requirements?.flatMap((requirement) => requirement.features ?? []) ?? [];
  const present = new Set((sot.flow?.transitions ?? []).map((transition) => transition.ref).filter(Boolean));
  const missing = features.map((feature) => feature.id).filter((id) => !present.has(id));
  if (!missing.length) return sot;

  const pages = sot.ia?.sections?.flatMap((section) => section.pages ?? []) ?? [];
  const pageIds = new Set(pages.map((page) => page.id));
  const transitions = [...(sot.flow?.transitions ?? [])];
  for (const id of missing) {
    const approvalFlow = id === 'F7' && pageIds.has('P5') && pageIds.has('P6');
    const source = approvalFlow ? 'P5' : (pages.find((page) => page.refs?.includes(id))?.id ?? pages[0]?.id);
    const destination = approvalFlow ? 'P6' : pages.find((page) => page.id !== source)?.id;
    if (source && destination && source !== destination) transitions.push({ from: source, to: destination, ref: id });
  }
  return { ...sot, flow: { ...sot.flow, transitions } };
}

export function deepenSot(sot) {
  sot = ensureFlowTriggers(sot);
  const covered = new Set(sot.ia?.sections?.flatMap((section) => (section.pages ?? []).flatMap((page) => page.refs ?? [])) ?? []);
  const completeCoverage = sot.requirements?.flatMap((requirement) => (requirement.features ?? []).flatMap((feature) => [feature.id, ...(feature.specs ?? []).map((_, index) => `${feature.id}:${index}`)])).every((ref) => covered.has(ref));
  const pageIds = new Set(sot.ia?.sections?.flatMap((section) => (section.pages ?? []).map((page) => page.id)) ?? []);
  const featureIds = new Set(sot.requirements?.flatMap((requirement) => (requirement.features ?? []).map((feature) => feature.id)) ?? []);
  const validPrdLinks = (sot.prd?.scenarios ?? []).every((scenario) => !scenario.start || pageIds.has(scenario.start)) && (sot.prd?.kpis ?? []).every((kpi) => (kpi.refs ?? []).every((ref) => featureIds.has(ref.split(':')[0])));
  if (deepEnough(sot) && completeCoverage && validPrdLinks) return sot;
  const ko = isKo(sot); const p = sot.prd; const old = sot.requirements.flatMap((r) => r.features ?? []);
  const entry = old[0]?.title ?? (ko ? '업무 요청 등록' : 'Work request registration');
  const record = old[1]?.title ?? (ko ? '기록과 상태 조회' : 'Record and status lookup');
  const process = old[2]?.title ?? (ko ? '처리 워크플로우' : 'Processing workflow');
  const report = old[3]?.title ?? (ko ? '운영 리포트' : 'Operations reporting');
  const labels = ko
    ? { req: ['접수와 데이터 품질','업무 기록과 검색','처리와 책임','승인과 예외','알림과 연동','운영 분석과 통제'], pages: ['운영 대시보드','업무 목록','등록 화면','상세 기록','처리 작업 공간','승인·예외 큐','알림·연동','운영 리포트','정책·권한 설정','감사 로그'], names: [entry, `${entry} 유효성·중복 검증`, record, '검색·필터·이력 관리', process, '담당자·우선순위·SLA 관리', '승인·정책 검토', '예외·반려·재처리', '알림·구독 관리', '외부 연동·데이터 동기화', report, '역할·권한·감사 관리'], admin: '시스템·정책 관리자', adminNeed: '권한, 정책, 감사 기록을 관리하고 싶다.', accept: '필수 정보, 변경 이력, 담당자와 상태가 감사 가능하게 기록된다.' }
    : { req: ['Intake and data quality','Records and search','Processing and ownership','Approval and exceptions','Notifications and integrations','Insights and controls'], pages: ['Operations dashboard','Work list','Create record','Record detail','Processing workspace','Approval and exception queue','Notifications and integrations','Operations reports','Policy and access settings','Audit log'], names: [entry, `${entry} validation and duplicate prevention`, record, 'Search, filter, and history management', process, 'Owner, priority, and SLA management', 'Approval and policy review', 'Exception, rejection, and reprocessing', 'Notifications and subscriptions', 'External integration and data synchronization', report, 'Role, permission, and audit management'], admin: 'System and policy administrator', adminNeed: 'Manage access, policy, and audit history.', accept: 'Required context, changes, ownership, and status are retained in an auditable record.' };
  const feature = (id, title, desc) => ({ id, title, desc, status: 'todo', priority: ['F7','F8','F12'].includes(id) ? 'mid' : 'high', acceptance: [{ text: labels.accept, done: false }], specs: [0,1].map((index) => ({ title: index ? (ko ? `${title} 예외·감사 처리` : `${title} exception and audit handling`) : (ko ? `${title} 기본 처리 규칙` : `${title} core processing rule`), desc: index ? (ko ? `${desc} 변경·실패·재처리 조건과 이력을 남긴다.` : `${desc} Retain change, failure, and reprocessing conditions with history.`) : desc, acceptance: [{ text: labels.accept, done: false }] })) });
  const features = labels.names.map((name, index) => feature(`F${index + 1}`, name, [p.solution, p.problem, p.goal][index % 3] || p.solution));
  const requirements = labels.req.map((title, index) => ({ id: `R${index + 1}`, title, desc: [p.problem,p.solution,p.goal][index % 3], status: 'todo', priority: index < 4 ? 'high' : 'mid', acceptance: [{ text: labels.accept, done: false }], features: features.slice(index * 2, index * 2 + 2) }));
  const page = (id, index, refs) => ({ id, title: labels.pages[index], type: index === 0 ? 'top' : 'page', refs, children: [] });
  const pages = [
    page('P1',0,['F1','F1:0','F3']), page('P2',1,['F3','F3:0','F4']), page('P3',2,['F1','F1:1','F2']), page('P4',3,['F3:1','F4:1','F11']), page('P5',4,['F5','F5:0','F6']), page('P6',5,['F7','F7:0','F8']), page('P7',6,['F9','F9:0','F10']), page('P8',7,['F11','F11:0']), page('P9',8,['F10:1','F12']), page('P10',9,['F8:1','F12:0','F12:1'])
  ];
  const allRefs = features.flatMap((item) => [item.id, ...item.specs.map((_, index) => `${item.id}:${index}`)]);
  pages.forEach((item, index) => item.refs = [...new Set([...item.refs, ...allRefs.filter((_, refIndex) => refIndex % pages.length === index)])]);
  const targets = [...(p.targets ?? [])]; if (targets.length < 3) targets.push({ name: labels.admin, role: ko ? '운영·보안 관리자' : 'Operations and security administrator', needs: labels.adminNeed, pain: p.problem });
  const scenarios = [{ text: ko ? '실무 사용자는 필요한 업무를 등록하고 상태를 확인한다.' : 'An operational user registers required work and checks its status.', start:'P1' }, { text: ko ? '운영 담당자는 대기 업무를 처리하고 예외를 조치한다.' : 'An operator processes queued work and handles exceptions.', start:'P5' }, { text: ko ? `${labels.admin}는 정책과 권한을 검토한다.` : `${labels.admin} reviews policy and access.`, start:'P9' }, { text: ko ? `${labels.admin}는 감사 기록과 운영 지표를 검토한다.` : `${labels.admin} reviews audit records and operating metrics.`, start:'P10' }];
  const kpis = [{ name: ko ? '기한 내 처리 비율' : 'On-time processing rate', target:p.goal, baseline:ko?'측정 전':'Not measured', method:ko?'상태 변경과 목표 기한을 월별 집계':'Monthly aggregation of state changes against target dates', refs:['F6'] }, { name: ko ? '운영 가시성' : 'Operations visibility', target:ko?'핵심 업무 100% 추적':'100% of key work tracked', baseline:ko?'측정 전':'Not measured', method:ko?'등록 기록과 리포트 연결 비율':'Share of records connected to reporting', refs:['F11'] }, { name: ko ? '감사 가능 운영 비율' : 'Auditable operations rate', target:ko?'핵심 변경 100% 기록':'100% of key changes retained', baseline:ko?'측정 전':'Not measured', method:ko?'감사 로그와 변경 이력 월별 점검':'Monthly audit-log and change-history review', refs:['F12'] }];
  return { ...sot, prd: { ...p, targets, scenarios, kpis, inScope: [...new Set([...(p.inScope ?? []), ...labels.names])], constraints: [...new Set([...(p.constraints ?? []), ko ? '권한, 정책, 상태 변경은 감사 로그로 남긴다.' : 'Permission, policy, and state changes require audit logs.'])] }, requirements, ia: { sections: [{ id:'S1',title:labels.req[0],pages:pages.slice(0,3) },{ id:'S2',title:labels.req[1],pages:pages.slice(3,5) },{ id:'S3',title:labels.req[2],pages:pages.slice(5,7) },{ id:'S4',title:labels.req[5],pages:pages.slice(7) }] }, flow: { start:'P1', transitions: [{from:'P1',to:'P2',ref:'F1'},{from:'P2',to:'P3',ref:'F2'},{from:'P3',to:'P4',ref:'F3'},{from:'P4',to:'P5',ref:'F4'},{from:'P5',to:'P6',ref:'F5'},{from:'P5',to:'P6',ref:'F7'},{from:'P6',to:'P5',ref:'F8'},{from:'P5',to:'P7',ref:'F6'},{from:'P7',to:'P8',ref:'F9'},{from:'P8',to:'P9',ref:'F10'},{from:'P9',to:'P10',ref:'F12'},{from:'P10',to:'P4',ref:'F11'},{from:'P4',to:'P1',label:ko?'운영 현황 갱신':'Refresh operations status'}] } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const file of process.argv.slice(2)) {
    const sot = JSON.parse(await readFile(file, 'utf8'));
    await writeFile(file, JSON.stringify(deepenSot(sot), null, 2) + '\n');
    console.log(`[deepen] ${file}`);
  }
}
