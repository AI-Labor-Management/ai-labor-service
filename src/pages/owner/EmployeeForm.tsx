// S03 직원 등록 (외국인 단계 포함). 실명·연락처·주민등록번호·외국인등록번호 칸은 없다.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useStore, uid, nowIso } from '../../state/store';
import { checkMinimumWage } from '../../domain/wage';
import { isISODate } from '../../domain/dates';
import type { AgeBand, EmploymentType, Employee, InsuranceMethod, Visa, Weekday } from '../../domain/types';
import ScheduleEditor, { scheduleErrors, type Sched } from '../../ui/ScheduleEditor';
import { Button, Card, Choice, Field, inputCls, Notice, PageHeader, useToast } from '../../ui/kit';
import { AGE_LABEL, EMPLOYMENT_LABEL, INSURANCE_METHOD_LABEL, SCHOOLS, VISA_LABEL, VISAS } from '../../ui/labels';
import { WEEKDAY_KO } from '../../domain/dates';
import { netMinutes } from '../../domain/work';

export interface BasicForm {
  alias: string;
  ageBand: AgeBand;
  birthDate: string;
  startedBefore65: '' | 'yes' | 'no';
  hireDate: string;
  employmentType: EmploymentType;
  contractEnd: string;
  hasProbation: boolean;
  probationEnd: string;
  foodHandler: boolean;
  isForeign: boolean;
  visa: Visa;
  visaExpiry: string;
  permitted: '' | 'yes' | 'no';
  permitHours: string;
  otherHours: string;
  nationality: string;
  student: boolean;
  school: string;
  insuranceMethod: InsuranceMethod;
}

export function basicFromEmployee(e: Employee): BasicForm {
  return {
    alias: e.alias,
    ageBand: e.ageBand,
    birthDate: e.birthDate ?? '',
    startedBefore65: e.startedBefore65 === null ? '' : e.startedBefore65 ? 'yes' : 'no',
    hireDate: e.hireDate,
    employmentType: e.employmentType,
    contractEnd: e.contractEnd ?? '',
    hasProbation: !!e.probationEnd,
    probationEnd: e.probationEnd ?? '',
    foodHandler: e.foodHandler,
    isForeign: e.isForeign,
    visa: e.foreign?.visa ?? 'D-2',
    visaExpiry: e.foreign?.expiry ?? '',
    permitted: e.foreign?.permitted == null ? '' : e.foreign.permitted ? 'yes' : 'no',
    permitHours: e.foreign?.permitHours?.toString() ?? '',
    otherHours: e.foreign?.otherWorkplaceHours?.toString() ?? '0',
    nationality: e.foreign?.nationality ?? '',
    student: !!e.school,
    school: e.school ?? '',
    insuranceMethod: e.insuranceMethod,
  };
}

export function validateBasic(f: BasicForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.alias.trim()) e.alias = '별칭을 입력하세요 (예: 직원 D)';
  if (f.alias.trim().length > 20) e.alias = '별칭은 20자 이내';
  if (!isISODate(f.hireDate)) e.hireDate = '입사일을 입력하세요';
  if (f.ageBand === 'under18' && !isISODate(f.birthDate)) e.birthDate = '18세 미만은 생년월일이 필요해요 (연소자 서류·시간 한도 판단)';
  if (f.employmentType === 'fixed') {
    if (!isISODate(f.contractEnd)) e.contractEnd = '계약 종료일을 입력하세요';
    else if (f.contractEnd < f.hireDate) e.contractEnd = '종료일이 입사일보다 빨라요';
  }
  if (f.hasProbation) {
    if (!isISODate(f.probationEnd)) e.probationEnd = '수습 종료일을 입력하세요';
    else if (f.probationEnd < f.hireDate) e.probationEnd = '수습 종료일이 입사일보다 빨라요';
  }
  if (f.isForeign && f.visaExpiry && !isISODate(f.visaExpiry)) e.visaExpiry = '날짜 형식을 확인하세요';
  if (f.isForeign && f.permitHours && !(Number(f.permitHours) > 0)) e.permitHours = '허가 시간은 0보다 커야 해요';
  return e;
}

