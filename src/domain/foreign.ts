// 외국인 근로자 신호등 (기획안 5장). "가능/불가" 대신 확인 완료 / 확인 필요 / 위험. 체류자격만으로 취업 가능 여부를 단정하지 않는다.
import { diffDays } from './dates';
import { conditionAt, weeklyHours } from './work';
import type { AppState, Employee, ISODate } from './types';

export type Signal = 'ok' | 'check' | 'risk';
export const SIGNAL_LABEL: Record<Signal, string> = { ok: '확인 완료', check: '확인 필요', risk: '위험' };

export interface ForeignSignal {
  signal: Signal;
  items: { signal: Signal; text: string }[];
}

export const VISA_GUIDE: Record<string, string> = {
  'D-2': '유학 — 시간제취업 허가 여부·허가 시간, 다른 사업장 주당 시간 합계 확인',
  'D-4': '연수 — 시간제취업 허가 여부·허가 시간 확인',
  'E-9': '고용허가 — 허용 업종·근무처 제한 확인, 외국인고용법 표준근로계약서, 출국만기보험',
  'H-2': '방문취업 — 취업 제한 업종 확인 (F-4 통합 여부는 전문가와 확인)',
  'F-4': '재외동포 — 취업 제한 업종 확인',
  other: '기타 — 확인 필요',
};

export function foreignSignal(state: AppState, e: Employee, baseDate: ISODate): ForeignSignal | null {
  if (!e.isForeign || !e.foreign) return null;
  const f = e.foreign;
  const items: ForeignSignal['items'] = [];
  if (f.expiry) {
    const d = diffDays(baseDate, f.expiry);
    if (d < 0) items.push({ signal: 'risk', text: `체류기간 만료일이 지났어요 (${f.expiry})` });
    else if (d <= 30) items.push({ signal: 'check', text: `체류기간 만료 D-${d} — 연장 여부 확인 (알림은 연장·허가를 대신하지 않아요)` });
    else items.push({ signal: 'ok', text: `체류기간 ${f.expiry}까지` });
  } else items.push({ signal: 'check', text: '체류기간 만료일 입력 필요' });

  if (f.visa === 'D-2' || f.visa === 'D-4') {
    if (f.permitted === false) items.push({ signal: 'risk', text: '시간제취업 허가 전 — 근무 시작 전에 확인이 필요해요' });
    else if (f.permitted === null) items.push({ signal: 'check', text: '시간제취업 허가 여부 확인 필요' });
    else {
      const wh = weeklyHours(conditionAt(state.conditions, e.id, baseDate));
      if (f.permitHours == null) items.push({ signal: 'check', text: '허가 시간 입력 필요 (허가서에 적힌 주당 시간)' });
      else if (wh + (f.otherWorkplaceHours || 0) > f.permitHours) items.push({ signal: 'risk', text: `주 ${wh.toFixed(1)}시간 + 다른 사업장 ${f.otherWorkplaceHours}시간이 허가 ${f.permitHours}시간을 넘어요` });
      else items.push({ signal: 'ok', text: `허가 ${f.permitHours}시간 이내 (주 ${wh.toFixed(1)}시간 + 다른 사업장 ${f.otherWorkplaceHours}시간)` });
    }
  } else if (f.checkedAt) {
    items.push({ signal: 'ok', text: `체류자격·근무처 확인함 (${f.checkedAt})` });
  } else {
    items.push({ signal: 'check', text: VISA_GUIDE[f.visa] ?? VISA_GUIDE.other });
  }
  const signal: Signal = items.some((i) => i.signal === 'risk') ? 'risk' : items.some((i) => i.signal === 'check') ? 'check' : 'ok';
  return { signal, items };
}

