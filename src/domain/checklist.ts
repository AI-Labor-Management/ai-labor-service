// F1 서류 체크리스트 — 사업장 설정·직원 등록 값으로 항목을 만들고, 상태·날짜·유효기간·보관 위치만 저장한다.
import { CHECKLIST_ITEMS, ITEM_BY_ID, type ChecklistItemDef } from '../data/checklistItems';
import { diffDays, monthOf, localDate } from './dates';
import { conditionHistory, isUnder5, weeklyHours } from './work';
import { payrollPeriodFor } from './payroll';
import type { AppState, DocRecord, Employee, ISODate, WorkCondition } from './types';

export type ChecklistLevel = 'risk' | 'soon' | 'check' | null;
export type ChecklistStatus = 'todo' | 'done' | 'na' | 'stored' | 'onboarding';

export interface ChecklistRow {
  key: string;
  item: ChecklistItemDef;
  title: string;
  employeeId: string | null;
  alias: string | null;
  conditionId: string | null;
  applies: boolean;
  naReason: string;
  boundaryHint: string;
  status: ChecklistStatus;
  level: ChecklistLevel;
  levelText: string;
  dueDate: ISODate | null;
  record: DocRecord | null;
  contractKind: string | null;
  link: string;
}

export function activeEmployees(state: AppState, date: ISODate): Employee[] {
  return state.employees.filter((e) => !e.resignDate || e.resignDate >= date);
}

export function contractKind(e: Employee, c: WorkCondition | null): string {
  if (e.ageBand === 'under18') return '연소근로자 표준근로계약서';
  if (e.isForeign && e.foreign?.visa === 'E-9') return '외국인고용법 표준근로계약서';
  if (c && !c.variable && weeklyHours(c) < 40) return e.employmentType === 'fixed' ? '단시간근로자 표준근로계약서 (기간 있음)' : '단시간근로자 표준근로계약서';
  if (e.employmentType === 'fixed') return '표준근로계약서 (기간 있음)';
  return '표준근로계약서 (기간 없음)';
}

function recordFor(state: AppState, key: string): DocRecord | null {
  return state.docRecords.find((r) => r.key === key) ?? null;
}

function levelForDue(due: ISODate, base: ISODate, e: Employee | null): { level: ChecklistLevel; text: string; onboarding: boolean } {
  if (e && e.onboarding === 'existing-pending' && due < e.registeredAt) return { level: null, text: '기존 직원 — 한 번에 체크로 정리', onboarding: true };
  const d = diffDays(base, due);
  if (d <= 0) return { level: 'risk', text: due < base ? '입사일 지남' : '오늘까지', onboarding: false };
  if (d <= 3) return { level: 'soon', text: `D-${d}`, onboarding: false };
  return { level: null, text: `D-${d}`, onboarding: false };
}

