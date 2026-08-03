import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const isKo = (sot) => sot.lang !== 'en';
const flattenPages = (pages, depth = 1) => (pages ?? []).flatMap((page) => [
  { page, depth },
  ...flattenPages(page.children, depth + 1)
]);
const deepEnough = (sot) => {
  const features = sot.requirements?.flatMap((requirement) => requirement.features ?? []) ?? [];
  const specs = features.flatMap((feature) => feature.specs ?? []);
  const pages = sot.ia?.sections?.flatMap((section) => flattenPages(section.pages)) ?? [];
  return sot.requirements?.length >= 6
    && features.length >= 12
    && specs.length >= 24
    && (sot.prd?.targets?.length ?? 0) >= 3
    && (sot.prd?.scenarios?.length ?? 0) >= 4
    && (sot.prd?.kpis?.length ?? 0) >= 3
    && pages.length > features.length
    && Math.max(0, ...pages.map(({ depth }) => depth)) >= 3
    && pages.every(({ page }) => page.surface)
    && (sot.flow?.transitions?.length ?? 0) >= 10;
};

function ensureFlowTriggers(sot) {
  const features = sot.requirements?.flatMap((requirement) => requirement.features ?? []) ?? [];
  const present = new Set((sot.flow?.transitions ?? []).map((transition) => transition.ref).filter(Boolean));
  const missing = features.map((feature) => feature.id).filter((id) => !present.has(id));
  if (!missing.length) return sot;

  const pages = sot.ia?.sections?.flatMap((section) => flattenPages(section.pages).map(({ page }) => page)) ?? [];
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

export function deepenSot(sot, { profile = 'operations', iaOnly = false } = {}) {
  if (!['operations', 'consumer', 'marketplace'].includes(profile)) throw new Error(`Unsupported generation profile: ${profile}`);
  sot = ensureFlowTriggers(sot);
  const covered = new Set(sot.ia?.sections?.flatMap((section) => flattenPages(section.pages).flatMap(({ page }) => page.refs ?? [])) ?? []);
  const completeCoverage = sot.requirements?.flatMap((requirement) => (requirement.features ?? []).flatMap((feature) => [feature.id, ...(feature.specs ?? []).map((_, index) => `${feature.id}:${index}`)])).every((ref) => covered.has(ref));
  const pageIds = new Set(sot.ia?.sections?.flatMap((section) => flattenPages(section.pages).map(({ page }) => page.id)) ?? []);
  const featureIds = new Set(sot.requirements?.flatMap((requirement) => (requirement.features ?? []).map((feature) => feature.id)) ?? []);
  const validPrdLinks = (sot.prd?.scenarios ?? []).every((scenario) => !scenario.start || pageIds.has(scenario.start)) && (sot.prd?.kpis ?? []).every((kpi) => (kpi.refs ?? []).every((ref) => featureIds.has(ref.split(':')[0])));
  if (!iaOnly && deepEnough(sot) && completeCoverage && validPrdLinks) return sot;
  const ko = isKo(sot); const p = sot.prd; const consumer = profile === 'consumer'; const marketplace = profile === 'marketplace'; const userFacing = consumer || marketplace; const old = sot.requirements.flatMap((r) => r.features ?? []);
  const entry = old[0]?.title ?? (ko ? '업무 요청 등록' : 'Work request registration');
  const record = old[1]?.title ?? (ko ? '기록과 상태 조회' : 'Record and status lookup');
  const process = old[2]?.title ?? (ko ? '처리 워크플로우' : 'Processing workflow');
  const report = old[3]?.title ?? (ko ? '운영 리포트' : 'Operations reporting');
  const labels = consumer
    ? (ko
      ? { req: ['개인 설정과 시작','일상 기록과 조회','진행 점검과 다음 행동','알림과 재방문','개인정보와 연결','개인 인사이트와 확장'], pages: ['나의 홈','기록 목록','새 기록','기록 상세','오늘의 실행','주간 회고','알림·개인화','시작·재방문','데이터·개인정보','공유·연동 설정'], names: [entry, `${entry} 입력 검증과 초안 저장`, record, '개인 기록 검색·필터·히스토리', process, '진행 점검·다음 행동 제안', '알림 동의·시간대·빈도 설정', '온보딩·빈 상태·재방문 안내', '내보내기·삭제·개인정보 제어', '선택적 공유·연동 범위 설정', report, '개인화·접근성·안전 설정'], admin: '개인정보 보호 기준을 관리하는 제품 담당자', adminNeed: '사용자의 동의, 데이터 보호, 안전 기준을 관리하고 싶다.', accept: '사용자는 자신의 설정과 기록을 수정하고 알림·공유·데이터 사용을 직접 제어할 수 있다.' }
      : { req: ['Personal setup and start','Daily records and history','Progress review and next action','Reminders and return use','Privacy and connected data','Personal insights and extension'], pages: ['My home','Record list','Create record','Record detail','Today\'s action','Weekly review','Reminders and personalization','Onboarding and return use','Data and privacy','Sharing and integrations'], names: [entry, `${entry} validation and draft saving`, record, 'Personal record search, filters, and history', process, 'Progress review and next-action guidance', 'Reminder consent, timing, and frequency', 'Onboarding, empty states, and return-use guidance', 'Export, deletion, and privacy controls', 'Optional sharing and integration boundaries', report, 'Personalization, accessibility, and safety settings'], admin: 'Product owner for privacy and trust', adminNeed: 'Maintain user consent, data protection, and safety standards.', accept: 'Users can update their settings and records and directly control reminders, sharing, and data use.' })
    : marketplace
    ? (ko
      ? { req: ['탐색과 맞춤 설정','게시와 응답','지원·거래 상태','신뢰와 안전','알림·공개 범위','개인 인사이트와 접근성'], pages: ['공고 탐색','공고 상세','공고 등록','지원·응답 상태','저장·알림','신고·안전','프로필·공개 범위','계정·신뢰 설정','내 활동','도움말·접근성'], names: [entry, `${entry} 내용 검토와 저장`, record, '저장 항목·응답 이력·검색 조건', process, '지원·응답 상태 안내', '알림·저장 검색 설정', '신고·안전 안내와 결과 확인', '프로필·공개 범위 제어', '계정·신뢰 설정', report, '참여 흐름·접근성 개선'], accept: '참여자는 자신의 프로필과 공개 범위를 제어하고, 게시·지원·신고 상태를 확인할 수 있다.' }
      : { req: ['Discovery and preferences','Publishing and response','Application or transaction status','Trust and safety','Alerts and visibility','Personal insights and accessibility'], pages: ['Discover listings','Listing detail','Create listing','Application and response status','Saves and alerts','Report and safety','Profile and visibility','Account and trust settings','My activity','Help and accessibility'], names: [entry, `${entry} review and saving`, record, 'Saved items, response history, and search preferences', process, 'Application and response status updates', 'Alert and saved-search settings', 'Reporting, safety guidance, and outcome status', 'Profile and visibility controls', 'Account and trust settings', report, 'Participation insights and accessibility'], accept: 'Participants can control their profile and visibility and check the status of posts, applications, or reports.' })
    : (ko
    ? { req: ['접수와 데이터 품질','업무 기록과 검색','처리와 책임','승인과 예외','알림과 연동','운영 분석과 통제'], pages: ['운영 대시보드','업무 목록','등록 화면','상세 기록','처리 작업 공간','승인·예외 큐','알림·연동','운영 리포트','정책·권한 설정','감사 로그'], names: [entry, `${entry} 유효성·중복 검증`, record, '검색·필터·이력 관리', process, '담당자·우선순위·SLA 관리', '승인·정책 검토', '예외·반려·재처리', '알림·구독 관리', '외부 연동·데이터 동기화', report, '역할·권한·감사 관리'], admin: '시스템·정책 관리자', adminNeed: '권한, 정책, 감사 기록을 관리하고 싶다.', accept: '필수 정보, 변경 이력, 담당자와 상태가 감사 가능하게 기록된다.' }
    : { req: ['Intake and data quality','Records and search','Processing and ownership','Approval and exceptions','Notifications and integrations','Insights and controls'], pages: ['Operations dashboard','Work list','Create record','Record detail','Processing workspace','Approval and exception queue','Notifications and integrations','Operations reports','Policy and access settings','Audit log'], names: [entry, `${entry} validation and duplicate prevention`, record, 'Search, filter, and history management', process, 'Owner, priority, and SLA management', 'Approval and policy review', 'Exception, rejection, and reprocessing', 'Notifications and subscriptions', 'External integration and data synchronization', report, 'Role, permission, and audit management'], admin: 'System and policy administrator', adminNeed: 'Manage access, policy, and audit history.', accept: 'Required context, changes, ownership, and status are retained in an auditable record.' });
  const feature = (id, title, desc) => ({ id, title, desc, status: 'todo', priority: ['F7','F8','F12'].includes(id) ? 'mid' : 'high', acceptance: [{ text: labels.accept, done: false }], specs: [0,1].map((index) => ({ title: index ? (userFacing ? (ko ? `${title} 상태 피드백과 되돌리기` : `${title} status feedback and recovery`) : (ko ? `${title} 예외·감사 처리` : `${title} exception and audit handling`)) : (ko ? `${title} 기본 처리 규칙` : `${title} core processing rule`), desc: index ? (userFacing ? (ko ? `${desc} 사용자는 결과와 현재 상태를 이해하고 자신의 설정 또는 다음 행동을 조정할 수 있다.` : `${desc} People can understand the outcome and current state, then adjust their settings or next action.`) : (ko ? `${desc} 변경·실패·재처리 조건과 이력을 남긴다.` : `${desc} Retain change, failure, and reprocessing conditions with history.`)) : desc, acceptance: [{ text: labels.accept, done: false }] })) });
  const features = labels.names.map((name, index) => feature(`F${index + 1}`, name, [p.solution, p.problem, p.goal][index % 3] || p.solution));
  const requirements = labels.req.map((title, index) => ({ id: `R${index + 1}`, title, desc: [p.problem,p.solution,p.goal][index % 3], status: 'todo', priority: index < 4 ? 'high' : 'mid', acceptance: [{ text: labels.accept, done: false }], features: features.slice(index * 2, index * 2 + 2) }));
  const iaCopy = consumer
    ? (ko
      ? {
          sections: ['시작과 기록', '진행과 다음 행동', '알림과 재방문', '데이터와 공유', '인사이트와 개인화'],
          pages: ['나의 홈', '기록 목록', '새 기록', '입력 검토', '기록 상세', '진행 타임라인', '검색과 히스토리', '오늘의 실행', '실행 조정', '다음 행동', '알림 설정', '일정 미리보기', '알림 일시중지', '시작과 재방문', '빈 상태 안내', '데이터 제어', '내보내기와 삭제', '개인 인사이트', '추세 필터', '공유와 연동', '공개 범위'],
          flow: ['기록 보기', '검토 후 열기', '기록 선택', '알림 검토', '다시 실행', '진행 현황 갱신']
        }
      : {
          sections: ['Start and records', 'Progress and next action', 'Reminders and return use', 'Data and sharing', 'Insights and personalization'],
          pages: ['My home', 'Record list', 'Create record', 'Input review', 'Record detail', 'Progress timeline', 'Search and history', "Today's action", 'Action adjustment', 'Next action', 'Reminder settings', 'Schedule preview', 'Pause reminders', 'Onboarding and return', 'Empty-state guidance', 'Data controls', 'Export and deletion', 'Personal insights', 'Trend filters', 'Sharing and integrations', 'Visibility scope'],
          flow: ['View records', 'Open after review', 'Select record', 'Review reminders', 'Try again', 'Refresh progress']
        })
    : marketplace
    ? (ko
      ? {
          sections: ['탐색과 게시', '항목과 응답', '알림과 신뢰', '프로필과 계정', '활동과 접근성'],
          pages: ['탐색 홈', '검색 결과', '새 게시물', '게시 전 검토', '항목 상세', '응답 타임라인', '저장과 검색 조건', '참여 작업 공간', '응답 예외', '상태 안내', '알림과 신뢰 센터', '안전 결과', '이의 제기', '프로필', '공개 범위', '계정과 신뢰 설정', '보안 확인', '내 활동', '활동 필터', '도움말과 접근성', '접근성 설정'],
          flow: ['항목 탐색', '검토 후 열기', '항목 선택', '안전 검토', '응답 보완', '활동 현황 갱신']
        }
      : {
          sections: ['Discovery and publishing', 'Listings and responses', 'Alerts and trust', 'Profile and account', 'Activity and accessibility'],
          pages: ['Discovery home', 'Search results', 'Create listing', 'Pre-publish review', 'Listing detail', 'Response timeline', 'Saves and search preferences', 'Participation workspace', 'Response exception', 'Status guidance', 'Alerts and trust center', 'Safety outcome', 'Appeal', 'Profile', 'Visibility controls', 'Account and trust settings', 'Security check', 'My activity', 'Activity filters', 'Help and accessibility', 'Accessibility settings'],
          flow: ['Browse listings', 'Open after review', 'Select listing', 'Review safety', 'Revise response', 'Refresh activity']
        })
    : (ko
      ? {
          sections: ['시작과 접수', '기록 탐색과 업무 실행', '검토와 복구', '알림과 연동', '분석과 관리'],
          pages: ['운영 홈', '업무 수집함', '새 업무 등록', '입력 검토', '기록 상세', '활동 타임라인', '검색과 필터', '처리 작업 공간', '처리 예외', '담당자와 기한', '검토 대기열', '결정 상세', '반려와 재처리', '알림 센터', '구독 설정', '외부 연동', '동기화 실패', '운영 리포트', '리포트 필터', '정책과 권한', '감사 이력'],
          flow: ['업무 보기', '검토 후 열기', '결과 선택', '검토 요청', '다시 처리', '운영 현황 갱신']
        }
      : {
          sections: ['Start and intake', 'Records and work execution', 'Review and recovery', 'Notifications and integrations', 'Insights and administration'],
          pages: ['Operations home', 'Work inbox', 'Create work item', 'Input review', 'Record detail', 'Activity timeline', 'Search and filters', 'Processing workspace', 'Processing exception', 'Owner and due date', 'Review queue', 'Decision detail', 'Reject and reprocess', 'Notification center', 'Subscription settings', 'External integrations', 'Synchronization failures', 'Operations reports', 'Report filters', 'Policy and access', 'Audit history'],
          flow: ['View work', 'Open after review', 'Select result', 'Request review', 'Reprocess', 'Refresh operations status']
        });
  const page = (id, index, refs, surface, children = [], type = 'page') => ({ id, title: iaCopy.pages[index], type, surface, refs, children });
  const pages = {
    P3: page('P3', 2, ['F1:0', 'F1:1'], 'modal'),
    P10: page('P10', 20, ['F12:1'], 'panel'),
    P11: page('P11', 3, ['F2', 'F2:0', 'F2:1'], 'panel'),
    P12: page('P12', 5, ['F3:1'], 'panel'),
    P13: page('P13', 6, ['F4', 'F4:0', 'F4:1'], 'drawer'),
    P14: page('P14', 8, ['F5:1'], 'drawer'),
    P15: page('P15', 9, ['F6', 'F6:0', 'F6:1'], 'panel'),
    P16: page('P16', 11, ['F7:1'], 'panel'),
    P17: page('P17', 12, ['F8', 'F8:0', 'F8:1'], 'modal'),
    P18: page('P18', 14, ['F9:1'], 'panel'),
    P20: page('P20', 16, ['F10:1'], 'drawer'),
    P21: page('P21', 18, ['F11:1'], 'drawer')
  };
  pages.P2 = page('P2', 1, ['F1'], 'screen', [pages.P3, pages.P11]);
  pages.P1 = page('P1', 0, [], 'screen', [pages.P2], 'top');
  pages.P4 = page('P4', 4, ['F3', 'F3:0'], 'screen', [pages.P12, pages.P13], 'top');
  pages.P5 = page('P5', 7, ['F5', 'F5:0'], 'screen', [pages.P14, pages.P15]);
  pages.P6 = page('P6', 10, ['F7', 'F7:0'], 'screen', [pages.P16, pages.P17], 'top');
  pages.P7 = page('P7', 13, ['F9', 'F9:0'], 'screen', [pages.P18], 'top');
  pages.P19 = page('P19', 15, ['F10', 'F10:0'], 'screen', [pages.P20]);
  pages.P8 = page('P8', 17, ['F11', 'F11:0'], 'screen', [pages.P21], 'top');
  pages.P9 = page('P9', 19, ['F12', 'F12:0'], 'screen', [pages.P10]);
  const taskStructure = {
    ia: {
      sections: [
        { id: 'S1', title: iaCopy.sections[0], pages: [pages.P1] },
        { id: 'S2', title: iaCopy.sections[1], pages: [pages.P4, pages.P5] },
        { id: 'S3', title: iaCopy.sections[2], pages: [pages.P6] },
        { id: 'S4', title: iaCopy.sections[3], pages: [pages.P7, pages.P19] },
        { id: 'S5', title: iaCopy.sections[4], pages: [pages.P8, pages.P9] }
      ]
    },
    flow: {
      start: 'P1',
      transitions: [
        { from: 'P1', to: 'P2', label: iaCopy.flow[0] },
        { from: 'P2', to: 'P3', ref: 'F1' },
        { from: 'P3', to: 'P11', ref: 'F2' },
        { from: 'P11', to: 'P4', label: iaCopy.flow[1] },
        { from: 'P4', to: 'P12', ref: 'F3' },
        { from: 'P4', to: 'P13', ref: 'F4' },
        { from: 'P13', to: 'P4', label: iaCopy.flow[2] },
        { from: 'P4', to: 'P5', ref: 'F5' },
        { from: 'P5', to: 'P14', ref: 'F5:1' },
        { from: 'P5', to: 'P15', ref: 'F6' },
        { from: 'P15', to: 'P6', label: iaCopy.flow[3] },
        { from: 'P6', to: 'P16', ref: 'F7' },
        { from: 'P16', to: 'P17', ref: 'F8' },
        { from: 'P17', to: 'P5', label: iaCopy.flow[4] },
        { from: 'P6', to: 'P7', ref: 'F9' },
        { from: 'P7', to: 'P18', ref: 'F9:1' },
        { from: 'P7', to: 'P19', ref: 'F10' },
        { from: 'P19', to: 'P20', ref: 'F10:1' },
        { from: 'P5', to: 'P8', ref: 'F11' },
        { from: 'P8', to: 'P21', ref: 'F11:1' },
        { from: 'P1', to: 'P9', ref: 'F12' },
        { from: 'P9', to: 'P10', ref: 'F12:1' },
        { from: 'P8', to: 'P1', label: iaCopy.flow[5] }
      ]
    }
  };
  if (iaOnly) return { ...sot, ...taskStructure };
  const targets = [...(p.targets ?? [])]; if (!userFacing && targets.length < 3) targets.push({ name: labels.admin, role: ko ? '운영·보안 관리자' : 'Operations and security administrator', needs: labels.adminNeed, pain: p.problem });
  const scenarios = consumer
    ? [{ text: ko ? '사용자는 자신의 목표와 알림 선호를 설정한다.' : 'A person sets a goal and reminder preferences.', start:'P1' }, { text: ko ? '사용자는 핵심 행동이나 기록을 남기고 현재 진행을 확인한다.' : 'A person completes the core action or adds a record and checks progress.', start:'P5' }, { text: ko ? '사용자는 주간 인사이트를 보고 다음 행동과 알림을 조정한다.' : 'A person reviews weekly insights and adjusts the next action and reminders.', start:'P6' }, { text: ko ? '사용자는 자신의 데이터를 내보내거나 공유 범위를 조정한다.' : 'A person exports their data or changes sharing boundaries.', start:'P9' }]
    : marketplace
    ? [{ text: ko ? '구직자 또는 구매자는 조건에 맞는 항목을 찾고 저장한다.' : 'A participant discovers and saves a relevant listing.', start:'P1' }, { text: ko ? '게시자는 정보를 등록하고 응답 상태를 확인한다.' : 'A publisher creates a listing and checks response status.', start:'P3' }, { text: ko ? '참여자는 신고 결과와 공개 범위를 확인한다.' : 'A participant checks report outcomes and visibility settings.', start:'P6' }, { text: ko ? '참여자는 알림 조건을 조정하고 다시 방문한다.' : 'A participant adjusts alert preferences and returns.', start:'P5' }]
    : [{ text: ko ? '실무 사용자는 필요한 업무를 등록하고 상태를 확인한다.' : 'An operational user registers required work and checks its status.', start:'P1' }, { text: ko ? '운영 담당자는 대기 업무를 처리하고 예외를 조치한다.' : 'An operator processes queued work and handles exceptions.', start:'P5' }, { text: ko ? `${labels.admin}는 정책과 권한을 검토한다.` : `${labels.admin} reviews policy and access.`, start:'P9' }, { text: ko ? `${labels.admin}는 감사 기록과 운영 지표를 검토한다.` : `${labels.admin} reviews audit records and operating metrics.`, start:'P10' }];
  const kpis = consumer
    ? [{ name: ko ? '첫 주 핵심 행동 완료율' : 'First-week core-action completion', target:p.goal, baseline:ko?'측정 전':'Not measured', method:ko?'첫 7일 안에 핵심 기록 또는 행동을 완료한 사용자 비율':'Share of new users completing the core action or record within seven days', refs:['F5'] }, { name: ko ? '주간 재방문율' : 'Weekly return rate', target:ko?'주간 활성 사용자 증가':'Growing weekly active users', baseline:ko?'측정 전':'Not measured', method:ko?'주 단위로 기록·점검·알림 조정 활동을 한 사용자 비율':'Share of users recording, reviewing, or adjusting reminders each week', refs:['F8'] }, { name: ko ? '사용자 데이터 제어 완료율' : 'User data-control completion', target:ko?'데이터 요청 100% 처리':'100% of data requests completed', baseline:ko?'측정 전':'Not measured', method:ko?'내보내기·삭제·공유 설정 변경 요청의 완료 이력':'Completion history for export, deletion, and sharing-setting changes', refs:['F9'] }]
    : marketplace
    ? [{ name: ko ? '탐색 후 행동 전환율' : 'Discovery-to-action conversion', target:p.goal, baseline:ko?'측정 전':'Not measured', method:ko?'저장·지원·응답 등 참여 행동으로 이어진 탐색 세션 비율':'Share of discovery sessions that lead to a save, application, or response', refs:['F1'] }, { name: ko ? '응답 상태 확인율' : 'Response-status visibility', target:ko?'상태 안내 누락 최소화':'Minimize missed status updates', baseline:ko?'측정 전':'Not measured', method:ko?'참여자가 상태 업데이트를 확인한 비율':'Share of participants who view a status update', refs:['F6'] }, { name: ko ? '신고 결과 안내 완료율' : 'Report-outcome visibility', target:ko?'결과 안내 100%':'100% outcome notifications', baseline:ko?'측정 전':'Not measured', method:ko?'신고 접수 후 결과 또는 다음 단계가 안내된 비율':'Share of reports followed by an outcome or next-step notice', refs:['F9'] }]
    : [{ name: ko ? '기한 내 처리 비율' : 'On-time processing rate', target:p.goal, baseline:ko?'측정 전':'Not measured', method:ko?'상태 변경과 목표 기한을 월별 집계':'Monthly aggregation of state changes against target dates', refs:['F6'] }, { name: ko ? '운영 가시성' : 'Operations visibility', target:ko?'핵심 업무 100% 추적':'100% of key work tracked', baseline:ko?'측정 전':'Not measured', method:ko?'등록 기록과 리포트 연결 비율':'Share of records connected to reporting', refs:['F11'] }, { name: ko ? '감사 가능 운영 비율' : 'Auditable operations rate', target:ko?'핵심 변경 100% 기록':'100% of key changes retained', baseline:ko?'측정 전':'Not measured', method:ko?'감사 로그와 변경 이력 월별 점검':'Monthly audit-log and change-history review', refs:['F12'] }];
  const additionalConstraints = consumer ? (ko ? ['사용자는 자신의 기록을 내보내고 삭제할 수 있어야 한다.', '알림·공유·외부 데이터 연결은 명시적 동의를 받아야 한다.'] : ['Users must be able to export and delete their records.', 'Reminders, sharing, and external data connections require explicit consent.']) : marketplace ? (ko ? ['참여자는 프로필과 공개 범위를 직접 제어할 수 있어야 한다.', '신고와 안전 조치는 결과 또는 다음 단계를 참여자에게 안내해야 한다.'] : ['Participants must be able to control their profile and visibility.', 'Reporting and safety actions must communicate an outcome or next step to the participant.']) : (ko ? ['권한, 정책, 상태 변경은 감사 로그로 남긴다.'] : ['Permission, policy, and state changes require audit logs.']);
  return {
    ...sot,
    prd: {
      ...p,
      targets,
      scenarios,
      kpis,
      inScope: [...new Set([...(p.inScope ?? []), ...labels.names])],
      constraints: [...new Set([...(p.constraints ?? []), ...additionalConstraints])]
    },
    requirements,
    ...taskStructure
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const profileIndex = args.indexOf('--profile');
  const profile = profileIndex >= 0 ? args[profileIndex + 1] : 'operations';
  const iaOnly = args.includes('--ia-only');
  const files = args.filter((arg, index) => arg !== '--ia-only' && arg !== '--profile' && index !== profileIndex + 1);
  if (!files.length) {
    console.error('Usage: node tools/deepen-sot.mjs [--profile operations|consumer|marketplace] [--ia-only] <sot.json> [...]');
    process.exitCode = 2;
  }
  for (const file of files) {
    const sot = JSON.parse(await readFile(file, 'utf8'));
    await writeFile(file, JSON.stringify(deepenSot(sot, { profile, iaOnly }), null, 2) + '\n');
    console.log(`[deepen] ${file}`);
  }
}
