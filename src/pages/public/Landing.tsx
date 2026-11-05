// 홍보 페이지 + 비회원 1분 자가진단 + (급한 경우) 비회원 상담 신청 — 시연 모드
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { diagnose, diagnosisSteps, EMPTY_DIAG, PREFILL_KEY, type DiagAnswers } from '../../domain/diagnosis';
import { isValidMobile, maskPhone, phoneKey } from '../../domain/consult';
import { useStore, uid, nowIso } from '../../state/store';
import { Badge, Button, Choice, Field, inputCls, Notice } from '../../ui/kit';
import { SERVICE_NAME } from '../../ui/layouts';
import { Brand, Icon, type IconName } from '../../ui/Icon';
import { SiteHeader } from '../../ui/SiteHeader';
import { usePreferences } from '../../ui/preferences';

const Q: Record<
  keyof DiagAnswers,
  { q: string; options: { value: string; label: string }[]; multi?: boolean }
> = {
  industry: {
    q: '어떤 가게인가요?',
    options: [
      { value: 'food', label: '음식점·카페' },
      { value: 'retail', label: '소매' },
      { value: 'service', label: '기타 서비스업' },
    ],
  },
  staff: {
    q: '직원이 몇 명인가요? (사장님·가족 제외)',
    options: [
      { value: '0', label: '아직 없어요' },
      { value: '1-4', label: '1~4명' },
      { value: '5-9', label: '5~9명' },
      { value: '10+', label: '10명 이상' },
    ],
  },
  kinds: {
    q: '이런 직원이 있나요? (여러 개)',
    multi: true,
    options: [
      { value: 'alba', label: '아르바이트' },
      { value: 'foreign', label: '외국인·유학생' },
      { value: 'minor', label: '18세 미만' },
      { value: 'none', label: '해당 없음' },
    ],
  },
  contract: {
    q: '근로계약서를 써서 줬나요?',
    options: [
      { value: 'all', label: '모두' },
      { value: 'some', label: '일부만' },
      { value: 'none', label: '안 썼어요' },
      { value: 'unknown', label: '모르겠어요' },
    ],
  },
  weeklyHoliday: {
    q: '주 15시간 이상 직원에게 주휴수당을 주나요?',
    options: [
      { value: 'yes', label: '줘요' },
      { value: 'no', label: '안 줘요' },
      { value: 'unknown', label: '모르겠어요' },
      { value: 'na', label: '그런 직원 없음' },
    ],
  },
  insurance: {
    q: '4대보험은 누가 처리하나요?',
    options: [
      { value: 'self', label: '직접' },
      { value: 'agent', label: '대리인' },
      { value: 'notYet', label: '아직 안 함' },
      { value: 'unknown', label: '모르겠어요' },
    ],
  },
  concern: {
    q: '지금 가장 고민되는 건요?',
    options: [
      { value: 'dismiss', label: '퇴사·내보내기' },
      { value: 'allowance', label: '수당' },
      { value: 'foreign', label: '외국인' },
      { value: 'schedule', label: '일정·대타' },
      { value: 'none', label: '없음' },
    ],
  },
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
      setA((p) => ({
        ...p,
        kinds:
          val === 'none'
            ? ['none']
            : p.kinds.includes(val)
              ? p.kinds.filter((k) => k !== val)
              : [...p.kinds.filter((k) => k !== 'none'), val],
      }));
      return;
    }
    setA((p) => ({ ...p, [key]: v }));
  };

  const signup = () => {
    // 답은 서버에 저장하지 않는다. 가입(데모) 시 사업장 설정에만 이어받도록 이 탭의 sessionStorage에 잠시 둔다.
    try {
      sessionStorage.setItem(
        PREFILL_KEY,
        JSON.stringify({ industry: a.industry, staff: a.staff, foreign: a.kinds.includes('foreign') }),
      );
    } catch {
      /* 저장소 차단 시 이어받기만 생략 */
    }
    nav('/start?from=diagnosis');
  };

  if (mode === 'consult')
    return (
      <GuestConsultForm
        topic={result.topic}
        summary={`${a.staff ?? '-'}명 · ${Q.industry.options.find((o) => o.value === a.industry)?.label ?? '-'} · 위험 ${result.items.filter((i) => i.level === 'risk').length}건`}
        onBack={() => setMode('result')}
      />
    );

  if (mode === 'result')
    return (
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-brand">1분 자가진단 결과</p>
          <button
            type="button"
            className="text-sm text-muted underline"
            onClick={() => {
              setA(EMPTY_DIAG);
              setStep(0);
              setMode('quiz');
            }}
          >
            다시 하기
          </button>
        </div>
        <ul className="mt-3 space-y-2">
          {result.items.map((i, idx) => (
            <li key={idx} className="rounded-xl border border-line p-3">
              <div className="flex items-start gap-2">
                <Badge tone={i.level === 'risk' ? 'risk' : i.level === 'check' ? 'info' : 'muted'}>
                  {i.level === 'risk' ? '위험' : i.level === 'check' ? '확인 필요' : '알아두기'}
                </Badge>
                <p className="text-sm font-semibold">{i.title}</p>
              </div>
              <p className="mt-1 text-xs text-muted">근거: {i.basis}</p>
              <p className="mt-1 text-xs font-semibold text-brand">{i.join}</p>
            </li>
          ))}
          {!result.items.length && <li className="text-sm text-muted">특별히 확인할 항목이 없어요.</li>}
        </ul>
        <p className="mt-2 text-xs text-muted">
          답은 저장하지 않아요. 참고용 안내이며 위법 여부를 판단하지 않아요.
        </p>
        <Button variant="kakao" size="lg" className="mt-4 w-full" onClick={signup}>
          가입하고 관리 시작하기
        </Button>
        {result.showGuestConsult && (
          <button
            type="button"
            className="mt-3 w-full text-center text-sm font-semibold text-brand underline"
            onClick={() => setMode('consult')}
          >
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
        <div
          className="h-1.5 rounded-full bg-brand transition-all"
          style={{ width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>
      <p className="mt-4 text-lg font-bold">{q.q}</p>
      <div className="mt-3">
        <Choice
          name={q.q}
          multi={q.multi}
          options={q.options}
          value={key === 'kinds' ? a.kinds : (a[key] as string | null)}
          onChange={pick}
        />
      </div>
      <div className="mt-5 flex justify-between">
        <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
          ← 이전
        </Button>
        {
          <Button
            variant="primary"
            disabled={!answered}
            onClick={() => (step + 1 >= steps.length ? setMode('result') : setStep(step + 1))}
          >
            {step + 1 >= steps.length ? '결과 보기' : '다음'}
          </Button>
        }
      </div>
    </div>
  );
}

function GuestConsultForm({
  topic,
  summary,
  onBack,
}: {
  topic: string;
  summary: string;
  onBack: () => void;
}) {
  const { state, update, base } = useStore();
  const [f, setF] = useState({
    nickname: '',
    phone: '',
    time: '',
    topic,
    includeSummary: true,
    collect: false,
    provide: false,
    hp: '',
  });
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
    if (state.guestConsults.filter((g) => g.phoneKey === key).length >= 3)
      e.phone = '같은 번호는 하루 3회까지 신청할 수 있어요';
    setErr(e);
    if (Object.keys(e).length) return;
    if (f.hp) {
      setDone('신청을 처리하지 않았어요 (자동 입력 방지).');
      return;
    }
    setBusy(true);
    update((d) => {
      d.guestConsults.unshift({
        id: uid('guest'),
        nickname: f.nickname.trim(),
        phoneMasked: maskPhone(f.phone),
        phoneKey: key,
        contactTime: f.time.trim(),
        topic: f.topic,
        summary: f.includeSummary ? summary : '',
        consents: { collect: nowIso(), provide: nowIso() },
        createdAt: nowIso(),
        mode: 'demo',
      });
    });
    setDone(
      '시연 모드라 실제로 전송하지 않았어요. 이 브라우저의 노무법인 화면(데모)에서 도착하는 모습만 볼 수 있어요 — 번호는 가려서 남겼어요.',
    );
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
      <p className="mt-1 text-xs text-muted">
        노무사 연결은 무료, 상담 비용과 방식은 노무법인과 직접 정해요.
      </p>
      <div className="mt-3 grid gap-3">
        <Field label="이름(호칭)" htmlFor="g-n" error={err.nickname}>
          <input
            id="g-n"
            className={inputCls}
            value={f.nickname}
            onChange={(e) => setF({ ...f, nickname: e.target.value })}
            placeholder="예: 카페 사장님"
          />
        </Field>
        <Field label="휴대폰 번호" htmlFor="g-p" error={err.phone}>
          <input
            id="g-p"
            className={inputCls}
            inputMode="tel"
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
            placeholder="010-0000-0000"
          />
        </Field>
        <Field label="연락 편한 시간" htmlFor="g-t" error={err.time}>
          <input
            id="g-t"
            className={inputCls}
            value={f.time}
            onChange={(e) => setF({ ...f, time: e.target.value })}
            placeholder="예: 평일 오후 2~5시"
          />
        </Field>
        <Field label="상담 주제" htmlFor="g-topic">
          <select
            id="g-topic"
            className={inputCls}
            value={f.topic}
            onChange={(e) => setF({ ...f, topic: e.target.value })}
          >
            {['퇴사·내보내기', '수당', '외국인', '일정·대타', '기타'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.includeSummary}
            onChange={(e) => setF({ ...f, includeSummary: e.target.checked })}
          />{' '}
          진단 요약 함께 보내기 (선택): <span className="text-muted">{summary}</span>
        </label>
        <input
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
          value={f.hp}
          onChange={(e) => setF({ ...f, hp: e.target.value })}
        />
        <div className="rounded-xl border border-line p-3 text-sm">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={f.collect}
              onChange={(e) => setF({ ...f, collect: e.target.checked })}
            />
            <span>
              <b>[필수] 개인정보 수집·이용 동의</b>
              <br />
              <span className="text-xs text-muted">
                항목: 호칭, 휴대폰 번호, 연락 시간, 진단 요약(선택) · 목적: 상담 연결 · 보유: 상담 종료 후
                6개월(예시, 확정 전) · 거부할 수 있으나 신청이 불가해요
              </span>
            </span>
          </label>
          <label className="mt-2 flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={f.provide}
              onChange={(e) => setF({ ...f, provide: e.target.checked })}
            />
            <span>
              <b>[필수] 노무법인 제공 동의</b>
              <br />
              <span className="text-xs text-muted">
                받는 곳: 협력 노무법인(협약 후 표시) · 항목: 위와 같음 · 목적: 상담 · 보유: 위와 같음
              </span>
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

const FEATURES: { title: string; desc: string; icon: IconName }[] = [
  {
    title: '직원 관리',
    desc: '입사일부터 근로조건까지. 한 번 입력한 정보로 필요한 업무가 이어져요.',
    icon: 'people',
  },
  {
    title: '근무·출퇴근',
    desc: '이번 주 일정, 대타와 출퇴근 기록. 바뀐 시간과 사유도 함께 남겨요.',
    icon: 'clock',
  },
  {
    title: '급여·보험',
    desc: '주휴수당과 보험료를 기준과 함께 확인하고, 명세서까지 준비해요.',
    icon: 'wallet',
  },
  {
    title: '서류 체크리스트',
    desc: '우리 가게에 필요한 서류만. 계약서부터 요청 현황까지 한눈에 봐요.',
    icon: 'file',
  },
  {
    title: '일정·기한',
    desc: '수습, 계약, 체류기간, 신고 기한. 놓치기 전에 달력에서 확인해요.',
    icon: 'calendar',
  },
  {
    title: '노무 상담',
    desc: '자주 묻는 질문부터 살펴보고, 판단이 어려운 일은 전문가에게 연결해요.',
    icon: 'chat',
  },
];
function ProductPreview() {
  return (
    <div className="hero-art reveal delay-2" aria-label="가상 카페의 업무노트 예시">
      <div className="product-preview">
        <div className="preview-top">
          <Icon name="file" size={17} />
          <span>가상 예시 · 카페 샘터</span>
        </div>
        <div className="preview-heading">
          가게에서 챙길 세 가지<small>오늘의 기록이 쌓여, 다음 업무가 쉬워져요.</small>
        </div>
        <div className="notebook-context">
          <span>직원 3명</span>
          <span>음식점·카페</span>
          <span>업무노트</span>
        </div>
        {[
          { icon: 'file', title: '직원 A 계약서 점검', tag: '서류' },
          { icon: 'clock', title: '이번 주 근무표 확인', tag: '근무' },
          { icon: 'wallet', title: '급여 계산 내역 검토', tag: '급여' },
        ].map((r) => (
          <div className="preview-row" key={r.title}>
            <span>
              <Icon name={r.icon as IconName} size={16} />
            </span>
            {r.title}
            <small>{r.tag}</small>
          </div>
        ))}
        <div className="notebook-footer">
          <Icon name="calendar" size={22} />
          <span>
            기록은 한곳에, 확인은 순서대로.
            <br />
            실제 기능 흐름을 보여주는 시연 화면이에요.
          </span>
        </div>
      </div>
    </div>
  );
}
export default function Landing() {
  const { session } = useStore();
  const { openGuide } = usePreferences();
  return (
    <div className="landing-page">
      <SiteHeader />
      <main>
        <section className="landing-hero landing-container">
          <div className="landing-hero-copy reveal">
            <span className="eyebrow">
              <span className="status-dot" />
              우리 가게를 위한 인사노무 관리
            </span>
            <h1>
              작은 가게의 큰 일들,
              <br />
              <span>차근차근 정리해요.</span>
            </h1>
            <p>
              계약서부터 근무 일정, 급여와 4대보험까지.
              <br />
              우리 가게의 조건에 맞춰, 오늘 필요한 기록부터.
            </p>
            <div className="hero-actions">
              <Link className="ui-button primary" to={session ? '/' + session.role : '/start?mode=signup'}>
                {session ? '내 사업장으로' : '우리 가게 관리 시작하기'}
                <Icon name="arrow" size={17} />
              </Link>
              <button className="ui-button secondary" onClick={openGuide}>
                <Icon name="play" size={15} />
                어떻게 쓰나요?
              </button>
            </div>
            <span className="hero-caption">
              <Icon name="lock" size={12} />
              가입 없이 체험 가능 · 현재는 로컬 저장 방식의 데모예요
            </span>
          </div>
          <ProductPreview />
        </section>
        <section id="features" className="landing-section landing-container landing-divider">
          <span className="eyebrow">가게 관리, 더 간단하게</span>
          <h2>
            여기저기 흩어졌던 일,
            <br />
            이제 한곳에서 챙기세요.
          </h2>
          <p className="section-description">
            직원 정보를 한 번 입력하면 서류·임금·보험·기한이 함께 연결돼요.
          </p>
          <div className="feature-grid">
            {FEATURES.map((f) => (
              <article className="feature-tile" key={f.title}>
                <span>
                  <Icon name={f.icon} size={24} />
                </span>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </article>
            ))}
          </div>
        </section>
        <section id="diagnosis" className="diagnosis-section">
          <div className="landing-container landing-section diagnosis-grid">
            <div>
              <span className="eyebrow">
                <Icon name="spark" size={16} />
                1분이면 충분해요
              </span>
              <h2>
                우리 가게,
                <br />
                무엇부터 챙겨야 할까요?
              </h2>
              <p className="section-description">
                몇 가지 질문에 답하면 지금 확인할 항목을 알려드려요.
                <br />
                쉽게 시작하고, 필요한 것부터 차근차근.
              </p>
              <div className="diagnosis-checks">
                <span>
                  <Icon name="check" size={17} />
                  업종과 직원 수에 맞는 안내
                </span>
                <span>
                  <Icon name="check" size={17} />
                  어려운 말 대신, 지금 할 일부터
                </span>
                <span>
                  <Icon name="check" size={17} />
                  진단 답은 저장하지 않아요
                </span>
              </div>
            </div>
            <div className="diagnosis-box">
              <DiagnosisCard />
            </div>
          </div>
        </section>
        <section className="landing-container landing-section">
          <span className="eyebrow">작지만, 꼭 지키는 원칙</span>
          <h2>
            사장님이 안심하고
            <br />
            사용할 수 있도록.
          </h2>
          <div className="principle-row">
            {[
              {
                icon: 'lock',
                title: '필요한 정보만 받아요',
                desc: '직원 실명·주민등록번호·서류 파일을 저장하지 않아요. 별칭과 나이대로 관리해요.',
              },
              {
                icon: 'file',
                title: '이유와 근거를 함께 봐요',
                desc: '쉬운 설명 아래 기준일과 근거를 보여드려요. 판단이 필요한 일은 노무사에게 확인해요.',
              },
              {
                icon: 'shield',
                title: '고른 것만 공유해요',
                desc: '노무법인에는 사장님이 선택하고 동의한 항목만. 공유는 언제든 철회할 수 있어요.',
              },
            ].map((p) => (
              <div key={p.title}>
                <Icon name={p.icon as IconName} size={25} />
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>
        <section id="faq" className="landing-container landing-section faq-section">
          <span className="eyebrow">궁금한 점이 있으신가요?</span>
          <h2>자주 묻는 질문</h2>
          <div className="faq-list">
            {[
              [
                '직원이 가입하지 않아도 쓸 수 있나요?',
                '네. 사장님 혼자 모든 기능을 쓸 수 있어요. 직원 가입은 명세서 수령 확인·출퇴근 기록을 위한 선택이에요.',
              ],
              [
                '계산 결과를 그대로 믿어도 되나요?',
                '법령 수치는 기준일·시행 구간·근거·확인 상태와 함께 보여드려요. 참고용이며, 판단이 필요한 건 노무사 확인을 권해요.',
              ],
              [
                '노무사 상담은 유료인가요?',
                '연결은 무료로 기획되어 있어요. 상담 비용과 방식은 노무법인과 직접 정하며, 현재 데모에서는 실제 전송되지 않아요.',
              ],
              [
                '데모에서 입력한 정보는 어디에 저장되나요?',
                '이 브라우저 안에만 저장돼요. 다른 기기와 공유되지 않으며, 설정에서 JSON으로 내보내거나 초기화할 수 있어요. 실제 개인정보는 입력하지 마세요.',
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <Icon name="chevron" size={16} />
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-container landing-section">
          <div className="landing-cta">
            <div>
              <h2>
                가게에 맞는 관리,
                <br />첫 기록부터 시작하세요.
              </h2>
              <p>가상 카페로 먼저 경험해 보세요.</p>
            </div>
            <Link className="ui-button primary" to="/start">
              가입 없이 체험하기
              <Icon name="arrow" size={17} />
            </Link>
          </div>
        </section>
      </main>
      <footer className="landing-container landing-footer">
        <Brand />
        <div>
          {SERVICE_NAME} · 가칭 · 서비스 초안
          <br />
          실제 인증·외부 전송·결제는 연결 전이에요.
          <br />
          참고용 안내이며 개별 사안의 법률 판단을 대신하지 않아요.
        </div>
        <button onClick={openGuide}>
          이용 가이드
          <Icon name="arrow" size={13} className="inline ml-2" />
        </button>
      </footer>
    </div>
  );
}
