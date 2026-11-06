// S01 사업장 설정 — 진단 답 이어받기, 급여 지급일·몇 월분, GPS(가상), 규모 경고
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { PREFILL_KEY } from '../../domain/diagnosis';
import { useStore, nowIso } from '../../state/store';
import type { Industry, PayMonthBasis, ScaleBand, Workplace } from '../../domain/types';
import { Button, Card, Choice, Field, inputCls, Notice, PageHeader, useToast } from '../../ui/kit';
import { INDUSTRY_LABEL, SCALE_LABEL, SCALE_MAX } from '../../ui/labels';
import { UnsavedChanges } from '../../ui/UnsavedChanges';

function readPrefill(): Partial<Workplace> & { foreign?: boolean } {
  try {
    const t = sessionStorage.getItem(PREFILL_KEY);
    if (!t) return {};
    const p = JSON.parse(t) as { industry: Industry | null; staff: string | null; foreign: boolean };
    const scale: ScaleBand | undefined = p.staff === '5-9' ? '5-9' : p.staff === '10+' ? '10+' : p.staff ? '1-4' : undefined;
    return { industry: p.industry ?? undefined, scale, foreign: p.foreign };
  } catch {
    return {};
  }
}

export default function Setup() {
  const { state, update, base } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const prefill = useMemo(readPrefill, []);
  const existing = state.workplace;
  const [f, setF] = useState<Workplace>(
    existing ?? {
      name: '',
      industry: prefill.industry ?? 'food',
      scale: prefill.scale ?? '1-4',
      familyOnly: false,
      payDay: 10,
      payMonthBasis: 'previous',
      gpsEnabled: false,
      address: '',
      radiusM: 100,
      lateToleranceMin: 5,
      defaultInsuranceMethod: null,
      hourlyLeaveAllowed: false,
      firmInsuranceShareConsent: false,
      createdAt: nowIso(),
    },
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const allowLeave = useRef(false);
  const initialForm = useRef(JSON.stringify(f));
  const activeCount = state.employees.filter((e) => !e.resignDate || e.resignDate >= base).length;
  const over = activeCount > SCALE_MAX[f.scale];

  const save = () => {
    const e: Record<string, string> = {};
    if (!Number.isInteger(f.payDay) || f.payDay < 1 || f.payDay > 31) e.payDay = '1~31 사이로 골라 주세요';
    if (f.gpsEnabled && !f.address.trim()) e.address = 'GPS를 켜면 사업장 주소가 필요해요';
    if (f.gpsEnabled && (f.radiusM < 30 || f.radiusM > 1000)) e.radius = '반경은 30~1,000m';
    if (f.lateToleranceMin < 0 || f.lateToleranceMin > 60) e.tol = '0~60분';
    setErrors(e);
    if (Object.keys(e).length) return;
    allowLeave.current = true;
    const scaleChanged = existing && existing.scale !== f.scale;
    update((d) => {
      d.workplace = { ...f, address: f.gpsEnabled ? f.address.trim() : '' };
    });
    try {
      sessionStorage.removeItem(PREFILL_KEY);
    } catch {
      /* noop */
    }
    toast(scaleChanged ? '저장했어요. 규모가 바뀌어 위험 점검 일부를 다시 확인해요.' : '사업장 설정을 저장했어요');
    nav(existing ? '/owner/settings' : '/owner');
  };

  return (
    <div className="max-w-3xl">
      <UnsavedChanges when={JSON.stringify(f) !== initialForm.current} bypass={allowLeave} />
      <PageHeader title={existing ? '사업장 설정' : '사업장 설정 (처음 한 번)'} sub="같은 정보를 두 번 묻지 않아요. 여기 값이 서류·급여·보험·기한·홈에서 함께 쓰여요." />
      {!existing && prefill.industry && <Notice tone="brand" className="mb-4" title="자가진단 답을 미리 채웠어요">업종·규모{prefill.foreign ? '·외국인 직원 있음' : ''}을 확인하고 저장하세요.</Notice>}
      <div className="grid gap-4">
        <Card title="기본">
          <div className="grid gap-4">
            <Field label="상호 (선택)" htmlFor="wp-name" hint="GPS·출력물 외에는 쓰지 않아요">
              <input id="wp-name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="예: 카페 샘터" />
            </Field>
            <Field label="업종">
              <Choice name="업종" options={(Object.keys(INDUSTRY_LABEL) as Industry[]).map((v) => ({ value: v, label: INDUSTRY_LABEL[v] }))} value={f.industry} onChange={(v) => setF({ ...f, industry: v })} />
            </Field>
            <Field label="규모 구간 (상시 근로자 수)" hint="사장님·동거 가족 제외. 서류·가산·연차 적용이 달라져요">
              <Choice name="규모" options={(Object.keys(SCALE_LABEL) as ScaleBand[]).map((v) => ({ value: v, label: SCALE_LABEL[v] }))} value={f.scale} onChange={(v) => setF({ ...f, scale: v })} />
            </Field>
            {over && (
              <Notice tone="warn" title={`등록 직원 ${activeCount}명이 고른 구간(${SCALE_LABEL[f.scale]})을 넘어요`}>
                상시 근로자 수는 법 적용 사유 발생일 전 1개월 연인원을 가동 일수로 나눠 산정하고, 기준에 못 미치는 날이 절반 이상이면 미달로 봐요 (근로기준법 시행령 제7조의2). 연차는 1년 기준으로 따로 봐요. 맞는지 확인해 주세요.
              </Notice>
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" checked={f.familyOnly} onChange={(e) => setF({ ...f, familyOnly: e.target.checked })} />
              <span>
                동거하는 친족만 사용하는 사업장이에요
                <br />
                <span className="text-xs text-muted">근로기준법 적용 제외 (제11조). 체크하면 최저임금 게시 등 일부 항목이 빠져요.</span>
              </span>
            </label>
          </div>
        </Card>
        <Card title="급여">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="급여 지급일" htmlFor="wp-payday" error={errors.payDay}>
              <select id="wp-payday" className={inputCls} value={f.payDay} onChange={(e) => setF({ ...f, payDay: Number(e.target.value) })}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    매달 {d === 31 ? '말일' : `${d}일`}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="몇 월분" hint="예: 매달 10일에 전월분">
              <Choice<PayMonthBasis> name="몇 월분" options={[{ value: 'previous', label: '전월분' }, { value: 'current', label: '당월분' }]} value={f.payMonthBasis} onChange={(v) => setF({ ...f, payMonthBasis: v })} />
            </Field>
          </div>
          {f.scale !== '1-4' && (
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.hourlyLeaveAllowed} onChange={(e) => setF({ ...f, hourlyLeaveAllowed: e.target.checked })} /> 우리 사업장은 시간 단위 연차를 써요 (2027.6.10 개정 전 기준)
            </label>
          )}
        </Card>
        <Card title="출퇴근 (GPS)" right="카카오맵 연결 대기 — 가상 위치로 시연">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.gpsEnabled} onChange={(e) => setF({ ...f, gpsEnabled: e.target.checked })} /> GPS 출퇴근 사용 (버튼을 누를 때만 위치 확인, 실시간 추적 없음)
          </label>
          {f.gpsEnabled && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Field label="사업장 주소" htmlFor="wp-addr" error={errors.address} hint="지도 검색은 연결 대기 — 텍스트만 저장">
                <input id="wp-addr" className={inputCls} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
              </Field>
              <Field label="인증 반경 (m)" htmlFor="wp-r" error={errors.radius}>
                <input id="wp-r" type="number" className={inputCls} value={f.radiusM} onChange={(e) => setF({ ...f, radiusM: Number(e.target.value) })} />
              </Field>
              <Field label="지각 허용 오차 (분)" htmlFor="wp-t" error={errors.tol}>
                <input id="wp-t" type="number" className={inputCls} value={f.lateToleranceMin} onChange={(e) => setF({ ...f, lateToleranceMin: Number(e.target.value) })} />
              </Field>
            </div>
          )}
          <p className="mt-2 text-xs text-muted">GPS를 끈 사업장은 일정이 곧 실제 근무이고, 바뀐 날만 사장님이 고쳐요.</p>
        </Card>
        <Card title="알림 · 공유">
          <div className="flex flex-col gap-3 text-sm">
            <Button variant="kakao" reason="연결 대기 — 카카오 메시지 API 동의와 서버 예약 실행이 필요해요. 지금은 앱 안 알림과 캘린더 파일만 동작해요.">
              카톡으로 알림 받기
            </Button>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={f.firmInsuranceShareConsent} onChange={(e) => setF({ ...f, firmInsuranceShareConsent: e.target.checked })} />
              <span>
                4대보험을 "대리인에게 맡김"으로 고른 직원의 신고 상태를 협력 노무법인 화면에 공유해요
                <br />
                <span className="text-xs text-muted">공유 항목: 별칭, 입사·퇴사일, 신고 상태. 동의하면 노무법인이 처리 완료로 표시할 때 "처리 확인"이 채워져요. 언제든 끌 수 있어요.</span>
              </span>
            </label>
          </div>
        </Card>
        <div className="flex justify-end gap-2">
          {existing && <Button onClick={() => nav(-1)}>취소</Button>}
          <Button variant="primary" size="lg" onClick={save}>
            저장
          </Button>
        </div>
      </div>
    </div>
  );
}

