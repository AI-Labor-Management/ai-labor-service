import type { AgeBand, EmploymentType, Industry, InsuranceMethod, ResignType, ScaleBand } from '../domain/types';

export const INDUSTRY_LABEL: Record<Industry, string> = { food: '음식점·카페', retail: '소매', service: '기타 서비스업' };
export const SCALE_LABEL: Record<ScaleBand, string> = { '1-4': '1~4명', '5-9': '5~9명', '10+': '10명 이상' };
export const SCALE_MAX: Record<ScaleBand, number> = { '1-4': 4, '5-9': 9, '10+': Infinity };
export const AGE_LABEL: Record<AgeBand, string> = { under18: '18세 미만', '18-59': '18~59세', '60-64': '60~64세', '65+': '65세 이상' };
export const EMPLOYMENT_LABEL: Record<EmploymentType, string> = { regular: '기간 정함 없음', fixed: '기간 있음', daily: '하루 단위' };
export const INSURANCE_METHOD_LABEL: Record<InsuranceMethod, string> = { self: '직접', delegated: '대리인에게 맡김', alreadyDone: '이미 처리함', notYet: '아직 안 함' };
export const RESIGN_LABEL: Record<ResignType, string> = { self: '스스로 그만둠', contractEnd: '계약 만료', dismissal: '사장님이 내보냄', other: '기타' };
export const VISAS = ['D-2', 'D-4', 'E-9', 'H-2', 'F-4', 'other'] as const;
export const VISA_LABEL: Record<(typeof VISAS)[number], string> = { 'D-2': 'D-2 유학', 'D-4': 'D-4 연수', 'E-9': 'E-9 고용허가', 'H-2': 'H-2 방문취업', 'F-4': 'F-4 재외동포', other: '기타' };
export const SCHOOLS = ['경성대', '부경대', '동명대', '기타'];
