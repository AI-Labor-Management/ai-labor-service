// 홍보 페이지 + 비회원 1분 자가진단 + (급한 경우) 비회원 상담 신청 — 시연 모드
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { diagnose, diagnosisSteps, EMPTY_DIAG, PREFILL_KEY, type DiagAnswers } from '../../domain/diagnosis';
import { isValidMobile, maskPhone, phoneKey } from '../../domain/consult';
import { useStore, uid, nowIso } from '../../state/store';
import { Badge, Button, Choice, cx, Field, inputCls, LinkButton, Notice } from '../../ui/kit';
import { SERVICE_NAME } from '../../ui/layouts';

const Q: Record<keyof DiagAnswers, { q: string; options: { value: string; label: string }[]; multi?: boolean }> = {
  industry: { q: '어떤 가게인가요?', options: [{ value: 'food', label: '음식점·카페' }, { value: 'retail', label: '소매' }, { value: 'service', label: '기타 서비스업' }] },
  staff: { q: '직원이 몇 명인가요? (사장님·가족 제외)', options: [{ value: '0', label: '아직 없어요' }, { value: '1-4', label: '1~4명' }, { value: '5-9', label: '5~9명' }, { value: '10+', label: '10명 이상' }] },
  kinds: { q: '이런 직원이 있나요? (여러 개)', multi: true, options: [{ value: 'alba', label: '아르바이트' }, { value: 'foreign', label: '외국인·유학생' }, { value: 'minor', label: '18세 미만' }, { value: 'none', label: '해당 없음' }] },
  contract: { q: '근로계약서를 써서 줬나요?', options: [{ value: 'all', label: '모두' }, { value: 'some', label: '일부만' }, { value: 'none', label: '안 썼어요' }, { value: 'unknown', label: '모르겠어요' }] },
  weeklyHoliday: { q: '주 15시간 이상 직원에게 주휴수당을 주나요?', options: [{ value: 'yes', label: '줘요' }, { value: 'no', label: '안 줘요' }, { value: 'unknown', label: '모르겠어요' }, { value: 'na', label: '그런 직원 없음' }] },
  insurance: { q: '4대보험은 누가 처리하나요?', options: [{ value: 'self', label: '직접' }, { value: 'agent', label: '대리인' }, { value: 'notYet', label: '아직 안 함' }, { value: 'unknown', label: '모르겠어요' }] },
  concern: { q: '지금 가장 고민되는 건요?', options: [{ value: 'dismiss', label: '퇴사·내보내기' }, { value: 'allowance', label: '수당' }, { value: 'foreign', label: '외국인' }, { value: 'schedule', label: '일정·대타' }, { value: 'none', label: '없음' }] },
};

