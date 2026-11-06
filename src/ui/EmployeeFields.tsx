import { isISODate } from '../domain/dates';
import type { AgeBand, EmploymentType, Employee, InsuranceMethod, Visa } from '../domain/types';
import { Choice, Field, inputCls, Notice } from './kit';
import { AGE_LABEL, EMPLOYMENT_LABEL, INSURANCE_METHOD_LABEL, SCHOOLS, VISA_LABEL, VISAS } from './labels';

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
  if (f.ageBand === 'under18' && !isISODate(f.birthDate))
    e.birthDate = '18세 미만은 생년월일이 필요해요 (연소자 서류·시간 한도 판단)';
  if (f.employmentType === 'fixed') {
    if (!isISODate(f.contractEnd)) e.contractEnd = '계약 종료일을 입력하세요';
    else if (f.contractEnd < f.hireDate) e.contractEnd = '종료일이 입사일보다 빨라요';
  }
  if (f.hasProbation) {
    if (!isISODate(f.probationEnd)) e.probationEnd = '수습 종료일을 입력하세요';
    else if (f.probationEnd < f.hireDate) e.probationEnd = '수습 종료일이 입사일보다 빨라요';
  }
  if (f.isForeign && f.visaExpiry && !isISODate(f.visaExpiry)) e.visaExpiry = '날짜 형식을 확인하세요';
  if (f.isForeign && f.permitHours && !(Number(f.permitHours) > 0))
    e.permitHours = '허가 시간은 0보다 커야 해요';
  if (
    f.isForeign &&
    (!Number.isFinite(Number(f.otherHours)) || Number(f.otherHours) < 0 || Number(f.otherHours) > 168)
  )
    e.otherHours = '다른 사업장 근무는 0~168시간으로 입력하세요';
  return e;
}

