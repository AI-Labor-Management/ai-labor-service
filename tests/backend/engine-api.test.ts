// Edge Function이 쓰는 계산 엔진 계약(Engine)을 실제 src/domain 함수가 만족하는지 tsc가 검사한다.
// (npm run typecheck / build 에서 이 파일이 컴파일되며, 계약과 실제 함수가 어긋나면 타입 오류로 실패)
import { describe, expect, it } from 'vitest';
import * as real from '../../supabase/functions/_shared/domain-entry';
import type { Engine } from '../../supabase/functions/_shared/engine-api.ts';

const contract: Engine = real;

describe('계산 엔진 계약', () => {
  it('Edge Function이 쓰는 함수가 모두 있다', () => {
    const names = ['computeDeadlines', 'draftLines', 'payrollLines', 'classifyClock', 'buildIcs', 'createSeed', 'diagnose', 'quickWage', 'detectPII'] as const;
    for (const n of names) expect(typeof contract[n]).toBe('function');
    expect(contract.RULES_FILE.rules).toHaveLength(48); // 44 + 출산·육아·벌칙 4 (2026-11-11)
  });
});