function DiagnosisCard() {
  const [a, setA] = useState<DiagAnswers>(EMPTY_DIAG);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'quiz' | 'result' | 'consult'>('quiz');
  const nav = useNavigate();
  const steps = diagnosisSteps(a);
  const key = steps[Math.min(step, steps.length - 1)];
  const q = Q[key];
  const result = useMemo(() => diagnose(a), [a]);
  const answered = key === 'kinds' ? a.kinds.length > 0 : a[key] !== null;

  const pick = (v: string) => {
    if (key === 'kinds') {
      const val = v as DiagAnswers['kinds'][number];
      setA((p) => ({ ...p, kinds: val === 'none' ? ['none'] : p.kinds.includes(val) ? p.kinds.filter((k) => k !== val) : [...p.kinds.filter((k) => k !== 'none'), val] }));
      return;
    }
    setA((p) => ({ ...p, [key]: v }));
    // 단일 선택은 고르면 다음으로
    setTimeout(() => {
      const nextSteps = diagnosisSteps({ ...a, [key]: v } as DiagAnswers);
      if (step + 1 >= nextSteps.length) setMode('result');
      else setStep(step + 1);
    }, 120);
  };

  const signup = () => {
    // 답은 서버에 저장하지 않는다. 가입(데모) 시 사업장 설정에만 이어받도록 이 탭의 sessionStorage에 잠시 둔다.
    try {
      sessionStorage.setItem(PREFILL_KEY, JSON.stringify({ industry: a.industry, staff: a.staff, foreign: a.kinds.includes('foreign') }));
    } catch {
      /* 저장소 차단 시 이어받기만 생략 */
    }
    nav('/start?from=diagnosis');
  };

  if (mode === 'consult') return <GuestConsultForm topic={result.topic} summary={`${a.staff ?? '-'}명 · ${Q.industry.options.find((o) => o.value === a.industry)?.label ?? '-'} · 위험 ${result.items.filter((i) => i.level === 'risk').length}건`} onBack={() => setMode('result')} />;

  if (mode === 'result')
    return (
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-brand">1분 자가진단 결과</p>
          <button type="button" className="text-sm text-muted underline" onClick={() => { setA(EMPTY_DIAG); setStep(0); setMode('quiz'); }}>
            다시 하기
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {result.items.map((i, idx) => (
            <li key={idx} className="rounded-xl border border-line p-3">
              <div className="flex items-start gap-2">
                <Badge tone={i.level === 'risk' ? 'risk' : i.level === 'check' ? 'info' : 'muted'}>{i.level === 'risk' ? '위험' : i.level === 'check' ? '확인 필요' : '알아두기'}</Badge>
                <p className="text-sm font-semibold">{i.title}</p>
              </div>
              <p className="mt-1 text-xs text-muted">근거: {i.basis}</p>
              <p className="mt-1 text-xs font-semibold text-brand">{i.join}</p>
            </li>
          ))}
          {!result.items.length && <li className="text-sm text-muted">특별히 확인할 항목이 없어요.</li>}
        </ul>
        <p className="mt-2 text-xs text-muted">답은 저장하지 않아요. 참고용 안내이며 위법 여부를 판단하지 않아요.</p>
        <Button variant="kakao" size="lg" className="mt-4 w-full" onClick={signup}>
          가입하고 관리 시작하기
        </Button>
        {result.showGuestConsult && (
          <button type="button" className="mt-3 w-full text-center text-sm font-semibold text-brand underline" onClick={() => setMode('consult')}>
            가입 없이 바로 노무사 상담 신청 →
          </button>
        )}
      </div>
    );

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <p className="font-bold text-brand">1분 자가진단</p>
        <p className="text-muted">
          {step + 1} / {steps.length}
        </p>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-canvas">
        <div className="h-1.5 rounded-full bg-brand transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
      <p className="mt-4 text-lg font-bold">{q.q}</p>
      <div className="mt-3">
        <Choice name={q.q} multi={q.multi} options={q.options} value={key === 'kinds' ? a.kinds : (a[key] as string | null)} onChange={pick} />
      </div>
      <div className="mt-5 flex justify-between">
        <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          ← 이전
        </Button>
        {(q.multi || answered) && (
          <Button variant="primary" disabled={!answered} onClick={() => (step + 1 >= steps.length ? setMode('result') : setStep(step + 1))}>
            {step + 1 >= steps.length ? '결과 보기' : '다음'}
          </Button>
        )}
      </div>
    </div>
  );
}

