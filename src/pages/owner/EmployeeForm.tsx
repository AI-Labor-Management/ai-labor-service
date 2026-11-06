// S03 직원 등록 (외국인 단계 포함). 실명·연락처·주민등록번호·외국인등록번호 칸은 없다.
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useStore, uid, nowIso } from '../../state/store';
import { checkMinimumWage } from '../../domain/wage';
import { isISODate } from '../../domain/dates';
import type { AgeBand, EmploymentType, Employee, Weekday } from '../../domain/types';
import ScheduleEditor, { scheduleErrors, type Sched } from '../../ui/ScheduleEditor';
import { Button, Card, Field, inputCls, Notice, PageHeader, useToast } from '../../ui/kit';
import { WEEKDAY_KO } from '../../domain/dates';
import { netMinutes } from '../../domain/work';
import { UnsavedChanges } from '../../ui/UnsavedChanges';

import { BasicFields, applyBasic, validateBasic, type BasicForm } from '../../ui/EmployeeFields';

interface Prefill {
  hourlyWage?: number;
  schedule?: Sched;
  ageBand?: AgeBand;
  isForeign?: boolean;
  employmentType?: EmploymentType;
}

export default function EmployeeForm() {
  const { state, update, base } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const loc = useLocation();
  const pre = ((loc.state as { prefill?: Prefill } | null)?.prefill ?? {}) as Prefill;
  const wp = state.workplace!;
  const nextLetter = String.fromCharCode(65 + (state.employees.length % 26));
  const [f, setF] = useState<BasicForm>({
    alias: `직원 ${nextLetter}`,
    ageBand: pre.ageBand ?? '18-59',
    birthDate: '',
    startedBefore65: '',
    hireDate: base,
    employmentType: pre.employmentType ?? 'regular',
    contractEnd: '',
    hasProbation: false,
    probationEnd: '',
    foodHandler: wp.industry === 'food',
    isForeign: !!pre.isForeign,
    visa: 'D-2',
    visaExpiry: '',
    permitted: '',
    permitHours: '',
    otherHours: '0',
    nationality: '',
    student: false,
    school: '',
    insuranceMethod: wp.defaultInsuranceMethod ?? 'self',
  });
  const [wage, setWage] = useState(pre.hourlyWage ?? 10320);
  const [sched, setSched] = useState<Sched>(pre.schedule ?? [null, null, null, null, null, null, null]);
  const [variable, setVariable] = useState(false);
  const [varHours, setVarHours] = useState('');
  const [holiday, setHoliday] = useState<Weekday>(6);
  const [job, setJob] = useState('');
  const [meal, setMeal] = useState('0');
  const [existing, setExisting] = useState(false);
  const [ackLowWage, setAckLowWage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const allowLeave = useRef(false);
  const signature = JSON.stringify({ f, wage, sched, variable, varHours, holiday, job, meal, existing });
  const initialForm = useRef(signature);

  const mw = checkMinimumWage(wage, f.hireDate && isISODate(f.hireDate) ? f.hireDate : base);
  const schedErrs = scheduleErrors(sched);
  const weekly = sched.reduce((s, d) => s + (d ? netMinutes(d) : 0), 0) / 60;

  const save = () => {
    if (busy) return;
    const e = validateBasic(f);
    if (!Number.isFinite(wage) || !(wage > 0)) e.wage = '시급을 입력하세요';
    if (!Number.isFinite(Number(meal)) || Number(meal) < 0) e.meal = '식대는 0원 이상으로 입력하세요';
    if (mw.status === 'below' && !ackLowWage) e.wage = '최저임금 미달 — 확인을 체크해야 저장할 수 있어요';
    if (!variable && !sched.some(Boolean))
      e.sched = '근무 요일을 하나 이상 고르거나 "매주 달라요"를 선택하세요';
    if (!variable && schedErrs.length) e.sched = schedErrs[0];
    if (variable && (!(Number(varHours) > 0) || Number(varHours) > 168))
      e.sched = '주 평균 예상 시간은 0보다 크고 168시간 이하여야 해요';
    setErrors(e);
    if (Object.keys(e).length) {
      document.querySelector('[role=alert]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    setBusy(true);
    const id = uid('emp');
    update((d) => {
      const emp: Employee = {
        id,
        alias: '',
        ageBand: '18-59',
        birthDate: null,
        startedBefore65: null,
        hireDate: f.hireDate,
        employmentType: 'regular',
        contractEnd: null,
        probationEnd: null,
        foodHandler: false,
        isForeign: false,
        foreign: null,
        school: null,
        insuranceMethod: 'self',
        registeredAt: base,
        onboarding: existing ? 'existing-pending' : 'new',
        resignDate: null,
        resignType: null,
        account: 'none',
        invite: null,
        locationConsent: null,
        conditionAcks: [],
        bonusAnnual: 0,
        leaveAllowanceAnnual: 0,
        createdAt: nowIso(),
      };
      applyBasic(emp, f);
      d.employees.push(emp);
      d.conditions.push({
        id: uid('cond'),
        employeeId: id,
        effectiveFrom: f.hireDate,
        hourlyWage: wage,
        schedule: variable ? [null, null, null, null, null, null, null] : sched,
        variable,
        variableWeeklyHours: variable ? Number(varHours) : null,
        weeklyHolidayDay: holiday,
        job: job.trim(),
        mealAllowance: Number(meal) || 0,
        breakWaiverRequested: false,
        reason: '최초 등록',
        createdAt: nowIso(),
      });
      if (d.workplace && !d.workplace.defaultInsuranceMethod && f.insuranceMethod !== 'alreadyDone')
        d.workplace.defaultInsuranceMethod = f.insuranceMethod;
    });
    allowLeave.current = true;
    toast(`${f.alias} 등록했어요`);
    nav(existing ? `/owner/employees/${id}/onboarding` : `/owner/employees/${id}`);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="직원 등록"
        sub="여기 입력한 값으로 서류·급여·보험·기한이 모두 돌아가요. 같은 값을 다른 화면에서 다시 묻지 않아요."
      />
      <UnsavedChanges when={signature !== initialForm.current} bypass={allowLeave} />
      <div className="grid gap-4">
        <Card>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={existing}
              onChange={(e) => setExisting(e.target.checked)}
            />
            <span>
              <b>이미 일하고 있는 직원이에요</b>
              <br />
              <span className="text-xs text-muted">
                등록 후 이미 처리한 서류·보험·지난 기한을 "이미 했어요 / 이미 지남 확인"으로 한 번에 정리해요.
                정리 전에는 지난 기한을 위험으로 한꺼번에 띄우지 않아요.
              </span>
            </span>
          </label>
        </Card>
        <Card title="기본 정보">
          <BasicFields f={f} setF={setF} errors={errors} isFood={wp.industry === 'food'} />
        </Card>
        <Card title="근로조건" right="바뀌면 적용일과 함께 이력으로 남아요">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="시급 (원)" htmlFor="ef-wage" error={errors.wage}>
                <input
                  id="ef-wage"
                  type="number"
                  inputMode="numeric"
                  className={inputCls}
                  value={wage || ''}
                  onChange={(e) => setWage(Number(e.target.value))}
                />
              </Field>
              <Field
                label="식대 (월, 선택)"
                htmlFor="ef-meal"
                error={errors.meal}
                hint="월 20만 원까지 비과세"
              >
                <input
                  id="ef-meal"
                  type="number"
                  className={inputCls}
                  value={meal}
                  onChange={(e) => setMeal(e.target.value)}
                />
              </Field>
              <Field label="주휴일" htmlFor="ef-hol">
                <select
                  id="ef-hol"
                  className={inputCls}
                  value={holiday}
                  onChange={(e) => setHoliday(Number(e.target.value) as Weekday)}
                >
                  {WEEKDAY_KO.map((w, i) => (
                    <option key={w} value={i}>
                      {w}요일
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {mw.status === 'below' && (
              <Notice
                tone="risk"
                title={`최저임금 미달 — 입사일 기준 ${mw.required?.toLocaleString('ko-KR')}원 이상이어야 해요`}
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={ackLowWage}
                    onChange={(e) => setAckLowWage(e.target.checked)}
                  />{' '}
                  확인했어요 (계약서 생성은 막지 않지만 급여 화면에 계속 경고해요)
                </label>
              </Notice>
            )}
            <Field label="하는 일" htmlFor="ef-job" hint="계약서에 들어가요">
              <input
                id="ef-job"
                className={inputCls}
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder="예: 홀 서빙·음료 제조"
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={variable} onChange={(e) => setVariable(e.target.checked)} />{' '}
              매주 달라요 (근무 화면에서 주마다 입력)
            </label>
            {variable ? (
              <Field
                label="주 평균 예상 시간"
                htmlFor="ef-vh"
                hint="미리 계산용. 급여는 실제 입력한 근무로 다시 계산해요"
              >
                <input
                  id="ef-vh"
                  type="number"
                  className={inputCls}
                  value={varHours}
                  onChange={(e) => setVarHours(e.target.value)}
                />
              </Field>
            ) : (
              <>
                <ScheduleEditor value={sched} onChange={setSched} idPrefix="ef" />
                <p className="text-sm">
                  주 소정근로시간 <b className="num">{weekly.toFixed(1)}시간</b>
                  {weekly > 0 && weekly < 15 && (
                    <span className="text-muted"> · 주 15시간 미만 — 주휴·연차·퇴직금 대상 아님</span>
                  )}
                </p>
              </>
            )}
            {errors.sched && (
              <p role="alert" className="text-xs font-semibold text-risk">
                {errors.sched}
              </p>
            )}
          </div>
        </Card>
        <div className="flex justify-end gap-2">
          <Button onClick={() => nav(-1)}>취소</Button>
          <Button variant="primary" size="lg" onClick={save} disabled={busy}>
            등록
          </Button>
        </div>
      </div>
    </div>
  );
}
