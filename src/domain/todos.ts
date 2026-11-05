// 홈 "오늘 처리할 일" (12_홈 1장). 위험 → 7일 이내 → 확인 필요 순. [처리]는 해당 화면으로 바로 이동.
import { computeChecklist } from './checklist';
import { computeDeadlines } from './deadlines';
import { dDayLabel, diffDays } from './dates';
import { evaluateRisk } from './risk';
import { foreignSignal } from './foreign';
import { contractDriftWeeks } from './work';
import type { AppState, ISODate } from './types';

export type TodoLevel = 'risk' | 'soon' | 'check';
export type TodoArea = '서류' | '임금' | '보험·퇴직금' | '기한' | '외국인' | '근무' | '점검' | '직원';

export interface Todo {
  id: string;
  level: TodoLevel;
  area: TodoArea;
  title: string;
  badge: string;
  basis: string;
  link: string;
  date: ISODate | null;
  employeeId: string | null;
}

const ORDER: Record<TodoLevel, number> = { risk: 0, soon: 1, check: 2 };

export function computeTodos(state: AppState, base: ISODate): Todo[] {
  const out: Todo[] = [];
  if (!state.workplace) return out;
  const alias = (id: string | null) => state.employees.find((e) => e.id === id)?.alias ?? '';

  // F1 서류
  for (const r of computeChecklist(state, base)) {
    if (!r.level || r.status === 'done' || r.status === 'na' || r.status === 'onboarding') continue;
    out.push({ id: `doc:${r.key}`, level: r.level, area: r.item.group === 'monthly' ? '임금' : r.item.group === 'foreign' ? '외국인' : '서류', title: `${r.alias ? r.alias + ' ' : ''}${r.title}${r.levelText ? ` (${r.levelText})` : ''}`, badge: r.level === 'risk' ? '위험' : r.level === 'soon' ? r.levelText.match(/D-\d+/)?.[0] ?? '임박' : '확인', basis: r.item.basis, link: r.link, date: r.dueDate, employeeId: r.employeeId });
  }
  // F4 기한 (서류·급여와 겹치는 것은 기한 쪽에서 보여주되 중복 제거)
  for (const d of computeDeadlines(state, base)) {
    if (d.status === 'overdue' || d.status === 'due7') {
      if (d.type === 'payday' && out.some((t) => t.id.startsWith('doc:M'))) continue;
      out.push({ id: `dl:${d.key}`, level: d.status === 'overdue' ? 'risk' : 'soon', area: d.type.startsWith('ins') || d.type.startsWith('severance') ? '보험·퇴직금' : d.type === 'visaExpiry' ? '외국인' : d.type === 'payday' ? '임금' : '기한', title: `${d.title}${d.secondaryLabel ? ` · ${d.secondaryLabel}` : ''}`, badge: d.status === 'overdue' ? '위험' : d.dLabel, basis: d.basis, link: d.link, date: d.date, employeeId: d.employeeId });
    }
  }
  // F3 4대보험 "아직 안 함"
  for (const e of state.employees) {
    if (e.resignDate && e.resignDate < base) continue;
    if (e.insuranceMethod === 'notYet') out.push({ id: `ins:${e.id}`, level: 'risk', area: '보험·퇴직금', title: `${e.alias} 4대보험 처리 · 아직 안 함`, badge: '위험', basis: '4대보험 취득 신고', link: `/owner/insurance?emp=${e.id}`, date: null, employeeId: e.id });
    // 기존 직원 정리
    if (e.onboarding === 'existing-pending') out.push({ id: `onb:${e.id}`, level: 'check', area: '직원', title: `${e.alias} 있는 서류·보험·지난 기한 한 번에 체크하기`, badge: '정리', basis: '기존 직원 입구', link: `/owner/employees/${e.id}/onboarding`, date: null, employeeId: e.id });
    // 근로조건 "다른 점이 있어요"
    const disp = e.conditionAcks.find((a) => a.status === 'disputed' && !a.resolvedAt);
    if (disp) out.push({ id: `ack:${e.id}`, level: 'check', area: '직원', title: `${e.alias} 근로조건에 "다른 점이 있어요": ${disp.memo}`, badge: '확인', basis: '직원 근로조건 확인', link: `/owner/employees/${e.id}`, date: null, employeeId: e.id });
    // 외국인 위험
    const fs = foreignSignal(state, e, base);
    if (fs && fs.signal === 'risk') out.push({ id: `fx:${e.id}`, level: 'risk', area: '외국인', title: `${e.alias} 외국인 신호등 위험: ${fs.items.find((i) => i.signal === 'risk')?.text}`, badge: '위험', basis: '외국인 고용 확인', link: `/owner/employees/${e.id}`, date: null, employeeId: e.id });
    // 계약서와 자주 다름
    if (contractDriftWeeks(state, e, base) >= 3) out.push({ id: `drift:${e.id}`, level: 'check', area: '근무', title: `${e.alias} 최근 4주 중 3주 이상 계약 시간과 달라요 — 변경 계약서를 만들까요?`, badge: '확인', basis: '근로기준법 제17조', link: `/owner/employees/${e.id}?tab=conditions`, date: null, employeeId: e.id });
  }
  // 근무 예외 확인 대기
  for (const a of state.attendance.filter((x) => x.status !== 'confirmed' && !(x.status === 'pending' && !x.original.clockOut && x.date >= base))) {
    out.push({ id: `att:${a.id}`, level: 'check', area: '근무', title: `${alias(a.employeeId)} ${a.date.slice(5)} 출퇴근 확인 대기 · ${a.reason}`, badge: '확인', basis: '사장님이 확정한 시간만 급여에 반영', link: `/owner/work?tab=attendance&record=${a.id}`, date: a.date, employeeId: a.employeeId });
  }
  // 직원의 수정 이의
  for (const ed of state.attendanceEdits.filter((x) => x.employeeResponse?.status === 'disputed')) {
    const rec = state.attendance.find((r) => r.id === ed.recordId);
    const resolved = state.attendanceEdits.some((x) => x.recordId === ed.recordId && x.at > ed.at);
    if (rec && !resolved) out.push({ id: `disp:${ed.id}`, level: 'check', area: '근무', title: `${alias(rec.employeeId)} 출퇴근 수정에 "다른 점이 있어요": ${ed.employeeResponse!.memo}`, badge: '확인', basis: '근무 기록 수정 이력', link: `/owner/work?tab=attendance&record=${rec.id}`, date: rec.date, employeeId: rec.employeeId });
  }
  // 대타·연차 승인 대기
  for (const s of state.substitutions.filter((x) => x.status === 'applied')) out.push({ id: `sub:${s.id}`, level: 'check', area: '근무', title: `${s.date.slice(5)} 대타 승인 대기 (${alias(s.fromEmployeeId)} → ${alias(s.toEmployeeId)})`, badge: '승인', basis: '대타', link: '/owner/work?tab=subs', date: s.date, employeeId: s.fromEmployeeId });
  for (const l of state.leaveRequests.filter((x) => x.status === 'requested')) out.push({ id: `lv:${l.id}`, level: 'check', area: '근무', title: `${alias(l.employeeId)} 연차 신청 ${l.date.slice(5)}${l.hours ? ` ${l.hours}시간` : ''}`, badge: '승인', basis: '근로기준법 제60조', link: '/owner/work?tab=leave', date: l.date, employeeId: l.employeeId });
  // 서류 요청 기한
  for (const r of state.docRequests.filter((x) => x.status === 'requested')) {
    const d = diffDays(base, r.dueDate);
    if (d <= 3) out.push({ id: `req:${r.id}`, level: d < 0 ? 'risk' : 'soon', area: '서류', title: `${alias(r.employeeId)} ${r.customName} 요청 기한 ${r.dueDate.slice(5)}`, badge: d < 0 ? '지남' : dDayLabel(d), basis: '서류 요청', link: '/owner/documents?tab=requests', date: r.dueDate, employeeId: r.employeeId });
  }
  // 위험 점검
  const risk = evaluateRisk(state, base);
  for (const r of risk.rows.filter((x) => x.result === 'risk' || x.result === 'check')) out.push({ id: `risk:${r.q.id}`, level: r.result === 'risk' ? 'risk' : 'check', area: '점검', title: `위험 점검 ${r.q.no}번: ${r.text}`, badge: r.result === 'risk' ? '위험' : '확인', basis: r.q.basis, link: r.q.expert ? r.q.actionLink : `/owner/risk#${r.q.id}`, date: null, employeeId: null });

  // 중복 제거 (같은 id)
  const seen = new Set<string>();
  return out
    .filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)))
    .sort((a, b) => ORDER[a.level] - ORDER[b.level] || (a.date ?? '9999') .localeCompare(b.date ?? '9999'));
}

export function areaCounts(todos: Todo[]): Record<TodoArea, number> {
  const c: Record<TodoArea, number> = { 서류: 0, 임금: 0, '보험·퇴직금': 0, 기한: 0, 외국인: 0, 근무: 0, 점검: 0, 직원: 0 };
  for (const t of todos) if (t.level !== 'check' || t.area === '점검') c[t.area]++;
  return c;
}