function GuestConsultForm({ topic, summary, onBack }: { topic: string; summary: string; onBack: () => void }) {
  const { state, update, base } = useStore();
  const [f, setF] = useState({ nickname: '', phone: '', time: '', topic, includeSummary: true, collect: false, provide: false, hp: '' });
  const [err, setErr] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (busy) return;
    const e: Record<string, string> = {};
    if (!f.nickname.trim()) e.nickname = '호칭을 적어 주세요 (실명이 아니어도 돼요)';
    if (!isValidMobile(f.phone)) e.phone = '휴대폰 번호 형식을 확인해 주세요 (예: 010-1234-5678)';
    if (!f.time.trim()) e.time = '연락 편한 시간을 적어 주세요';
    if (!f.collect || !f.provide) e.consent = '필수 동의 2개가 모두 필요해요';
    const key = phoneKey(f.phone, base);
    if (state.guestConsults.filter((g) => g.phoneKey === key).length >= 3) e.phone = '같은 번호는 하루 3회까지 신청할 수 있어요';
    setErr(e);
    if (Object.keys(e).length) return;
    if (f.hp) {
      setDone('신청을 처리하지 않았어요 (자동 입력 방지).');
      return;
    }
    setBusy(true);
    update((d) => {
      d.guestConsults.unshift({ id: uid('guest'), nickname: f.nickname.trim(), phoneMasked: maskPhone(f.phone), phoneKey: key, contactTime: f.time.trim(), topic: f.topic, summary: f.includeSummary ? summary : '', consents: { collect: nowIso(), provide: nowIso() }, createdAt: nowIso(), mode: 'demo' });
    });
    setDone('시연 모드라 실제로 전송하지 않았어요. 이 브라우저의 노무법인 화면(데모)에서 도착하는 모습만 볼 수 있어요 — 번호는 가려서 남겼어요.');
  };
  if (done)
    return (
      <div>
        <Notice tone="warn" title="전송하지 않음 · 시연 모드">
          {done}
        </Notice>
        <Button className="mt-4 w-full" onClick={onBack}>
          결과로 돌아가기
        </Button>
      </div>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      noValidate
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-brand">노무사 상담 신청 (비회원)</p>
        <Badge tone="warn">시연 모드 · 전송 안 함</Badge>
      </div>
      <p className="mt-1 text-xs text-muted">노무사 연결은 무료, 상담 비용과 방식은 노무법인과 직접 정해요.</p>
      <div className="mt-3 grid gap-3">
        <Field label="이름(호칭)" htmlFor="g-n" error={err.nickname}>
          <input id="g-n" className={inputCls} value={f.nickname} onChange={(e) => setF({ ...f, nickname: e.target.value })} placeholder="예: 카페 사장님" />
        </Field>
        <Field label="휴대폰 번호" htmlFor="g-p" error={err.phone}>
          <input id="g-p" className={inputCls} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="010-0000-0000" />
        </Field>
        <Field label="연락 편한 시간" htmlFor="g-t" error={err.time}>
          <input id="g-t" className={inputCls} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} placeholder="예: 평일 오후 2~5시" />
        </Field>
        <Field label="상담 주제" htmlFor="g-topic">
          <select id="g-topic" className={inputCls} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
            {['퇴사·내보내기', '수당', '외국인', '일정·대타', '기타'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.includeSummary} onChange={(e) => setF({ ...f, includeSummary: e.target.checked })} /> 진단 요약 함께 보내기 (선택): <span className="text-muted">{summary}</span>
        </label>
        <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={f.hp} onChange={(e) => setF({ ...f, hp: e.target.value })} />
        <div className="rounded-xl border border-line p-3 text-sm">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={f.collect} onChange={(e) => setF({ ...f, collect: e.target.checked })} />
            <span>
              <b>[필수] 개인정보 수집·이용 동의</b>
              <br />
              <span className="text-xs text-muted">항목: 호칭, 휴대폰 번호, 연락 시간, 진단 요약(선택) · 목적: 상담 연결 · 보유: 상담 종료 후 6개월(예시, 확정 전) · 거부할 수 있으나 신청이 불가해요</span>
            </span>
          </label>
          <label className="mt-2 flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={f.provide} onChange={(e) => setF({ ...f, provide: e.target.checked })} />
            <span>
              <b>[필수] 노무법인 제공 동의</b>
              <br />
              <span className="text-xs text-muted">받는 곳: 협력 노무법인(협약 후 표시) · 항목: 위와 같음 · 목적: 상담 · 보유: 위와 같음</span>
            </span>
          </label>
          {err.consent && <p className="mt-2 text-xs font-semibold text-risk">{err.consent}</p>}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={onBack}>결과로 돌아가기</Button>
        <Button type="submit" variant="primary" className="flex-1" disabled={busy}>
          신청하기 (시연)
        </Button>
      </div>
    </form>
  );
}

