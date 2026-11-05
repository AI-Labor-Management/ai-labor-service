// 설정: 사업장 설정, 기준일(테스트용 고정), 연동 상태, 데이터 내보내기·가져오기·초기화·시드 복원
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { useStore } from '../../state/store';
import { migrate } from '../../adapters/storage';
import { INTEGRATIONS } from '../../adapters/integrations';
import { fmtDate, isISODate, todayLocal } from '../../domain/dates';
import { HOLIDAY_SOURCE } from '../../data/holidays';
import { Button, Card, ConnBadge, download, Field, inputCls, KV, LinkButton, Modal, Notice, PageHeader, useToast } from '../../ui/kit';
import { INDUSTRY_LABEL, SCALE_LABEL } from '../../ui/labels';

export default function Settings() {
  const { state, update, base, adapter, resetEmpty, resetSeed, replaceState } = useStore();
  const toast = useToast();
  const [d, setD] = useState(state.settings.baseDateOverride ?? todayLocal());
  const [confirm, setConfirm] = useState<null | 'empty' | 'seed'>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const wp = state.workplace!;

  const setBase = (v: string | null) => {
    update((s) => {
      s.settings.baseDateOverride = v;
    });
    toast(v ? `기준일을 ${fmtDate(v)}로 고정했어요` : '시스템 날짜를 써요');
  };

  const importFile = async (f: File) => {
    try {
      const text = await f.text();
      const s = migrate(JSON.parse(text));
      replaceState(s);
      toast('가져왔어요');
    } catch (e) {
      toast(`가져오지 못했어요: ${e instanceof Error ? e.message : '형식 오류'}`, 'risk');
    }
  };

  return (
    <div className="max-w-4xl">
      <PageHeader title="설정" />
      <div className="grid gap-4">
        <Card title="사업장" right={<LinkButton size="sm" to="/owner/setup">수정</LinkButton>}>
          <KV k="상호" v={wp.name || '—'} />
          <KV k="업종 · 규모" v={`${INDUSTRY_LABEL[wp.industry]} · ${SCALE_LABEL[wp.scale]}${wp.familyOnly ? ' · 동거 친족만' : ''}`} />
          <KV k="급여" v={`매달 ${wp.payDay === 31 ? '말일' : `${wp.payDay}일`} · ${wp.payMonthBasis === 'previous' ? '전월분' : '당월분'}`} />
          <KV k="GPS 출퇴근" v={wp.gpsEnabled ? `사용 (가상 위치) · 반경 ${wp.radiusM}m · 지각 허용 ${wp.lateToleranceMin}분` : '사용 안 함'} />
          <KV k="맡김 건 노무법인 공유" v={wp.firmInsuranceShareConsent ? '동의' : '안 함'} />
        </Card>
        <Card title="기준일" right={`지금: ${fmtDate(base)}${state.settings.baseDateOverride ? ' (고정)' : ' (시스템 날짜)'}`}>
          <p className="text-sm text-muted">모든 계산(최저임금·요율·기한·D-day)은 기준일로 규칙을 골라요. 연도 전환이나 기한을 시험할 때 고정하세요.</p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="고정할 날짜" htmlFor="st-base">
              <input id="st-base" type="date" className={inputCls} value={d} onChange={(e) => setD(e.target.value)} />
            </Field>
            <Button variant="primary" onClick={() => isISODate(d) && setBase(d)}>
              고정
            </Button>
            <Button onClick={() => { setD('2027-01-01'); setBase('2027-01-01'); }}>2027.1.1로</Button>
            <Button onClick={() => setBase(null)} reason={!state.settings.baseDateOverride ? '이미 시스템 날짜를 쓰고 있어요' : undefined}>
              시스템 날짜로
            </Button>
          </div>
        </Card>
        <Card title="연동 상태" right="실제 동작 / 로컬 데모 / 연결 대기">
          <ul className="divide-y divide-line">
            {INTEGRATIONS.map((i) => (
              <li key={i.id} className="py-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <b>{i.name}</b>
                  <ConnBadge status={i.status} />
                </div>
                <p className="text-xs">{i.what}</p>
                {i.status !== 'live' && <p className="text-xs text-muted">필요: {i.needs}{i.env.length ? ` · 환경변수 ${i.env.join(', ')}` : ''}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">공휴일: {HOLIDAY_SOURCE.label} — {HOLIDAY_SOURCE.note}</p>
        </Card>
        <Card title="데이터">
          <KV k="저장 위치" v={adapter.description} />
          <Notice tone="warn" className="mt-2">
            실제 인증·사용자별 격리가 없는 로컬 데모예요. 같은 브라우저를 쓰는 사람은 모든 역할의 데이터를 볼 수 있어요. 실제 개인정보를 넣지 마세요.
          </Notice>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => download(`ai-labor-demo-${base}.json`, JSON.stringify(state, null, 2), 'application/json')}>JSON 내보내기</Button>
            <Button onClick={() => fileRef.current?.click()}>JSON 가져오기</Button>
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
            <Button variant="danger" onClick={() => setConfirm('empty')}>
              데이터 초기화
            </Button>
            <Button onClick={() => setConfirm('seed')}>가상 시드 복원</Button>
          </div>
        </Card>
        <Card title="저장하지 않는 것">
          <p className="text-sm text-muted">직원 실명·주민등록번호·외국인등록번호·연락처, 서류·계약서 파일, F3 계산 결과, AI 대화, 채용 전 점검 입력, 보내지 않은 상담 메모, 비회원 자가진단 답, 실제 GPS 좌표.</p>
          <Link to="/owner/rules" className="mt-2 inline-block text-sm font-semibold text-brand underline">
            규칙·근거 (rules.json) 보기
          </Link>
        </Card>
      </div>
      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'empty' ? '데이터 초기화' : '가상 시드 복원'} footer={<><Button onClick={() => setConfirm(null)}>취소</Button><Button variant="danger" onClick={async () => { if (confirm === 'empty') await resetEmpty(); else await resetSeed(); setConfirm(null); toast(confirm === 'empty' ? '초기화했어요' : '가상 시드로 바꿨어요'); }}>{confirm === 'empty' ? '모두 지우기' : '시드로 바꾸기'}</Button></>}>
        <p className="text-sm">이 브라우저에 저장된 사업장·직원·급여·기록이 {confirm === 'empty' ? '모두 지워져요' : '가상 시드(카페 샘터, 직원 A·B·C)로 바뀌어요'}. 필요하면 먼저 JSON으로 내보내세요. 기준일 고정 설정은 유지돼요.</p>
      </Modal>
    </div>
  );
}
