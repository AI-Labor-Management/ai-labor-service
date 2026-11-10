// 공공데이터포털 특일정보 응답 해석 + 공휴일 보강 (내장 목록 우선)
import { describe, expect, it } from 'vitest';
import { diffHolidays, eventsBetween, itemsOf, parseFestivals, parseHolidays, parseRegions, resultCode } from '../../supabase/functions/_shared/datagokr-core';
import { holidayOn, registerHolidays } from '../../src/data/holidays';

const resp = (item: unknown) => ({ response: { header: { resultCode: '00', resultMsg: 'NORMAL SERVICE.' }, body: { items: item === undefined ? '' : { item }, numOfRows: 100, pageNo: 1, totalCount: 2 } } });

describe('특일정보 응답 해석', () => {
  it('item이 배열·객체·없음 어느 쪽이어도 읽는다', () => {
    expect(itemsOf(resp([{ locdate: 20280101 }, { locdate: 20280126 }]))).toHaveLength(2);
    expect(itemsOf(resp({ locdate: 20280101 }))).toHaveLength(1);
    expect(itemsOf(resp(undefined))).toHaveLength(0);
    expect(itemsOf(null)).toHaveLength(0);
    expect(resultCode(resp([]))).toBe('00');
  });

  it('공휴일만 날짜순으로, 같은 날은 이름을 합친다', () => {
    const r = parseHolidays(
      resp([
        { dateKind: '01', dateName: '추석', isHoliday: 'Y', locdate: 20281003, seq: 1 },
        { dateKind: '01', dateName: '1월1일', isHoliday: 'Y', locdate: 20280101, seq: 1 },
        { dateKind: '01', dateName: '개천절', isHoliday: 'Y', locdate: 20281003, seq: 2 },
        { dateKind: '01', dateName: '기념일', isHoliday: 'N', locdate: 20280405, seq: 1 },
        { dateKind: '01', dateName: '이상한 값', isHoliday: 'Y', locdate: 'x' },
      ]),
    );
    expect(r).toEqual([
      { date: '2028-01-01', name: '1월1일' },
      { date: '2028-10-03', name: '추석·개천절' },
    ]);
  });

  it('내장 목록과 API가 다른 날을 찾는다', () => {
    expect(diffHolidays(['2027-01-01', '2027-02-09'], [{ date: '2027-01-01', name: 'x' }, { date: '2027-05-03', name: 'y' }], 2027)).toEqual({
      onlyBuiltIn: ['2027-02-09'],
      onlyApi: ['2027-05-03'],
    });
  });
});

describe('공휴일 보강', () => {
  it('내장 목록에 없는 날만 더하고, 있는 날은 바꾸지 않는다', () => {
    expect(holidayOn('2028-01-01')).toBeUndefined();
    const added = registerHolidays([
      { date: '2028-01-01', name: '1월1일' },
      { date: '2028-01-27', name: '설날 대체공휴일' },
      { date: '2027-01-01', name: '다른 이름' }, // 내장 목록에 있는 날
      { date: '2028/01/02', name: '형식 오류' },
    ]);
    expect(added).toBe(2);
    expect(holidayOn('2028-01-01')?.name).toBe('1월1일');
    expect(holidayOn('2028-01-27')?.substitute).toBe(true);
    expect(holidayOn('2027-01-01')?.name).toBe('신정');
    expect(registerHolidays([{ date: '2028-01-01', name: '1월1일' }])).toBe(0);
  });
});

describe('지역 행사 (TourAPI) 응답 해석', () => {
  const tour = (item: unknown) => ({ response: { header: { resultCode: '0000', resultMsg: 'OK' }, body: { items: item === undefined ? '' : { item }, numOfRows: 10, pageNo: 1, totalCount: 1 } } });

  it('지역 목록: code/name 이든 lDong…Cd/Nm 이든 읽고 형식이 틀린 코드는 뺀다', () => {
    expect(parseRegions(tour([{ code: '11', name: '서울특별시' }, { code: '26', name: '부산광역시' }, { code: 'x', name: '?' }]), 'sido')).toEqual([
      { code: '11', name: '서울특별시' },
      { code: '26', name: '부산광역시' },
    ]);
    expect(parseRegions(tour({ lDongSignguCd: '500', lDongSignguNm: '수영구' }), 'sigungu')).toEqual([{ code: '500', name: '수영구' }]);
    expect(parseRegions(tour(undefined), 'sido')).toEqual([]);
  });

  it('행사: 제목·기간·주소만 읽고, 기간과 겹치는 것만 시작일 순으로', () => {
    const list = parseFestivals(
      tour([
        { contentid: 1, title: '광안리 불꽃축제', eventstartdate: '20261114', eventenddate: '20261114', addr1: '부산광역시 수영구 광안해변로', firstimage: 'http://x/y.jpg' },
        { contentid: 2, title: '지난 행사', eventstartdate: '20260901', eventenddate: '20261001', addr1: '' },
        { contentid: 3, title: '진행 중 행사', eventstartdate: '20261020', eventenddate: '20261130', addr1: '부산', addr2: '망미동' },
        { contentid: 4, title: '', eventstartdate: '20261115' },
      ]),
    );
    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({ id: '1', title: '광안리 불꽃축제', start: '2026-11-14', end: '2026-11-14', addr: '부산광역시 수영구 광안해변로' });
    expect(eventsBetween(list, '2026-11-10', '2026-12-15').map((e) => e.title)).toEqual(['진행 중 행사', '광안리 불꽃축제']);
  });
});
