// 법령 수치는 코드에 넣지 않고 data/rules.json(원본 자료의 053_rules.json을 그대로 복사)에서 기준일로 고른다.
// 상태: verified(원문 확인) / partial(일부 확인) / announced(발표, 법령 개정 전) / pending(시행령 대기) / needsExpert(노무사 확인)
import raw from '../data/rules.json';
import type { ISODate } from './types';

export type RuleStatus = 'verified' | 'partial' | 'announced' | 'pending' | 'needsExpert';

export interface RuleSource {
  type: string;
  ref?: string;
  law?: string;
  article?: string;
  quote?: string;
  paragraph?: number;
  file?: string;
  url?: string;
  check?: { ok?: boolean; versionFrom?: string; versionStatus?: string; hash?: string; lawEffective?: string; lawNumber?: string };
}

export interface RuleValue {
  value: unknown;
  effectiveFrom?: string;
  effectiveTo?: string;
  status: RuleStatus;
  verifiedAt?: string;
  verifiedBy?: string;
  sources?: RuleSource[];
  note?: string;
}

export interface Rule {
  id: string;
  label: string;
  category: string;
  unit?: string;
  check?: string;
  usedIn?: string[];
  values: RuleValue[];
  note?: string;
  appliesTo?: { minEmployees?: number };
}

export interface RulesFile {
  schema: string;
  generatedAt: string;
  basis: string;
  howToRead: Record<string, unknown>;
  rules: Rule[];
}

export const RULES_FILE = raw as unknown as RulesFile;
const BY_ID = new Map(RULES_FILE.rules.map((r) => [r.id, r]));

export function getRule(id: string): Rule | undefined {
  return BY_ID.get(id);
}

export function allRules(): Rule[] {
  return RULES_FILE.rules;
}

export type Resolved<T> =
  | {
      ok: true;
      id: string;
      label: string;
      value: T;
      status: RuleStatus;
      effectiveFrom?: string;
      effectiveTo?: string;
      verifiedAt?: string;
      sources: RuleSource[];
      note?: string;
    }
  | {
      ok: false;
      id: string;
      label: string;
      reason: 'unknownRule' | 'noValueForDate' | 'pending';
      status?: RuleStatus;
      effectiveFrom?: string;
      sources: RuleSource[];
      note?: string;
    };

/**
 * 기준일이 들어가는 시행 구간의 값을 고른다.
 * pending(시행령 대기)이거나 값이 null이면 이전 값으로 계산하지 않고 ok:false를 돌려준다.
 */
export function resolveRule<T = unknown>(id: string, date: ISODate): Resolved<T> {
  const rule = BY_ID.get(id);
  if (!rule) return { ok: false, id, label: id, reason: 'unknownRule', sources: [] };
  const hit = rule.values.find(
    (v) => (!v.effectiveFrom || date >= v.effectiveFrom) && (!v.effectiveTo || date <= v.effectiveTo),
  );
  if (!hit) return { ok: false, id, label: rule.label, reason: 'noValueForDate', sources: [], note: rule.note };
  if (hit.status === 'pending' || hit.value === null || hit.value === undefined) {
    return {
      ok: false,
      id,
      label: rule.label,
      reason: 'pending',
      status: hit.status,
      effectiveFrom: hit.effectiveFrom,
      sources: hit.sources ?? [],
      note: hit.note ?? rule.note,
    };
  }
  return {
    ok: true,
    id,
    label: rule.label,
    value: hit.value as T,
    status: hit.status,
    effectiveFrom: hit.effectiveFrom,
    effectiveTo: hit.effectiveTo,
    verifiedAt: hit.verifiedAt,
    sources: hit.sources ?? [],
    note: hit.note ?? rule.note,
  };
}

/** 값이 반드시 있어야 하는 계산(예: 가산율)에서 사용. 없으면 예외 — 테스트로 데이터 누락을 잡는다. */
export function ruleValue<T>(id: string, date: ISODate): T {
  const r = resolveRule<T>(id, date);
  if (!r.ok) throw new Error(`규칙 ${id}의 ${date} 기준 값이 없습니다 (${r.reason})`);
  return r.value;
}

export const STATUS_LABEL: Record<RuleStatus | 'missing', string> = {
  verified: '원문 확인',
  partial: '일부 확인',
  announced: '발표 기준 · 법령 개정 전',
  pending: '기준 대기 · 시행령 미정',
  needsExpert: '노무사 확인 필요',
  missing: '이 날짜의 기준이 아직 없어요',
};

export function sourceLabel(s: RuleSource): string {
  if (s.law && s.article) return `${s.law} ${s.article}`;
  return s.ref ?? s.law ?? s.type;
}

/** 화면의 "근거" 한 줄 요약 */
export function basisText(id: string, date: ISODate): string {
  const r = resolveRule(id, date);
  const srcs = r.sources.map(sourceLabel);
  return srcs.length ? Array.from(new Set(srcs)).join(' · ') : r.label;
}