export function computeChecklist(state: AppState, base: ISODate): ChecklistRow[] {
  const wp = state.workplace;
  if (!wp) return [];
  const rows: ChecklistRow[] = [];
  const emps = activeEmployees(state, base);
  const count = emps.length;
  const scale = wp.scale;
  const mk = (item: ChecklistItemDef, partial: Partial<ChecklistRow>): ChecklistRow => ({
    key: item.id,
    item,
    title: item.title,
    employeeId: null,
    alias: null,
    conditionId: null,
    applies: true,
    naReason: '',
    boundaryHint: '',
    status: 'todo',
    level: null,
    levelText: '',
    dueDate: null,
    record: null,
    contractKind: null,
    link: `/owner/documents?item=${item.id}`,
    ...partial,
  });
  const applyRecord = (row: ChecklistRow): ChecklistRow => {
    const rec = recordFor(state, row.key);
    row.record = rec;
    if (!row.applies) {
      row.status = 'na';
      row.level = null;
      return row;
    }
    if (rec) {
      row.status = rec.status === 'na' ? 'na' : rec.status === 'stored' ? 'stored' : 'done';
      if (rec.status === 'na') row.naReason = rec.naReason;
      row.level = null;
      row.levelText = rec.doneAt ? `${rec.doneAt} 완료` : '완료';
    }
    return row;
  };

  // 사업장 공통
  const itm = (id: string) => ITEM_BY_ID.get(id)!;
  rows.push(applyRecord(mk(itm('W1'), { applies: scale === '10+', naReason: '상시 10명 이상부터 작성·신고 의무가 있어요 (근로기준법 제93조)', boundaryHint: scale === '5-9' ? '직원이 늘어 10명 이상이 되면 추가돼요' : '' })));
  rows.push(applyRecord(mk(itm('W2'), { applies: !isUnder5(scale), naReason: '1~4명 사업장은 제14조가 적용되지 않아요 (근로기준법 시행령 별표 1)', boundaryHint: isUnder5(scale) ? '직원이 늘어 5명 이상이 되면 추가돼요' : '' })));
  const anyEmp = count > 0 && !wp.familyOnly;
  const yearly = (row: ChecklistRow, months: number) => {
    if (row.status === 'done' && row.record?.doneAt && diffDays(row.record.doneAt, base) > months * 30.4) {
      row.status = 'todo';
      row.levelText = `지난 실시 ${row.record.doneAt} — 다시 할 때예요`;
    }
    if (row.status === 'todo' && row.applies) {
      row.level = 'check';
      if (!row.levelText) row.levelText = '실시 기록 없음';
    }
    return row;
  };
  rows.push(yearly(applyRecord(mk(itm('W3'), { applies: anyEmp, naReason: wp.familyOnly ? '동거하는 친족만 사용하는 사업장은 제외' : '직원이 생기면 추가돼요' })), 12));
  rows.push(yearly(applyRecord(mk(itm('W4'), { applies: anyEmp, naReason: '직원이 생기면 추가돼요', title: count && scale !== '10+' ? '성희롱 예방 교육 (10명 미만: 자료 게시·배포 가능)' : itm('W4').title })), 12));
  rows.push(yearly(applyRecord(mk(itm('W5'), { applies: wp.industry === 'food', naReason: '음식점·카페 영업자만 대상이에요' })), 12));

  // 직원별
  for (const e of emps) {
    const hist = conditionHistory(state.conditions, e.id);
    hist.forEach((c, idx) => {
      const isChange = idx > 0;
      const due = isChange ? c.effectiveFrom : e.hireDate;
      const row = mk(itm('E1'), {
        key: `E1:${e.id}:${c.id}`,
        title: isChange ? `변경 계약서 작성·교부 (${c.effectiveFrom} 적용)` : '근로계약서 작성·교부',
        employeeId: e.id,
        alias: e.alias,
        conditionId: c.id,
        dueDate: due,
        contractKind: contractKind(e, c),
        link: `/owner/documents?item=E1&emp=${e.id}&cond=${c.id}`,
      });
      applyRecord(row);
      if (row.status === 'todo') {
        const lv = levelForDue(due, base, e);
        row.level = lv.level;
        row.levelText = isChange ? `조건 변경 (${lv.text})` : lv.text;
        if (lv.onboarding) row.status = 'onboarding';
        if (c.variable && row.level === null) {
          row.level = 'check';
          row.levelText = '매주 달라요 — 근로일별 시간을 채울 수 없어 확인 필요';
        }
      }
      rows.push(row);
    });
    // E3 근로자 명부
    {
      const daily = e.employmentType === 'daily';
      const usedDays = diffDays(e.hireDate, base) + 1;
      const applies = !daily || usedDays >= 30;
      const row = mk(itm('E3'), { key: `E3:${e.id}`, employeeId: e.id, alias: e.alias, applies, naReason: '사용기간 30일 미만 일용근로자는 작성 생략 가능 (시행령 제21조) — 30일이 되면 추가돼요', dueDate: daily ? null : e.hireDate });
      applyRecord(row);
      if (row.status === 'todo' && row.dueDate) {
        const lv = levelForDue(row.dueDate, base, e);
        row.level = lv.level;
        row.levelText = lv.text;
        if (lv.onboarding) row.status = 'onboarding';
      } else if (row.status === 'todo') {
        row.level = 'soon';
        row.levelText = '하루 단위 고용 30일 도달';
      }
      rows.push(row);
    }
    // E4 연소자
    {
      const row = mk(itm('E4'), { key: `E4:${e.id}`, employeeId: e.id, alias: e.alias, applies: e.ageBand === 'under18', naReason: '18세 미만 직원만', dueDate: e.hireDate });
      applyRecord(row);
      if (row.status === 'todo' && row.applies) {
        const lv = levelForDue(e.hireDate, base, e);
        row.level = lv.level;
        row.levelText = lv.text;
        if (lv.onboarding) row.status = 'onboarding';
      }
      rows.push(row);
    }
    // E5 보건증
    {
      const applies = wp.industry === 'food' && e.foodHandler;
      const row = mk(itm('E5'), { key: `E5:${e.id}`, employeeId: e.id, alias: e.alias, applies, naReason: wp.industry !== 'food' ? '음식점·카페 업종만' : '식품을 직접 다루지 않는 직원 (등록 정보 기준)', dueDate: e.hireDate });
      applyRecord(row);
      if (row.applies) {
        if (row.status === 'todo') {
          const lv = levelForDue(e.hireDate, base, e);
          row.level = lv.level;
          row.levelText = lv.text;
          if (lv.onboarding) row.status = 'onboarding';
        } else if (row.status === 'done' || row.status === 'stored') {
          const exp = row.record?.expiry;
          if (!exp) {
            row.level = 'check';
            row.levelText = '유효기간 입력 필요';
          } else {
            const d = diffDays(base, exp);
            row.dueDate = exp;
            if (d < 0) {
              row.level = 'risk';
              row.levelText = `유효기간 지남 (${exp})`;
            } else if (d <= 30) {
              row.level = 'soon';
              row.levelText = `유효기간 D-${d} — 재검진 시기`;
            } else row.levelText = `유효기간 ${exp}`;
          }
        }
      }
      rows.push(row);
    }
    // 외국인
    if (e.isForeign && e.foreign) {
      const f = e.foreign;
      const f1 = applyRecord(mk(itm('F1'), { key: `F1:${e.id}`, employeeId: e.id, alias: e.alias }));
      if (f.checkedAt) {
        f1.status = 'done';
        f1.levelText = `${f.checkedAt} 확인`;
      } else if (f1.status === 'todo') {
        f1.level = 'check';
        f1.levelText = '확인 필요';
      }
      rows.push(f1);
      if (f.visa === 'D-2' || f.visa === 'D-4') {
        const f2 = mk(itm('F2'), { key: `F2:${e.id}`, employeeId: e.id, alias: e.alias });
        if (f.permitted === true && f.permitHours != null) {
          f2.status = 'done';
          f2.levelText = `허가 ${f.permitHours}시간`;
        } else {
          f2.level = f.permitted === false ? 'risk' : 'check';
          f2.levelText = f.permitted === false ? '허가 전 — 근무 시작 전 확인 필요' : '허가 여부·시간 입력 필요';
        }
        rows.push(f2);
      }
      const f3 = applyRecord(mk(itm('F3'), { key: `F3:${e.id}`, employeeId: e.id, alias: e.alias }));
      if (f3.status === 'todo') {
        f3.level = 'check';
        f3.levelText = '대상·기한 원문 확인 전';
      }
      rows.push(f3);
      if (f.visa === 'E-9') {
        const f4 = applyRecord(mk(itm('F4'), { key: `F4:${e.id}`, employeeId: e.id, alias: e.alias, dueDate: e.hireDate }));
        if (f4.status === 'todo') {
          const lv = levelForDue(e.hireDate, base, e);
          f4.level = lv.level ?? 'check';
          f4.levelText = lv.text;
        }
        rows.push(f4);
      }
    }
  }

  // 매달: 임금대장·명세서 — 급여 확정 상태에서 자동으로 판단
  if (count > 0) {
    const months = recentPayMonths(state, base);
    for (const m of months) {
      const p = state.payrolls.find((x) => x.month === m.month);
      const confirmed = p?.status === 'confirmed';
      const delivered = confirmed && emps.every((e) => state.statements.some((s) => s.payrollId === p!.id && s.employeeId === e.id) || !p!.confirmedLines?.some((l) => l.employeeId === e.id));
      for (const [id, done] of [['M1', confirmed], ['M2', delivered]] as const) {
        const row = mk(itm(id), { key: `${id}:${m.month}`, title: `${Number(m.month.slice(5))}월분 ${itm(id).title}`, dueDate: m.payDate, link: `/owner/payroll?month=${m.month}` });
        if (done) {
          row.status = 'done';
          row.levelText = id === 'M1' ? `${localDate(p!.confirmedAt)} 확정` : '교부함';
        } else {
          const d = diffDays(base, m.payDate);
          row.level = d < 0 ? 'risk' : d <= 3 ? 'soon' : null;
          row.levelText = d < 0 ? `지급일 지남 (${m.payDate})` : `지급일 ${m.payDate} · D-${d}`;
        }
        rows.push(row);
      }
    }
  }

  // 연차 사용 촉진
  rows.push(applyRecord(mk(itm('S3'), { applies: !isUnder5(scale), naReason: '1~4명 사업장은 연차 규정이 적용되지 않아요', link: '/owner/deadlines' })));
  return rows;
}

