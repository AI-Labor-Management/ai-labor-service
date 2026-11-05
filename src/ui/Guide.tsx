import { useEffect, useState } from 'react';
import { Modal } from './kit';
import { Brand, Icon, type IconName } from './Icon';
import { usePreferences } from './preferences';

const STEPS: { title: string; desc: string; icon: IconName; label: string }[] = [
  {
    title: '할 일부터, 하나씩 확인해요',
    desc: '홈에 모인 할 일을 확인하세요. ‘처리하기’를 누르면 필요한 화면으로 바로 이동해요.',
    icon: 'home',
    label: '한눈에 보기',
  },
  {
    title: '직원 정보는 한 번만 입력해요',
    desc: '입사일과 근로조건을 등록하면 필요한 서류, 보험, 기한을 함께 점검해요.',
    icon: 'people',
    label: '직원 등록',
  },
  {
    title: '근무를 확인하면 급여로 이어져요',
    desc: '일정과 출퇴근 기록을 확인하세요. 변경 사유를 남겨 확정한 시간이 급여에 반영돼요.',
    icon: 'clock',
    label: '근무 확인',
  },
  {
    title: '마지막으로 확인하고 확정해요',
    desc: '급여와 공제 내역을 확인한 뒤 확정하면 명세서가 만들어져요. 어려운 판단은 상담으로 이어가세요.',
    icon: 'wallet',
    label: '급여·명세서',
  },
];
export function Guide() {
  const { guideOpen, closeGuide } = usePreferences();
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (guideOpen) {
      setStep(0);
      setPlaying(!reduced);
    } else setPlaying(false);
  }, [guideOpen, reduced]);
  useEffect(() => {
    if (!guideOpen || !playing || reduced) return;
    const timer = window.setInterval(() => setStep((s) => (s + 1) % STEPS.length), 6500);
    return () => window.clearInterval(timer);
  }, [guideOpen, playing, reduced, step]);
  const changeStep = (v: number) => {
    setPlaying(false);
    setStep(v);
  };
  const item = STEPS[step];
  return (
    <Modal open={guideOpen} onClose={closeGuide} title="처음이어도, 쉽게 시작해요" wide>
      <div className="guide-tabs">
        {STEPS.map((s, i) => (
          <button
            key={s.label}
            className={i === step ? 'active' : ''}
            onClick={() => changeStep(i)}
            aria-label={`${i + 1}단계 ${s.label}`}
            aria-pressed={i === step}
          >
            <span>{i + 1}</span>
            {s.label}
          </button>
        ))}
      </div>
      <div className={`guide-scene ${playing && !reduced ? 'is-playing' : ''}`} key={step} aria-hidden="true">
        <div className="guide-mini-sidebar">
          <Brand compact />
          {STEPS.map((s, i) => (
            <span key={s.label} className={i === step ? 'active' : ''}>
              <Icon name={s.icon} size={18} />
            </span>
          ))}
        </div>
        <div className="guide-mini-content">
          <span className="guide-eyebrow">{item.label}</span>
          <div className="guide-skeleton" />
          {step === 0 && (
            <>
              <div className="guide-demo-row">
                <span className="guide-demo-icon">
                  <Icon name="file" />
                </span>
                <span>근로계약서 확인</span>
                <b>처리하기</b>
              </div>
              <div className="guide-demo-row muted">
                <Icon name="calendar" />
                <span>다가오는 기한 확인</span>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <div className="guide-input">
                <span>직원 별칭</span>
                <b className="guide-type">직원 A</b>
              </div>
              <div className="guide-input">
                <span>입사일</span>
                <b>2026. 11. 05</b>
              </div>
              <div className="guide-demo-cta">직원 등록하기</div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="guide-week">
                {['월', '화', '수', '목', '금'].map((d, i) => (
                  <span key={d} className={i === 3 ? 'today' : ''}>
                    {d}
                    <b>10–15</b>
                  </span>
                ))}
              </div>
              <div className="guide-demo-row">
                <Icon name="clock" />
                <span>출퇴근 기록 확인</span>
                <b>확정</b>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <div className="guide-pay">
                <span>이번 달 예상 지급액</span>
                <b>
                  1,280,000<small>원</small>
                </b>
              </div>
              <div className="guide-demo-cta">확인 후 급여 확정하기</div>
            </>
          )}
          <span className="guide-cursor">
            <svg width="25" height="30" viewBox="0 0 25 30" fill="currentColor">
              <path d="m2 2 20 16-10 1-4 9Z" stroke="white" strokeWidth="2" />
            </svg>
          </span>
          <span className="guide-success">
            <Icon name="check" size={15} />
            {step === 0
              ? '필요한 화면으로 이동'
              : step === 1
                ? '서류·보험·기한 함께 점검'
                : step === 2
                  ? '확정한 시간, 급여에 반영'
                  : '명세서가 준비됐어요'}
          </span>
        </div>
        <span className="guide-demo-label">사용 예시 · 가상 화면</span>
      </div>
      <div className="guide-copy" aria-live="polite">
        <span>STEP 0{step + 1}</span>
        <h3>{item.title}</h3>
        <p>{item.desc}</p>
      </div>
      <div className="guide-controls">
        <button
          className="icon-button"
          onClick={() => setPlaying(!playing)}
          disabled={reduced}
          aria-label={playing ? '안내 애니메이션 일시 정지' : '안내 애니메이션 재생'}
          title={reduced ? '기기의 동작 줄이기 설정을 따르고 있어요' : undefined}
        >
          <Icon name={playing ? 'pause' : 'play'} size={17} />
        </button>
        <div className="guide-dots">
          {STEPS.map((s, i) => (
            <button
              key={s.label}
              className={i === step ? 'active' : ''}
              onClick={() => changeStep(i)}
              aria-label={`${i + 1}단계로 이동`}
            />
          ))}
        </div>
        <button
          className="ui-button secondary"
          onClick={() => changeStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          이전
        </button>
        <button
          className="ui-button primary"
          onClick={() => (step === 3 ? closeGuide() : changeStep(step + 1))}
        >
          {step === 3 ? '시작할게요' : '다음'}
          <Icon name="arrow" size={16} />
        </button>
      </div>
    </Modal>
  );
}
