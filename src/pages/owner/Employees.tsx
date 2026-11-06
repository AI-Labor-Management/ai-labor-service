import { Link } from 'react-router';
import { useStore } from '../../state/store';
import { conditionAt, weeklyHours } from '../../domain/work';
import { foreignSignal, SIGNAL_LABEL } from '../../domain/foreign';
import { Badge, Card, Empty, LinkButton, PageHeader } from '../../ui/kit';
import { AGE_LABEL, EMPLOYMENT_LABEL, INSURANCE_METHOD_LABEL } from '../../ui/labels';
import { fmtDate } from '../../domain/dates';
import { Icon } from '../../ui/Icon';

export default function Employees() {
  const { state, base } = useStore();
  const active = state.employees.filter((e) => !e.resignDate || e.resignDate >= base);
  const gone = state.employees.filter((e) => e.resignDate && e.resignDate < base);
  return (
    <div>
      <PageHeader
        title="직원 관리"
        sub={`재직 ${active.length}명 · 별칭 기준 (실명 없음)`}
        actions={
          <>
            <LinkButton to="/owner/precheck">채용 전 점검</LinkButton>
            <LinkButton to="/owner/employees/new" variant="primary">
              직원 등록
            </LinkButton>
          </>
        }
      />
      {!active.length && (
        <Empty
          title="아직 등록한 직원이 없어요"
          action={
            <LinkButton to="/owner/employees/new" variant="primary">
              첫 직원 등록
            </LinkButton>
          }
        >
          채용 전이라면 채용 전 점검으로 인건비와 필요한 서류를 먼저 볼 수 있어요.
        </Empty>
      )}
      <div className="employee-directory">
        {active.length > 0 && (
          <div className="employee-directory-head" aria-hidden="true">
            <span>직원 정보</span>
            <span>현재 근로조건</span>
            <span>관리 상태</span>
          </div>
        )}
        {active.map((e) => {
          const c = conditionAt(state.conditions, e.id, base);
          const fs = foreignSignal(state, e, base);
          return (
            <Link
              key={e.id}
              to={`/owner/employees/${e.id}`}
              className="employee-directory-row"
              aria-label={`${e.alias} 상세 보기`}
            >
              <div className="employee-directory-person">
                <span className="employee-avatar" aria-hidden="true">
                  {e.alias.slice(-1)}
                </span>
                <div>
                  <strong>{e.alias}</strong>
                  <p>
                    {AGE_LABEL[e.ageBand]} / {EMPLOYMENT_LABEL[e.employmentType]}
                    <br />
                    입사 {fmtDate(e.hireDate)}
                  </p>
                </div>
              </div>
              <div className="employee-directory-pay">
                {c ? (
                  <>
                    <b>{c.hourlyWage.toLocaleString('ko-KR')}원</b>
                    <p>
                      시급 /{' '}
                      {c.variable
                        ? `매주 달라요 (약 ${c.variableWeeklyHours}h)`
                        : `주 ${weeklyHours(c).toFixed(1)}시간`}
                    </p>
                  </>
                ) : (
                  '근로조건 없음'
                )}
              </div>
              <div className="employee-directory-status">
                <div>
                  <div className="employee-directory-tags">
                    {e.onboarding === 'existing-pending' && <Badge tone="info">정리 필요</Badge>}
                    {e.insuranceMethod === 'notYet' && <Badge tone="risk">보험 아직</Badge>}
                    {fs && (
                      <Badge tone={fs.signal === 'risk' ? 'risk' : fs.signal === 'check' ? 'warn' : 'ok'}>
                        외국인 {SIGNAL_LABEL[fs.signal]}
                      </Badge>
                    )}
                  </div>
                  <p>
                    4대보험 {INSURANCE_METHOD_LABEL[e.insuranceMethod]}
                    <br />
                    직원 앱{' '}
                    {e.account === 'joined' ? '가입함' : e.account === 'invited' ? '초대함' : '미가입'}
                  </p>
                </div>
                <Icon name="chevron" size={16} />
              </div>
            </Link>
          );
        })}
      </div>
      {gone.length > 0 && (
        <Card title="퇴사한 직원" className="mt-6" right="기록은 서류 보관 기한(3년)에 맞춰 남겨요">
          <ul className="divide-y divide-line text-sm">
            {gone.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2">
                <Link to={`/owner/employees/${e.id}`} className="font-semibold underline">
                  {e.alias}
                </Link>
                <span className="text-muted">퇴사 {fmtDate(e.resignDate)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
