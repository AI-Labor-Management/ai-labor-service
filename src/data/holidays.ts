// 공휴일 목록. 기획은 한국천문연구원 특일정보 API 결과를 data/holidays.json에 저장해 쓰는 것이다(20_부가기능 3장).
// API 키 전이라 앱에 내장한 목록을 쓴다. 2026-11-07에 아래 공식 자료와 대조했다.
//  · 2027년: 우주항공청 「2027년 월력요항」 보도자료 — 대체공휴일 2/9·5/3·7/19·8/16·10/4·10/11·12/27
//  · 2026년: 우주항공청 「2026년 월력요항」(2025-06-30) — 추석 연휴는 9/24~26(토)이라 대체공휴일 없음(9/28은 평일)
//  · 노동절(5/1)·제헌절(7/17): 「관공서의 공휴일에 관한 규정」 개정(대통령령 제36290호, 2026-04-30 공포, 노동절 2026-05-01 시행·
//    제헌절 2026-05-11 시행 — rules.json holidays.legal의 effectiveFrom은 뒤쪽 날짜). 토·일·다른 공휴일과 겹치면 다음 첫 비공휴일이 대체공휴일.
// 새 해(2028년~) 날짜는 월력요항이 나오면(매년 6월) 같은 방식으로 더하거나 특일정보 API로 바꾼다.
import type { ISODate } from '../domain/types';

export interface Holiday {
  date: ISODate;
  name: string;
  substitute?: boolean;
}

export const HOLIDAY_SOURCE = {
  label: '앱 내장 목록 (특일정보 API 연결 전)',
  status: 'checked' as const,
  note: '2026·2027년은 우주항공청 월력요항과 공휴일 규정 개정(노동절·제헌절)에 맞춰 확인했어요(2026-11-07). 2028년부터는 API 연결이나 목록 추가가 필요해요.',
};

export const HOLIDAYS: Holiday[] = [
  { date: '2026-01-01', name: '신정' },
  { date: '2026-02-16', name: '설날 연휴' },
  { date: '2026-02-17', name: '설날' },
  { date: '2026-02-18', name: '설날 연휴' },
  { date: '2026-03-02', name: '삼일절 대체공휴일', substitute: true },
  { date: '2026-05-01', name: '노동절' },
  { date: '2026-05-05', name: '어린이날' },
  { date: '2026-05-25', name: '부처님오신날 대체공휴일', substitute: true },
  { date: '2026-06-03', name: '전국동시지방선거' },
  { date: '2026-07-17', name: '제헌절' },
  { date: '2026-08-17', name: '광복절 대체공휴일', substitute: true },
  { date: '2026-09-24', name: '추석 연휴' },
  { date: '2026-09-25', name: '추석' },
  { date: '2026-10-05', name: '개천절 대체공휴일', substitute: true },
  { date: '2026-10-09', name: '한글날' },
  { date: '2026-12-25', name: '성탄절' },
  { date: '2027-01-01', name: '신정' },
  { date: '2027-02-08', name: '설날 연휴' },
  { date: '2027-02-09', name: '설날 대체공휴일', substitute: true },
  { date: '2027-03-01', name: '삼일절' },
  { date: '2027-05-03', name: '노동절 대체공휴일', substitute: true },
  { date: '2027-05-05', name: '어린이날' },
  { date: '2027-05-13', name: '부처님오신날' },
  { date: '2027-07-19', name: '제헌절 대체공휴일', substitute: true },
  { date: '2027-08-16', name: '광복절 대체공휴일', substitute: true },
  { date: '2027-09-14', name: '추석 연휴' },
  { date: '2027-09-15', name: '추석' },
  { date: '2027-09-16', name: '추석 연휴' },
  { date: '2027-10-04', name: '개천절 대체공휴일', substitute: true },
  { date: '2027-10-11', name: '한글날 대체공휴일', substitute: true },
  { date: '2027-12-27', name: '성탄절 대체공휴일', substitute: true },
];

// 토·일과 겹쳐 평일 휴무가 생기지 않는 날(예: 2026-03-01 일, 2027-05-01 토)은 목록 표시용으로만 남긴다.
export const WEEKEND_HOLIDAYS: Holiday[] = [
  { date: '2026-03-01', name: '삼일절' },
  { date: '2026-05-24', name: '부처님오신날' },
  { date: '2026-06-06', name: '현충일' },
  { date: '2026-08-15', name: '광복절' },
  { date: '2026-09-26', name: '추석 연휴' },
  { date: '2026-10-03', name: '개천절' },
  { date: '2027-02-06', name: '설날 연휴' },
  { date: '2027-02-07', name: '설날' },
  { date: '2027-05-01', name: '노동절' },
  { date: '2027-06-06', name: '현충일' },
  { date: '2027-07-17', name: '제헌절' },
  { date: '2027-08-15', name: '광복절' },
  { date: '2027-10-03', name: '개천절' },
  { date: '2027-10-09', name: '한글날' },
  { date: '2027-12-25', name: '성탄절' },
];

const MAP = new Map([...HOLIDAYS, ...WEEKEND_HOLIDAYS].map((h) => [h.date, h]));

export function holidayOn(date: ISODate): Holiday | undefined {
  return MAP.get(date);
}

export const HOLIDAY_YEARS = [2026, 2027];

