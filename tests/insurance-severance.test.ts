import { describe, expect, it } from 'vitest';
import { judgeInsurance, premiums, premiumTotals, reportDeadlines, type JudgeInput } from '../src/domain/insurance';
import { severanceAmount } from '../src/domain/severance';
import { annualDaysForYear, firstYearMonthly } from '../src/domain/leave';

const adult40: JudgeInput = { ageBand: '18-59', startedBefore65: null, employmentType: 'regular', hireDate: '2026-01-01', contractEnd: null, isForeign: false, visa: null, nationality: '', weeklyHours: 40, variable: false };

describe('F3 보험료 손계산 예제 (10_F3 6·8장)', () => {
  it('월 2,156,880원, 2026년 — 근로자 209,530 / 사장님 233,460', () => {
    const j = judgeInsurance(adult40, '2026-11-03');
    const rows = premiums(2156880, '2026-11-03', j, 'food', '18-59', null);
    const by = (k: string) => rows.find((r) => r.kind === k)!;
    expect(by('pension').worker).toBe(102410);
    expect(by('health').worker).toBe(77530);
    expect(by('ltc').worker).toBe(10180);
    expect(by('employment').worker).toBe(19410);
    expect(by('employment').employer).toBe(24800);
    expect(by('industrial').employer).toBe(18540);
    const t = premiumTotals(rows);
    expect(t.worker).toBe(209530);
    expect(t.employer).toBe(233460);
  });
  it('#1-1 2027.1.1 국민연금 5% → 107,800원', () => {
    const j = judgeInsurance(adult40, '2027-01-01');
    const rows = premiums(2156880, '2027-01-01', j, 'food', '18-59', null);
    expect(rows.find((r) => r.kind === 'pension')!.worker).toBe(107800);
    expect(rows.find((r) => r.kind === 'health')!.status).toBe('announced');
  });
  it('#3·#4 기준소득월액 상한·하한 (보험료 10원 미만 절사 — 공단별 끝수 확인 전)', () => {
    const j = judgeInsurance(adult40, '2026-11-03');
    expect(premiums(7000000, '2026-11-03', j, 'food', '18-59', null).find((r) => r.kind === 'pension')!.worker).toBe(313020);
    expect(premiums(300000, '2026-11-03', j, 'food', '18-59', null).find((r) => r.kind === 'pension')!.worker).toBe(19470);
  });
  it('#5·#6 주 14시간: 2개월 계약은 제외, 기간 없음(3개월 이상)은 고용 대상', () => {
    const short = judgeInsurance({ ...adult40, weeklyHours: 14, employmentType: 'fixed', hireDate: '2026-11-01', contractEnd: '2026-12-31' }, '2026-11-03');
    const v = (j: typeof short, k: string) => j.find((x) => x.kind === k)!.verdict;
    expect(v(short, 'health')).toBe('excluded');
    expect(v(short, 'pension')).toBe('excluded');
    expect(v(short, 'employment')).toBe('excluded');
    expect(v(short, 'industrial')).toBe('expected');
    const long = judgeInsurance({ ...adult40, weeklyHours: 14 }, '2026-11-03');
    expect(v(long, 'employment')).toBe('expected');
  });
  it('#6-1 2027.1.1 주 14시간 2개월 계약 → 고용보험 기준 없음, 합계 숨김', () => {
    const j = judgeInsurance({ ...adult40, weeklyHours: 14, employmentType: 'fixed', hireDate: '2027-01-01', contractEnd: '2027-02-28' }, '2027-01-01');
    expect(j.find((x) => x.kind === 'employment')!.verdict).toBe('noRule');
    const rows = premiums(600000, '2027-01-01', j, 'food', '18-59', null);
    expect(premiumTotals(rows).employer).toBeNull();
  });
  it('#7 65세 이상: 65세 전 근무 여부를 모르면 확인 필요, 65세 후 입사면 실업급여분 없음', () => {
    expect(judgeInsurance({ ...adult40, ageBand: '65+' }, '2026-11-03').find((x) => x.kind === 'employment')!.verdict).toBe('check');
    const j = judgeInsurance({ ...adult40, ageBand: '65+', startedBefore65: false }, '2026-11-03');
    const row = premiums(2156880, '2026-11-03', j, 'food', '65+', false).find((r) => r.kind === 'employment')!;
    expect(row.worker).toBe(0);
    expect(row.employer).toBe(Math.floor((2156880 * 0.0025) / 10) * 10);
    expect(j.find((x) => x.kind === 'pension')!.verdict).toBe('excluded');
  });
  it('기타 서비스업은 산재요율이 규칙 파일에 없어 합계를 내지 않는다', () => {
    const rows = premiums(2156880, '2026-11-03', judgeInsurance(adult40, '2026-11-03'), 'service', '18-59', null);
    expect(rows.find((r) => r.kind === 'industrial')!.employer).toBeNull();
    expect(premiumTotals(rows).employer).toBeNull();
  });
  it('4대보험 취득 신고 기한: 건강 14일, 연금·고용·산재 다음 달 15일', () => {
    const r = reportDeadlines('2026-11-03', '2026-11-03');
    expect(r.health).toBe('2026-11-17');
    expect(r.others).toBe('2026-12-15');
    expect(r.first).toBe('2026-11-17');
    expect(reportDeadlines('2026-12-20', '2026-12-20').others).toBe('2027-01-15');
  });
});

describe('퇴직금 손계산 예제', () => {
  it('#8 평균임금 70,333원 < 통상임금 82,560원 → 2,476,800원', () => {
    const r = severanceAmount({ serviceDays: 365, wage3m: 6470640, days3m: 92, ordinaryDaily: 82560 });
    expect(r.averageDaily).toBe(70333);
    expect(r.used).toBe('ordinary');
    expect(r.amount).toBe(2476800);
  });
  it('#9 평균임금 100,000원 → 3,000,000원', () => {
    expect(severanceAmount({ serviceDays: 365, wage3m: 9200000, days3m: 92, ordinaryDaily: 82560 }).amount).toBe(3000000);
  });
  it('#10 재직 364일 → 대상 아님', () => {
    const r = severanceAmount({ serviceDays: 364, wage3m: 9200000, days3m: 92, ordinaryDaily: 82560 });
    expect(r.eligible).toBe(false);
    expect(r.amount).toBe(0);
  });
});

describe('연차 발생', () => {
  it('1년 15일, 3년차부터 2년마다 +1, 최대 25일', () => {
    const rule = { base: 15, plusEvery2Years: 1, max: 25 };
    expect(annualDaysForYear(0, rule)).toBe(0);
    expect(annualDaysForYear(1, rule)).toBe(15);
    expect(annualDaysForYear(2, rule)).toBe(15);
    expect(annualDaysForYear(3, rule)).toBe(16);
    expect(annualDaysForYear(5, rule)).toBe(17);
    expect(annualDaysForYear(21, rule)).toBe(25);
    expect(annualDaysForYear(30, rule)).toBe(25);
  });
  it('1년 미만: 개근한 달마다 1일, 최대 11일', () => {
    expect(firstYearMonthly('2026-01-15', '2026-06-15', 0)).toBe(5);
    expect(firstYearMonthly('2026-01-15', '2026-06-14', 0)).toBe(4);
    expect(firstYearMonthly('2026-01-15', '2027-01-14', 0)).toBe(11);
    expect(firstYearMonthly('2026-01-15', '2026-06-15', 2)).toBe(3);
  });
});