export function applyBasic(target: Employee, f: BasicForm) {
  target.alias = f.alias.trim();
  target.ageBand = f.ageBand;
  target.birthDate = f.ageBand === 'under18' ? f.birthDate : null;
  target.startedBefore65 =
    f.ageBand === '65+' ? (f.startedBefore65 === '' ? null : f.startedBefore65 === 'yes') : null;
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

export function BasicFields({
  f,
  setF,
  errors,
  isFood,
  editing,
}: {
  f: BasicForm;
  setF: (f: BasicForm) => void;
  errors: Record<string, string>;
  isFood: boolean;
  editing?: boolean;
}) {
  return (
    <div className="grid gap-4">
      <Notice tone="muted">
        실명·연락처·주민등록번호·외국인등록번호 칸은 없어요. 법정 서류의 이름은 출력 직전에 브라우저에서만
        입력해요.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="별칭" htmlFor="ef-alias" error={errors.alias} hint="모든 화면에 이 이름으로 보여요">
          <input
            id="ef-alias"
            className={inputCls}
            value={f.alias}
            onChange={(e) => setF({ ...f, alias: e.target.value })}
            placeholder="직원 D"
          />
        </Field>
        <Field
          label="입사일"
          htmlFor="ef-hire"
          error={errors.hireDate}
          hint={editing ? '입사일을 바꾸면 관련 기한이 다시 계산돼요' : undefined}
        >
          <input
            id="ef-hire"
            type="date"
            className={inputCls}
            value={f.hireDate}
            onChange={(e) => setF({ ...f, hireDate: e.target.value })}
          />
        </Field>
      </div>
      <Field label="나이대" hint="판정에는 구간만 필요해요. 생년월일은 18세 미만만 받아요">
        <Choice
          name="나이대"
          options={(Object.keys(AGE_LABEL) as AgeBand[]).map((v) => ({ value: v, label: AGE_LABEL[v] }))}
          value={f.ageBand}
          onChange={(v) => setF({ ...f, ageBand: v })}
        />
      </Field>
      {f.ageBand === 'under18' && (
        <Field label="생년월일 (18세 미만만)" htmlFor="ef-birth" error={errors.birthDate}>
          <input
            id="ef-birth"
            type="date"
            className={inputCls}
            value={f.birthDate}
            onChange={(e) => setF({ ...f, birthDate: e.target.value })}
          />
        </Field>
      )}
      {f.ageBand === '65+' && (
        <Field label="65세가 되기 전부터 일했나요?" hint="고용보험 판정에 필요해요">
          <Choice
            name="65세 전 근무"
            options={[
              { value: 'yes', label: '예' },
              { value: 'no', label: '아니오' },
              { value: '', label: '모르겠어요' },
            ]}
            value={f.startedBefore65}
            onChange={(v) => setF({ ...f, startedBefore65: v })}
          />
        </Field>
      )}
      <Field label="고용 방식">
        <Choice
          name="고용 방식"
          options={(Object.keys(EMPLOYMENT_LABEL) as EmploymentType[]).map((v) => ({
            value: v,
            label: EMPLOYMENT_LABEL[v],
          }))}
          value={f.employmentType}
          onChange={(v) => setF({ ...f, employmentType: v })}
        />
      </Field>
      {f.employmentType === 'fixed' && (
        <Field label="계약 종료일" htmlFor="ef-cend" error={errors.contractEnd}>
          <input
            id="ef-cend"
            type="date"
            className={inputCls}
            value={f.contractEnd}
            onChange={(e) => setF({ ...f, contractEnd: e.target.value })}
          />
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={f.hasProbation}
          onChange={(e) => setF({ ...f, hasProbation: e.target.checked })}
        />{' '}
        수습 기간이 있어요
      </label>
      {f.hasProbation && (
        <Field
          label="수습 종료일"
          htmlFor="ef-prob"
          error={errors.probationEnd}
          hint="수습 중이라도 자동으로 감액하지 않아요 (확인 필요)"
        >
          <input
            id="ef-prob"
            type="date"
            className={inputCls}
            value={f.probationEnd}
            onChange={(e) => setF({ ...f, probationEnd: e.target.value })}
          />
        </Field>
      )}
      {isFood && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.foodHandler}
            onChange={(e) => setF({ ...f, foodHandler: e.target.checked })}
          />{' '}
          식품을 조리·판매하는 일을 해요 (보건증 대상)
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={f.student}
          onChange={(e) => setF({ ...f, student: e.target.checked })}
        />{' '}
        학생이에요 (선택 — 시험 기간 공백 안내용, 학년·학과는 받지 않아요)
      </label>
      {f.student && (
        <Field label="학교" htmlFor="ef-school">
          <select
            id="ef-school"
            className={inputCls}
            value={f.school}
            onChange={(e) => setF({ ...f, school: e.target.value })}
          >
            <option value="">선택</option>
            {SCHOOLS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
      )}
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={f.isForeign}
          onChange={(e) => setF({ ...f, isForeign: e.target.checked })}
        />{' '}
        외국인 직원이에요
      </label>
      {f.isForeign && (
        <div className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
          <Field label="체류자격" htmlFor="ef-visa">
            <select
              id="ef-visa"
              className={inputCls}
              value={f.visa}
              onChange={(e) => setF({ ...f, visa: e.target.value as Visa })}
            >
              {VISAS.map((v) => (
                <option key={v} value={v}>
                  {VISA_LABEL[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="체류기간 만료일"
            htmlFor="ef-vexp"
            error={errors.visaExpiry}
            hint="30·7·3일 전에 알려줘요"
          >
            <input
              id="ef-vexp"
              type="date"
              className={inputCls}
              value={f.visaExpiry}
              onChange={(e) => setF({ ...f, visaExpiry: e.target.value })}
            />
          </Field>
          {(f.visa === 'D-2' || f.visa === 'D-4') && (
            <>
              <Field label="시간제취업 허가">
                <Choice
                  name="허가"
                  options={[
                    { value: 'yes', label: '있음' },
                    { value: 'no', label: '없음' },
                    { value: '', label: '모름' },
                  ]}
                  value={f.permitted}
                  onChange={(v) => setF({ ...f, permitted: v })}
                />
              </Field>
              <Field
                label="허가 시간 (주)"
                htmlFor="ef-ph"
                error={errors.permitHours}
                hint="유학생 허가 시간 기준은 원문 미확인 — 허가서 기준으로 입력"
              >
                <input
                  id="ef-ph"
                  type="number"
                  className={inputCls}
                  value={f.permitHours}
                  onChange={(e) => setF({ ...f, permitHours: e.target.value })}
                />
              </Field>
              <Field
                label="다른 사업장 주당 시간 합계"
                htmlFor="ef-oh"
                error={errors.otherHours}
                hint="가게 이름은 받지 않아요"
              >
                <input
                  id="ef-oh"
                  type="number"
                  className={inputCls}
                  value={f.otherHours}
                  onChange={(e) => setF({ ...f, otherHours: e.target.value })}
                />
              </Field>
            </>
          )}
          <Field label="국적 (선택)" htmlFor="ef-nat" hint="국민연금 상호주의 판단이 필요할 때만">
            <input
              id="ef-nat"
              className={inputCls}
              value={f.nationality}
              onChange={(e) => setF({ ...f, nationality: e.target.value })}
            />
          </Field>
          <p className="text-xs text-muted sm:col-span-2">
            체류자격만으로 취업 가능 여부를 단정하지 않아요. 외국인등록증 사본은 받지 않고 확인 여부와 날짜만
            남겨요.
          </p>
        </div>
      )}
      <Field label="4대보험 처리 방식" hint='"아직 안 함"은 홈에 위험으로 떠요. "가입 안 함" 선택지는 없어요'>
        <Choice
          name="보험 처리"
          options={(Object.keys(INSURANCE_METHOD_LABEL) as InsuranceMethod[]).map((v) => ({
            value: v,
            label: INSURANCE_METHOD_LABEL[v],
          }))}
          value={f.insuranceMethod}
          onChange={(v) => setF({ ...f, insuranceMethod: v })}
        />
      </Field>
    </div>
  );
}
