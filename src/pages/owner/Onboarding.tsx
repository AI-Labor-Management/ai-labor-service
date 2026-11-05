// 기존 직원 입구: 이미 처리한 서류·보험·지난 기한을 한 번에 정리 (07 10장 "한 번에 체크", 11 3장 "이미 지남 확인")
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useStore, uid, nowIso } from '../../state/store';
import { computeChecklist } from '../../domain/checklist';
import { computeDeadlines, handleDeadline } from '../../domain/deadlines';
import { addYears, fmtDate, isISODate } from '../../domain/dates';
import type { InsuranceMethod } from '../../domain/types';
import { Badge, Button, Card, Choice, Empty, Field, inputCls, Notice, PageHeader, useToast } from '../../ui/kit';
import { INSURANCE_METHOD_LABEL } from '../../ui/labels';

export default function Onboarding() {
  const { id } = useParams();
  const { state, update, base } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const e = state.employees.find((x) => x.id === id);
  const docs = useMemo(() => (e ? computeChecklist(state, base).filter((r) => r.employeeId === e.id && r.applies && (r.status === 'onboarding' || r.status === 'todo')) : []), [state, base, e]);
  const past = useMemo(() => (e ? computeDeadlines(state, base).filter((d) => d.employeeId === e.id && d.status === 'onboarding') : []), [state, base, e]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [location, setLocation] = useState('');
  const [exam, setExam] = useState('');
  const [ins, setIns] = useState<InsuranceMethod>(e?.insuranceMethod === 'notYet' ? 'notYet' : 'alreadyDone');
  const [pastOk, setPastOk] = useState<Record<string, boolean>>(() => Object.fromEntries(past.map((p) => [p.key, true])));
  if (!e) return <Empty title="직원을 찾을 수 없어요" />;
  const e5 = docs.find((d) => d.item.id === 'E5');
  const allDocs = docs.every((d) => checked[d.key]);

  const finish = () => {
    update((dr) => {
      for (const r of docs) {
        if (!checked[r.key]) continue;
        const isE5 = r.item.id === 'E5';
        const exp = isE5 && isISODate(exam) ? addYears(exam, 1) : null;
        dr.docRecords = dr.docRecords.filter((x) => x.key !== r.key);
        dr.docRecords.push({ id: uid('doc'), key: r.key, itemId: r.item.id, employeeId: e.id, status: 'stored', doneAt: null, naReason: '', expiry: exp, examDate: isE5 && isISODate(exam) ? exam : null, location: location.trim(), bulk: true, updatedAt: nowIso() });
      }
      for (const p of past) if (pastOk[p.key]) dr.deadlineActions = handleDeadline(dr.deadlineActions, p.key, 'pastConfirmed', base, '기존 직원 입구에서 이미 지남 확인');
      const t = dr.employees.find((x) => x.id === e.id)!;
      t.insuranceMethod = ins;
      t.onboarding = 'existing-done';
    });
    toast('정리했어요. 체크하지 않은 항목은 이제 할 일로 떠요.');
    nav(`/owner/employees/${e.id}`);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={`${e.alias} — 있는 서류·보험·지난 기한 한 번에 체크`} sub={`입사 ${fmtDate(e.hireDate)} · 서비스 등록 ${fmtDate(e.registeredAt)}`} />
      <Notice tone="info" className="mb-4">
        정리 전에는 지난 기한을 위험으로 한꺼번에 띄우지 않아요. 체크는 사장님의 입력일 뿐이라 실물이 있는지 보증하지 않아요.
      </Notice>
      <div className="grid gap-4">
        <Card title="이미 있는 서류" right={<Button size="sm" onClick={() => setChecked(Object.fromEntries(docs.map((d) => [d.key, !allDocs])))}>{allDocs ? '모두 해제' : '모두 체크'}</Button>}>
          {!docs.length && <p className="text-sm text-muted">정리할 서류가 없어요.</p>}
          <ul className="space-y-2">
            {docs.map((d) => (
              <li key={d.key}>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={!!checked[d.key]} onChange={(ev) => setChecked({ ...checked, [d.key]: ev.target.checked })} />
                  <span>
                    <b>{d.title}</b> {d.contractKind && <span className="text-xs text-muted">({d.contractKind})</span>}
                    <br />
                    <span className="text-xs text-muted">{d.item.basis}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {e5 && checked[e5.key] && (
            <Field label="보건증 검진일" htmlFor="ob-exam" hint="1년 뒤를 만료일로 제안해요 (보건증에 적힌 날짜로 나중에 고칠 수 있어요)">
              <input id="ob-exam" type="date" className={inputCls} value={exam} onChange={(ev) => setExam(ev.target.value)} />
            </Field>
          )}
          <div className="mt-3">
            <Field label="보관 위치 (선택, 한 줄)" htmlFor="ob-loc" hint="예: 카운터 서랍 파란 파일 — 개인정보는 적지 마세요">
              <input id="ob-loc" className={inputCls} value={location} onChange={(ev) => setLocation(ev.target.value)} />
            </Field>
          </div>
        </Card>
        <Card title="4대보험">
          <Choice<InsuranceMethod> name="보험 처리" options={(Object.keys(INSURANCE_METHOD_LABEL) as InsuranceMethod[]).map((v) => ({ value: v, label: INSURANCE_METHOD_LABEL[v] }))} value={ins} onChange={setIns} />
          <p className="mt-2 text-xs text-muted">"이미 처리함(날짜 모름)"은 위험으로 띄우지 않아요. "아직 안 함"은 홈에 위험으로 떠요.</p>
        </Card>
        <Card title="이미 지난 기한">
          {!past.length && <p className="text-sm text-muted">등록 전에 지난 기한이 없어요.</p>}
          <ul className="space-y-2">
            {past.map((p) => (
              <li key={p.key}>
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={!!pastOk[p.key]} onChange={(ev) => setPastOk({ ...pastOk, [p.key]: ev.target.checked })} />
                  <span>
                    <b>{p.title}</b> <Badge tone="muted">{fmtDate(p.date)}</Badge>
                    <br />
                    <span className="text-xs text-muted">{p.secondaryLabel || p.origin}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">체크를 풀면 정리 후 그 기한이 위험으로 떠요.</p>
        </Card>
        <div className="flex justify-end gap-2">
          <Button onClick={() => nav(-1)}>나중에</Button>
          <Button variant="primary" size="lg" onClick={finish}>
            정리 완료
          </Button>
        </div>
      </div>
    </div>
  );
}
