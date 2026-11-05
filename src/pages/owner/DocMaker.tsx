// 계약서·명부 만들기: 등록값으로 양식을 채워 인쇄/PDF로 저장. 이름·상호·주소·대표자는 이 화면에서만 입력하고 저장하지 않는다.
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useStore, uid, nowIso } from '../../state/store';
import { conditionAt, conditionHistory, isUnder5, weeklyHours } from '../../domain/work';
import { contractKind } from '../../domain/checklist';
import { employeeInsurance, INSURANCE_LABEL, VERDICT_LABEL } from '../../domain/insurance';
import { checkMinimumWage } from '../../domain/wage';
import { fmtDate, WEEKDAY_EN, WEEKDAY_KO } from '../../domain/dates';
import { resolveRule } from '../../domain/rules';
import { Button, Card, Empty, Field, inputCls, LinkButton, Notice, PageHeader, useToast } from '../../ui/kit';
import { AGE_LABEL, EMPLOYMENT_LABEL } from '../../ui/labels';

export default function DocMaker() {
  const { kind = 'contract', empId = '' } = useParams();
  const [params] = useSearchParams();
  const { state, update, base } = useStore();
  const nav = useNavigate();
  const toast = useToast();
  const e = state.employees.find((x) => x.id === empId);
  const [names, setNames] = useState({ worker: '', company: state.workplace?.name ?? '', owner: '', address: '', place: '' });
  const [en, setEn] = useState(!!e?.isForeign);
  const [ack, setAck] = useState(false);
  if (!e) return <Empty title="직원을 찾을 수 없어요" action={<LinkButton to="/owner/documents">서류로</LinkButton>} />;
  const hist = conditionHistory(state.conditions, e.id);
  const condId = params.get('cond');
  const c = (condId && hist.find((h) => h.id === condId)) || conditionAt(state.conditions, e.id, base) || hist[0];
  if (!c) return <Empty title="근로조건이 없어요" />;
  const isChange = hist.length > 1 && hist[0].id !== c.id;
  const under5 = isUnder5(state.workplace?.scale);
  const mw = checkMinimumWage(c.hourlyWage, c.effectiveFrom);
  const ins = employeeInsurance(state, e, c.effectiveFrom);
  const wp = state.workplace!;
  const T = (ko: string, eng: string) => (en ? `${ko} / ${eng}` : ko);
  const writtenTerms = resolveRule<{ all: string[]; under5: string[] }>('fixedTerm.writtenTerms', base);

  const markGiven = () => {
    const key = kind === 'contract' ? `E1:${e.id}:${c.id}` : `E3:${e.id}`;
    update((d) => {
      d.docRecords = d.docRecords.filter((x) => x.key !== key);
      d.docRecords.push({ id: uid('doc'), key, itemId: kind === 'contract' ? 'E1' : 'E3', employeeId: e.id, status: 'done', doneAt: base, naReason: '', expiry: null, examDate: null, location: '', bulk: false, updatedAt: nowIso() });
    });
    toast(kind === 'contract' ? '교부 완료로 기록했어요' : '작성 완료로 기록했어요');
    nav(`/owner/documents?emp=${e.id}`);
  };

  return (
    <div className="max-w-3xl">
      <div className="no-print">
        <PageHeader
          title={kind === 'contract' ? `${isChange ? '변경 ' : ''}근로계약서 만들기 · ${e.alias}` : `근로자 명부 만들기 · ${e.alias}`}
          sub={kind === 'contract' ? contractKind(e, c) : '근로기준법 시행령 제20조 기재 항목'}
          actions={
            <>
              {e.isForeign && kind === 'contract' && <Button onClick={() => setEn(!en)}>{en ? '한국어만' : '영어 병기'}</Button>}
              <Button variant="primary" onClick={() => window.print()} reason={mw.status === 'below' && !ack ? '최저임금 미달 경고를 먼저 확인하세요' : undefined}>
                인쇄 / PDF 저장
              </Button>
            </>
          }
        />
        <Notice tone="warn" className="mb-3" title="참고용 초안이에요. 내용을 확인한 뒤 사용하세요">
          고용노동부 표준근로계약서 원본(HWP) 서식과 항목을 대조하지 않았어요. 서식 링크는 서식 자료실에 있어요.
        </Notice>
        {mw.status === 'below' && (
          <Notice tone="risk" className="mb-3" title={`최저임금 미달 — 적용일 기준 ${mw.required?.toLocaleString('ko-KR')}원`}>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={ack} onChange={(ev) => setAck(ev.target.checked)} /> 확인했어요 (계약서 생성은 막지 않아요)
            </label>
          </Notice>
        )}
        <Card className="mb-4" title="출력할 때만 입력 (저장하지 않아요)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="근로자 이름" htmlFor="dm-w">
              <input id="dm-w" className={inputCls} value={names.worker} onChange={(ev) => setNames({ ...names, worker: ev.target.value })} />
            </Field>
            <Field label="상호" htmlFor="dm-c">
              <input id="dm-c" className={inputCls} value={names.company} onChange={(ev) => setNames({ ...names, company: ev.target.value })} />
            </Field>
            <Field label="대표자" htmlFor="dm-o">
              <input id="dm-o" className={inputCls} value={names.owner} onChange={(ev) => setNames({ ...names, owner: ev.target.value })} />
            </Field>
            <Field label="사업장 주소" htmlFor="dm-a">
              <input id="dm-a" className={inputCls} value={names.address} onChange={(ev) => setNames({ ...names, address: ev.target.value })} />
            </Field>
            {kind === 'contract' && (
              <Field label="근무 장소" htmlFor="dm-p">
                <input id="dm-p" className={inputCls} value={names.place} onChange={(ev) => setNames({ ...names, place: ev.target.value })} placeholder="사업장 내" />
              </Field>
            )}
          </div>
        </Card>
      </div>

      <div className="print-area rounded-2xl border border-line bg-white p-6 text-sm leading-relaxed">
        {kind === 'contract' ? (
          <>
            <h2 className="text-center text-xl font-bold">{T(isChange ? '변경 근로계약서' : contractKind(e, c), isChange ? 'Amended Employment Contract' : 'Standard Employment Contract')}</h2>
            <p className="mt-4">
              {names.company || '____'}(이하 "사업주")와 {names.worker || e.alias}(이하 "근로자")는 다음과 같이 근로계약을 체결한다.
              {en && <span className="block text-xs text-muted">The employer and the employee agree to the following terms.</span>}
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5">
              <li>
                <b>{T('근로계약기간', 'Contract period')}</b>: {fmtDate(e.hireDate)}부터 {e.employmentType === 'fixed' && e.contractEnd ? `${fmtDate(e.contractEnd)}까지` : '기간의 정함이 없음'}
                {isChange && ` (변경 조건 적용일 ${fmtDate(c.effectiveFrom)})`}
                {e.probationEnd && ` · 수습 ${fmtDate(e.probationEnd)}까지`}
              </li>
              <li>
                <b>{T('근무 장소', 'Workplace')}</b>: {names.place || names.address || '사업장 내'}
              </li>
              <li>
                <b>{T('업무 내용', 'Job')}</b>: {c.job || '____'}
              </li>
              <li>
                <b>{T('근로일 및 근로시간', 'Working days and hours')}</b>:{' '}
                {c.variable ? (
                  '매주 달라 근로일별 시간을 별도 합의 (단시간근로자는 근로일·근로일별 근로시간을 서면으로 정해야 해요 — 확인 필요)'
                ) : (
                  <ul className="mt-1 list-disc pl-5">
                    {c.schedule.map((d, i) =>
                      d ? (
                        <li key={i}>
                          {WEEKDAY_KO[i]}
                          {en ? `(${WEEKDAY_EN[i]})` : ''} {d.start}~{d.end}, {T('휴게', 'break')} {d.breakMin}분
                        </li>
                      ) : null,
                    )}
                  </ul>
                )}
                <span className="block text-xs text-muted">주 소정근로시간 {weeklyHours(c).toFixed(1)}시간</span>
              </li>
              <li>
                <b>{T('휴일', 'Holidays')}</b>: 주휴일 매주 {WEEKDAY_KO[c.weeklyHolidayDay]}요일{under5 ? '' : ', 관공서 공휴일(유급)'}
              </li>
              <li>
                <b>{T('임금', 'Wages')}</b>: 시급 {c.hourlyWage.toLocaleString('ko-KR')}원{c.mealAllowance ? `, 식대 월 ${c.mealAllowance.toLocaleString('ko-KR')}원` : ''}. 주휴수당은 법령에 따라 지급. {under5 ? '' : '연장·야간·휴일근로는 통상임금의 50% 이상 가산. '}
                임금지급일 매월 {wp.payDay === 31 ? '말일' : `${wp.payDay}일`} ({wp.payMonthBasis === 'previous' ? '전월분' : '당월분'}), 지급방법: 근로자 명의 예금통장 입금 또는 직접 지급
              </li>
              <li>
                <b>{T('연차유급휴가', 'Annual leave')}</b>: {under5 ? '상시 4명 이하 사업장으로 근로기준법 제60조 미적용' : '근로기준법에서 정하는 바에 따라 부여'}
              </li>
              <li>
                <b>{T('사회보험 적용 여부 (예상)', 'Social insurance (expected)')}</b>: {ins.judgments.map((j) => `${INSURANCE_LABEL[j.kind]} ${VERDICT_LABEL[j.verdict]}`).join(', ')}
              </li>
              <li>
                <b>{T('근로계약서 교부', 'Delivery')}</b>: 사업주는 계약을 체결함과 동시에 본 계약서를 사본하여 근로자에게 교부함
              </li>
              <li>
                <b>{T('기타', 'Others')}</b>: 이 계약에 정함이 없는 사항은 근로기준법령에 의함
              </li>
            </ol>
            {writtenTerms.ok && (
              <p className="no-print mt-3 text-xs text-muted">
                서면 명시 사항 확인 ({under5 ? '1~4명' : '5명 이상'}): {(under5 ? writtenTerms.value.under5 : writtenTerms.value.all).join(' · ')} — 기간제법 제17조
              </p>
            )}
            {en && <p className="mt-3 text-xs">If the interpretation of the Korean and English versions differs, the Korean version prevails. (효력 확인 전 · 노무사 확인 C14)</p>}
            <div className="mt-8 grid grid-cols-2 gap-6">
              <div>
                <p className="font-bold">사업주</p>
                <p>상호: {names.company || '____'}</p>
                <p>주소: {names.address || '____'}</p>
                <p>대표자: {names.owner || '____'} (서명)</p>
              </div>
              <div>
                <p className="font-bold">근로자</p>
                <p>성명: {names.worker || '____'} (서명)</p>
                <p className="text-xs text-muted">주소·연락처는 서면에 직접 기재 (서비스에 저장하지 않음)</p>
              </div>
            </div>
            <p className="mt-6 text-center">{fmtDate(base)}</p>
          </>
        ) : (
          <>
            <h2 className="text-center text-xl font-bold">근로자 명부</h2>
            <table className="mt-4 w-full border border-line text-sm">
              <tbody className="divide-y divide-line">
                {[
                  ['성명', names.worker || '____ (출력 시 기재)'],
                  ['생년월일', e.birthDate ?? '____ (서면에 직접 기재)'],
                  ['나이대 (서비스 기록)', AGE_LABEL[e.ageBand]],
                  ['주소', '____ (서면에 직접 기재)'],
                  ['종사하는 업무', c.job || '____'],
                  ['고용 일자', fmtDate(e.hireDate)],
                  ['고용 방식', EMPLOYMENT_LABEL[e.employmentType]],
                  ['계약 기간', e.contractEnd ? `~ ${fmtDate(e.contractEnd)}` : '정함 없음'],
                  ['해고·퇴직 일자', e.resignDate ? fmtDate(e.resignDate) : '—'],
                  ['그 밖의 고용 사항', `주 ${weeklyHours(c).toFixed(1)}시간`],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <th className="w-40 bg-canvas px-3 py-2 text-left font-semibold">{k}</th>
                    <td className="px-3 py-2">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">사업장: {names.company || '____'} · 보관: 퇴직한 날부터 3년. 기재 항목은 시행령 제20조 기준으로 정리했어요 (서식 대조 전).</p>
          </>
        )}
      </div>
      <div className="no-print mt-4 flex justify-end gap-2">
        <Button onClick={() => nav(-1)}>돌아가기</Button>
        <Button variant="primary" onClick={markGiven}>
          {kind === 'contract' ? '서명 후 직원에게 줬어요' : '작성했어요'}
        </Button>
      </div>
    </div>
  );
}