const PAINS = [
  { t: '야간·연장·주휴, 수당 계산이 제일 어려워요', j: '근무 시간만 확정하면 주휴·가산을 근거와 함께 계산해요. 1~4명은 가산이 왜 0원인지도 보여줘요.' },
  { t: '근무 조정·대타가 기록보다 더 힘들어요', j: '일정이 기준이고, 대타와 출퇴근 기록은 일정을 고치는 수단이에요. 누가 무엇을 고쳤는지 남아요.' },
  { t: '4대보험은 맡겼는데 상태를 모르겠어요', j: '직원별 처리 방식과 신고 기한(건강 14일, 연금·고용·산재 다음 달 15일)을 날짜로 보여줘요.' },
  { t: '직원을 내보내는 게 가장 어려워요', j: '퇴사 처리 마법사로 예고·마지막 급여·퇴직금·보험 상실을 순서대로, 판단이 필요하면 노무사로.' },
  { t: '갑자기 그만두면 사람이 비어요', j: '퇴사 처리 끝에 빈 근무를 보여주고 대타 지정·채용 전 점검으로 이어줘요.' },
  { t: '퇴직금은 생각도 못 하고 있었어요', j: '재직 중에도 예상 퇴직금과 "1년 되는 날"을 보여줘요.' },
];

const FEATURES = [
  ['서류', '업종·규모·직원 조건에 맞는 서류만, 해당 없는 건 이유와 함께'],
  ['급여', '최저임금·주휴·가산·공제, 확정하면 임금명세서 앱 교부'],
  ['보험·퇴직금', '가입 예상 판정, 사장님 부담액, 고지서 금액 우선'],
  ['기한', '수습·계약·체류·보건증·신고 기한을 원래 날짜에서 자동 계산'],
  ['근무', '일정·대타·출퇴근 기록·수정 이력·연차(5명 이상)'],
  ['상담', '자주 묻는 질문 먼저, 필요하면 고른 항목만 노무사에게'],
];