export function applyBasic(target: Employee, f: BasicForm) {
  target.alias = f.alias.trim();
  target.ageBand = f.ageBand;
  target.birthDate = f.ageBand === 'under18' ? f.birthDate : null;
  target.startedBefore65 = f.ageBand === '65+' ? (f.startedBefore65 === '' ? null : f.startedBefore65 === 'yes') : null;
  target.hireDate = f.hireDate;
  target.employmentType = f.employmentType;
  target.contractEnd = f.employmentType === 'fixed' ? f.contractEnd : null;
  target.probationEnd = f.hasProbation ? f.probationEnd : null;
  target.foodHandler = f.foodHandler;
  target.isForeign = f.isForeign;
  target.foreign = f.isForeign
    ? {
        visa: f.visa,
        expiry: f.visaExpiry || null,
        permitted: f.permitted === '' ? null : f.permitted === 'yes',
        permitHours: f.permitHours ? Number(f.permitHours) : null,
        otherWorkplaceHours: Number(f.otherHours) || 0,
        nationality: f.nationality.trim(),
        checkedAt: target.foreign?.checkedAt ?? null,
      }
    : null;
  target.school = f.student ? f.school || '기타' : null;
  target.insuranceMethod = f.insuranceMethod;
}

export function BasicFields({ f, setF, errors, isFood, editing }: { f: BasicForm; setF: (f: BasicForm) => void; errors: Record<string, string>; isFood: boolean; editing?: boolean }) {
  return (
    <div className="grid gap-4">
      <Notice tone="muted">실명·연락처·주민등록번호·외국인등록번호 칸은 없어요. 법정 서류의 이름은 출력 직전에 브라우저에서만 입력해요.</Notice>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="별칭" htmlFor="ef-alias" error={errors.alias} hint="모든 화면에 이 이름으로 보여요">
          <input id="ef-alias" className={inputCls} value={f.alias} onChange={(e) => setF({ ...f, alias: e.target.value })} placeholder="직원 D" />
        </Field>
        <Field label="입사일" htmlFor="ef-hire" error={errors.hireDate} hint={editing ? '입사일을 바꾸면 관련 기한이 다시 계산돼요' : undefined}>
          <input id="ef-hire" type="date" className={inputCls} value={f.hireDate} onChange={(e) => setF({ ...f, hireDate: e.target.value })} />
        </Field>
      </div>
      <Field label="나이대" hint="판정에는 구간만 필요해요. 생년월일은 18세 미만만 받아요">
        <Choice name="나이대" options={(Object.keys(AGE_LABEL) as AgeBand[]).map((v) => ({ value: v, label: AGE_LABEL[v] }))} value={f.ageBand} onChange={(v) => setF({ ...f, ageBand: v })} />
      </Field>
      {f.ageBand === 'under18' && (
        <Field label="생년월일 (18세 미만만)" htmlFor="ef-birth" error={errors.birthDate}>
          <input id="ef-birth" type="date" className={inputCls} value={f.birthDate} onChange={(e) => setF({ ...f, birthDate: e.target.value })} />
        </Field>
      )}
      {f.ageBand === '65+' && (
        <Field label="65세가 되기 전부터 일했나요?" hint="고용보험 판정에 필요해요">
          <Choice name="65세 전 근무" options={[{ value: 'yes', label: '예' }, { value: 'no', label: '아니오' }, { value: '', label: '모르겠어요' }]} value={f.startedBefore65} onChange={(v) => setF({ ...f, startedBefore65: v })} />
        </Field>
      )}
      <Field label="고용 방식">
        <Choice name="고용 방식" options={(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((v) => ({ value: v, label: EMPLOYMENT_LABEL[v] }))} value={f.employmentType} onChange={(v) => setF({ ...f, employmentType: v })} />
      </Field>
      {f.employmentType === 'fixed' && (
        <Field label="계약 종료일" htmlFor="ef-cend" error={errors.contractEnd}>
          <input id="ef-cend" type="date" className={inputCls} value={f.contractEnd} onChange={(e) => setF({ ...f, contractEnd: e.target.value })} />
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.hasProbation} onChange={(e) => setF({ ...f, hasProbation: e.target.checked })} /> 수습 기간이 있어요
      </label>
      {f.hasProbation && (
        <Field label="수습 종료일" htmlFor="ef-prob" error={errors.probationEnd} hint="수습 중이라도 자동으로 감액하지 않아요 (확인 필요)">
          <input id="ef-prob" type="date" className={inputCls} value={f.probationEnd} onChange={(e) => setF({ ...f, probationEnd: e.target.value })} />
        </Field>
      )}
      {isFood && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.foodHandler} onChange={(e) => setF({ ...f, foodHandler: e.target.checked })} /> 식품을 조리·판매하는 일을 해요 (보건증 대상)
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={f.student} onChange={(e) => setF({ ...f, student: e.target.checked })} /> 학생이에요 (선택 — 시험 기간 공백 안내용, 학년·학과는 받지 않아요)
      </label>
      {f.student && (
        <Field label="학교" htmlFor="ef-school">
          <select id="ef-school" className={inputCls} value={f.school} onChange={(e) => setF({ ...f, school: e.target.value })}>
            <option value="">선택</option>
            {SCHOOLS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={f.isForeign} onChange={(e) => setF({ ...f, isForeign: e.target.checked })} /> 외국인 직원이에요
      </label>
      {f.isForeign && (
        <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
          <Field label="체류자격" htmlFor="ef-visa">
            <select id="ef-visa" className={inputCls} value={f.visa} onChange={(e) => setF({ ...f, visa: e.target.value as Visa })}>
              {VISAS.map((v) => (
                <option key={v} value={v}>
                  {VISA_LABEL[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="체류기간 만료일" htmlFor="ef-vexp" error={errors.visaExpiry} hint="30·7·3일 전에 알려줘요">
            <input id="ef-vexp" type="date" className={inputCls} value={f.visaExpiry} onChange={(e) => setF({ ...f, visaExpiry: e.target.value })} />
          </Field>
          {(f.visa === 'D-2' || f.visa === 'D-4') && (
            <>
              <Field label="시간제취업 허가">
                <Choice name="허가" options={[{ value: 'yes', label: '있음' }, { value: 'no', label: '없음' }, { value: '', label: '모름' }]} value={f.permitted} onChange={(v) => setF({ ...f, permitted: v })} />
              </Field>
              <Field label="허가 시간 (주)" htmlFor="ef-ph" error={errors.permitHours} hint="유학생 허가 시간 기준은 원문 미확인 — 허가서 기준으로 입력">
                <input id="ef-ph" type="number" className={inputCls} value={f.permitHours} onChange={(e) => setF({ ...f, permitHours: e.target.value })} />
              </Field>
              <Field label="다른 사업장 주당 시간 합계" htmlFor="ef-oh" hint="가게 이름은 받지 않아요">
                <input id="ef-oh" type="number" className={inputCls} value={f.otherHours} onChange={(e) => setF({ ...f, otherHours: e.target.value })} />
              </Field>
            </>
          )}
          <Field label="국적 (선택)" htmlFor="ef-nat" hint="국민연금 상호주의 판단이 필요할 때만">
            <input id="ef-nat" className={inputCls} value={f.nationality} onChange={(e) => setF({ ...f, nationality: e.target.value })} />
          </Field>
          <p className="text-xs text-muted sm:col-span-2">체류자격만으로 취업 가능 여부를 단정하지 않아요. 외국인등록증 사본은 받지 않고 확인 여부와 날짜만 남겨요.</p>
        </div>
      )}
      <Field label="4대보험 처리 방식" hint='"아직 안 함"은 홈에 위험으로 떠요. "가입 안 함" 선택지는 없어요'>
        <Choice name="보험 처리" options={(Object.keys(INSURANCE_METHOD_LABEL) as InsuranceMethod[]).map((v) => ({ value: v, label: INSURANCE_METHOD_LABEL[v] }))} value={f.insuranceMethod} onChange={(v) => setF({ ...f, insuranceMethod: v })} />
      </Field>
    </div>
  );
}

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

  const mw = checkMinimumWage(wage, f.hireDate && isISODate(f.hireDate) ? f.hireDate : base);
  const schedErrs = scheduleErrors(sched);
  const weekly = sched.reduce((s, d) => s + (d ? netMinutes(d) : 0), 0) / 60;

  const save = () => {
    if (busy) return;
    const e = validateBasic(f);
    if (!(wage > 0)) e.wage = '시급을 입력하세요';
    if (mw.status === 'below' && !ackLowWage) e.wage = '최저임금 미달 — 확인을 체크해야 저장할 수 있어요';
    if (!variable && !sched.some(Boolean)) e.sched = '근무 요일을 하나 이상 고르거나 "매주 달라요"를 선택하세요';
    if (!variable && schedErrs.length) e.sched = schedErrs[0];
    if (variable && !(Number(varHours) > 0)) e.sched = '주 평균 예상 시간을 입력하세요';
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
      if (d.workplace && !d.workplace.defaultInsuranceMethod && f.insuranceMethod !== 'alreadyDone') d.workplace.defaultInsuranceMethod = f.insuranceMethod;
    });
    toast(`${f.alias} 등록했어요`);
    nav(existing ? `/owner/employees/${id}/onboarding` : `/owner/employees/${id}`);
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title="직원 등록" sub="여기 입력한 값으로 서류·급여·보험·기한이 모두 돌아가요. 같은 값을 다른 화면에서 다시 묻지 않아요." />
      <div className="grid gap-4">
        <Card>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" checked={existing} onChange={(e) => setExisting(e.target.checked)} />
            <span>
              <b>이미 일하고 있는 직원이에요</b>
              <br />
              <span className="text-xs text-muted">등록 후 이미 처리한 서류·보험·지난 기한을 "이미 했어요 / 이미 지남 확인"으로 한 번에 정리해요. 정리 전에는 지난 기한을 위험으로 한꺼번에 띄우지 않아요.</span>
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
                <input id="ef-wage" type="number" inputMode="numeric" className={inputCls} value={wage || ''} onChange={(e) => setWage(Number(e.target.value))} />
              </Field>
              <Field label="식대 (월, 선택)" htmlFor="ef-meal" hint="월 20만 원까지 비과세">
                <input id="ef-meal" type="number" className={inputCls} value={meal} onChange={(e) => setMeal(e.target.value)} />
              </Field>
              <Field label="주휴일" htmlFor="ef-hol">
                <select id="ef-hol" className={inputCls} value={holiday} onChange={(e) => setHoliday(Number(e.target.value) as Weekday)}>
                  {WEEKDAY_KO.map((w, i) => (
                    <option key={w} value={i}>
                      {w}요일
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {mw.status === 'below' && (
              <Notice tone="risk" title={`최저임금 미달 — 입사일 기준 ${mw.required?.toLocaleString('ko-KR')}원 이상이어야 해요`}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={ackLowWage} onChange={(e) => setAckLowWage(e.target.checked)} /> 확인했어요 (계약서 생성은 막지 않지만 급여 화면에 계속 경고해요)
                </label>
              </Notice>
            )}
            <Field label="하는 일" htmlFor="ef-job" hint="계약서에 들어가요">
              <input id="ef-job" className={inputCls} value={job} onChange={(e) => setJob(e.target.value)} placeholder="예: 홀 서빙·음료 제조" />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={variable} onChange={(e) => setVariable(e.target.checked)} /> 매주 달라요 (근무 화면에서 주마다 입력)
            </label>
            {variable ? (
              <Field label="주 평균 예상 시간" htmlFor="ef-vh" hint="미리 계산용. 급여는 실제 입력한 근무로 다시 계산해요">
                <input id="ef-vh" type="number" className={inputCls} value={varHours} onChange={(e) => setVarHours(e.target.value)} />
              </Field>
            ) : (
              <>
                <ScheduleEditor value={sched} onChange={setSched} idPrefix="ef" />
                <p className="text-sm">
                  주 소정근로시간 <b className="num">{weekly.toFixed(1)}시간</b>
                  {weekly > 0 && weekly < 15 && <span className="text-muted"> · 주 15시간 미만 — 주휴·연차·퇴직금 대상 아님</span>}
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
