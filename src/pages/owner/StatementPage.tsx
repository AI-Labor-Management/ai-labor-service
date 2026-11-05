import { useState } from 'react';
import { useParams } from 'react-router';
import { useStore } from '../../state/store';
import { payrollLines } from '../../domain/payroll';
import { fmtYM } from '../../domain/dates';
import { Badge, Button, Empty, LinkButton, PageHeader } from '../../ui/kit';
import { StatementView } from '../../ui/Statement';

export default function StatementPage() {
  const { month = '', empId = '' } = useParams();
  const { state } = useStore();
  const { lines, confirmed, payroll } = payrollLines(state, month);
  const line = lines.find((l) => l.employeeId === empId);
  const e = state.employees.find((x) => x.id === empId);
  const [en, setEn] = useState(!!e?.isForeign);
  if (!line || !e) return <Empty title="명세서를 찾을 수 없어요" action={<LinkButton to="/owner/payroll">급여로</LinkButton>} />;
  return (
    <div className="max-w-3xl">
      <div className="no-print">
        <PageHeader
          title={`${e.alias} · ${fmtYM(month)}분 임금명세서`}
          sub={confirmed ? '확정분' : '초안 미리보기 — 확정 전이라 교부되지 않았어요'}
          actions={
            <>
              {e.isForeign && <Button onClick={() => setEn(!en)}>{en ? '한국어만' : '영어 병기 (EN)'}</Button>}
              <Button variant="primary" onClick={() => window.print()}>
                인쇄 / PDF 저장
              </Button>
              <LinkButton to={`/owner/payroll?month=${month}`}>급여로</LinkButton>
            </>
          }
        />
        {!confirmed && <Badge tone="warn">초안</Badge>}
      </div>
      <StatementView line={line} workplaceName={state.workplace?.name ?? ''} month={month} en={en} revision={payroll?.revision} />
    </div>
  );
}