export default function Landing() {
  const { session } = useStore();
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/" className="font-bold">
            {SERVICE_NAME} <span className="text-xs font-normal text-muted">(가칭)</span>
          </Link>
          <nav className="ml-auto hidden gap-5 text-sm text-muted md:flex">
            <a href="#diag">자가진단</a>
            <a href="#pains">사장님들의 고민</a>
            <a href="#features">가입하면</a>
          </nav>
          <div className="ml-auto flex gap-2 md:ml-0">
            <LinkButton to={session ? `/${session.role}` : '/start'} size="sm">
              {session ? '앱으로' : '로그인'}
            </LinkButton>
            <LinkButton to="/start" size="sm" variant="primary">
              가입하기
            </LinkButton>
          </div>
        </div>
        <p className="bg-ink px-4 py-1 text-center text-xs text-white/85">로컬 데모 초안 — 실제 가입·전송·결제가 일어나지 않아요</p>
      </header>

      <section id="diag" className="bg-gradient-to-b from-brand-soft/60 to-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[1.1fr_1fr] md:py-16">
          <div>
            <h1 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              수당 계산, 근무 조정, 4대보험까지
              <br />
              혼자 챙기기 벅차셨죠
            </h1>
            <p className="mt-4 text-lg text-ink/80">평소엔 서비스가 노무 의무를 챙기고, 중요한 순간엔 노무사와 연결돼요.</p>
            <ul className="mt-6 space-y-2 text-[15px]">
              {['“알바 주휴수당, 얼마를 줘야 하는지 모르겠어요”', '“대타 구하고 시간 바꾸다 보면 기록이 엉망이에요”', '“계약서는… 써야 하는 거죠?”', '“그만두겠다는 직원, 뭘 먼저 해야 하죠?”'].map((s) => (
                <li key={s} className="rounded-xl bg-white/80 px-4 py-2 shadow-sm">
                  {s}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5 shadow-lg">
            <DiagnosisCard />
          </div>
        </div>
      </section>

      <section id="pains" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">사장님들이 직접 말한 어려움</h2>
        <p className="mt-1 text-xs text-muted">경성대 주변 상권 소상공인 설문 — 한 상권의 응답이라 전체와 다를 수 있어요.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PAINS.map((p) => (
            <div key={p.t} className="rounded-2xl border border-line p-5">
              <p className="font-bold">{p.t}</p>
              <p className="mt-3 text-sm text-muted">
                <span className="font-semibold text-brand">가입하면 이렇게 → </span>
                {p.j}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-2xl font-bold">가입하면 이렇게 관리해요</h2>
          <p className="mt-1 text-sm text-muted">직원 정보를 한 번 입력하면 서류·임금·보험·기한을 점검해 "오늘 처리할 일"로 알려줘요.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([t, d]) => (
              <div key={t} className="rounded-2xl bg-white p-5">
                <p className="font-bold text-brand">{t}</p>
                <p className="mt-1 text-sm">{d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-5">
              <Badge tone="brand">1 · 예방</Badge>
              <p className="mt-2 font-bold">평소엔 서비스가 챙겨요</p>
              <p className="mt-1 text-sm text-muted">홈의 할 일을 위험 → 7일 이내 → 확인 필요 순으로, 누르면 바로 처리 화면으로.</p>
            </div>
            <div className="rounded-2xl bg-white p-5">
              <Badge tone="warn">2 · 해결 (회원 혜택)</Badge>
              <p className="mt-2 font-bold">중요한 순간엔 노무사와</p>
              <p className="mt-1 text-sm text-muted">보낼 항목을 사장님이 직접 고르고 동의한 뒤 공유해요. 언제든 철회할 수 있어요. 연결은 무료, 상담 비용·방식은 노무법인과 직접.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold">원칙 3가지</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {[
            ['덜 받아요', '직원 실명·주민등록번호·서류 파일을 저장하지 않아요. 별칭과 나이대로 계산해요.'],
            ['단정하지 않아요', '쉬운 말 먼저, 근거 조문과 기준일은 아래에. 위법 여부를 판단하지 않아요.'],
            ['고른 것만 공유해요', '노무법인에는 사장님이 고른 항목만, 동의 후, 철회 가능하게.'],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-line p-5">
              <p className="font-bold">{t}</p>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </div>
          ))}
        </div>
        <h2 className="mt-10 text-2xl font-bold">자주 묻는 질문</h2>
        <div className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {[
            ['직원이 가입하지 않아도 쓸 수 있나요?', '네. 사장님 혼자 모든 기능을 쓸 수 있어요. 직원 가입은 명세서 수령 확인·출퇴근 기록을 위한 선택이에요.'],
            ['계산 결과를 그대로 믿어도 되나요?', '법령 수치는 기준일·시행 구간·근거·확인 상태와 함께 보여드려요. 참고용이며, 판단이 필요한 건 노무사 확인을 권해요.'],
            ['노무사 상담은 유료인가요?', '연결은 무료예요. 상담 비용과 방식은 노무법인과 직접 정해요.'],
          ].map(([q, a]) => (
            <details key={q} className="p-4">
              <summary className="cursor-pointer font-semibold">{q}</summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="bg-brand text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-10">
          <p className="text-xl font-bold">오늘 처리할 노무 일, 한 화면에서 시작해요</p>
          <LinkButton to="/start" variant="kakao" size="lg">
            카카오로 시작하기 (데모)
          </LinkButton>
        </div>
      </section>
      <footer className="px-4 py-6 text-center text-xs text-muted">
        {SERVICE_NAME} (가칭) · 로컬 데모 초안 · 협력 노무법인 이름은 협약 후 표시해요
      </footer>
      <div className={cx('fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white p-3 md:hidden')}>
        <LinkButton to="/start" variant="primary" className="w-full">
          가입하고 시작하기
        </LinkButton>
      </div>
    </div>
  );
}