/** 지급일이 기준일 기준 지난 1개, 다가오는 1개인 급여월 */
export function recentPayMonths(state: AppState, base: ISODate): { month: string; payDate: ISODate }[] {
  const wp = state.workplace;
  if (!wp) return [];
  const out: { month: string; payDate: ISODate }[] = [];
  const thisMonth = monthOf(base);
  for (const offset of [-2, -1, 0, 1]) {
    const [y, m] = thisMonth.split('-').map(Number);
    const total = y * 12 + (m - 1) + offset;
    const ym = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
    const p = payrollPeriodFor(wp, ym);
    out.push({ month: ym, payDate: p.payDate });
  }
  const past = out.filter((o) => o.payDate <= base);
  const future = out.filter((o) => o.payDate > base);
  // 가장 최근에 지난 지급월 중 아직 확정 안 된 것은 남기고, 다음 지급월 1개
  const lastPast = past.slice(-1).filter((o) => {
    const per = payrollPeriodFor(wp, o.month);
    const emps = state.employees.filter((e) => e.hireDate <= per.to && (!e.resignDate || e.resignDate >= per.from));
    return emps.length > 0 && per.payDate >= emps.map((e) => e.registeredAt).sort()[0];
  });
  const unconfirmedPast = past.filter((o) => {
    const per = payrollPeriodFor(wp, o.month);
    const emps = state.employees.filter((e) => e.hireDate <= per.to && (!e.resignDate || e.resignDate >= per.from));
    // 서비스 등록 전에 지난 지급일은 제외
    return state.payrolls.find((p) => p.month === o.month)?.status !== 'confirmed' && emps.length > 0 && per.payDate >= emps.map((e) => e.registeredAt).sort()[0];
  });
  const set = new Map<string, { month: string; payDate: ISODate }>();
  for (const o of [...unconfirmedPast, ...lastPast, ...future.slice(0, 1)]) set.set(o.month, o);
  return Array.from(set.values()).sort((a, b) => (a.month < b.month ? -1 : 1));
}

export const CHECKLIST_DEFS = CHECKLIST_ITEMS;
