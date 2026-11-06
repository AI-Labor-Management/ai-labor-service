// Edge Function `public-api` — 로그인 없이 쓰는 API (verify_jwt = false)
// 상태 확인, 규칙 데이터 조회(T13 완료 기준), 비회원 자가진단·채용 전 점검(저장 안 함), 비회원 상담 신청
import { engine as E } from '../_shared/engine.ts';
import type { AgeBand, Industry, ScaleBand } from '../_shared/domain-types.ts';
import { kstToday, serviceClient } from '../_shared/db.ts';
import { bad, corsHeaders, handleError, int, json, notFound, oneOf, readJson, str, subPath } from '../_shared/http.ts';

type Body = Record<string, unknown>;

function precheck(body: Body) {
  const date = body.date && E.isISODate(body.date) ? (body.date as string) : kstToday();
  const hourlyWage = int(body.hourlyWage, 'hourlyWage', 1, 1_000_000);
  const scale = oneOf(body.scale ?? '1-4', 'scale', ['1-4', '5-9', '10+'] as const) as ScaleBand;
  const industry = oneOf(body.industry ?? 'food', 'industry', ['food', 'retail', 'service'] as const) as Industry;
  const ageBand = oneOf(body.ageBand ?? '18-59', 'ageBand', ['under18', '18-59', '60-64', '65+'] as const) as AgeBand;
  const term = oneOf(body.contractTerm ?? 'none', 'contractTerm', ['lt1m', 'ge1m', 'none'] as const);
  if (!Array.isArray(body.schedule) || body.schedule.length !== 7) throw bad('schedule은 월~일 7칸 배열이어야 해요');
  const schedule = (body.schedule as unknown[]).map((d, i) => {
    if (d === null) return null;
    const o = d as Record<string, unknown>;
    if (!E.isHHMM(o.start) || !E.isHHMM(o.end)) throw bad(`schedule[${i}] 시간 형식(HH:MM)을 확인하세요`);
    return { start: o.start as string, end: o.end as string, breakMin: int(o.breakMin ?? 0, `schedule[${i}].breakMin`, 0, 600) };
  });
  const wage = E.quickWage({ hourlyWage, schedule, scale, date });
  const contractEnd = term === 'none' ? null : term === 'lt1m' ? E.addDays(date, 20) : E.addDays(date, 180);
  const judgments = E.judgeInsurance({ ageBand, startedBefore65: null, employmentType: term === 'none' ? 'regular' : 'fixed', hireDate: date, contractEnd, isForeign: body.isForeign === true, visa: null, nationality: '', weeklyHours: wage.weeklyHours, variable: false }, date);
  const rows = E.premiums(wage.monthlyPay, date, judgments as never[], industry, ageBand, null);
  return { date, wage, insurance: { judgments, rows, totals: E.premiumTotals(rows as never[]) }, stored: false, note: '입력값은 저장하지 않아요. 참고용 예상 금액이에요' };
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  try {
    const path = subPath(req, 'public-api');
    const url = new URL(req.url);
    const m = req.method;
    if (m === 'GET' && (path === '' || path === 'health')) {
      return json(req, { ok: true, service: 'ai-labor-service', function: 'public-api', time: new Date().toISOString(), kstToday: kstToday(), rules: { schema: E.RULES_FILE.schema, generatedAt: E.RULES_FILE.generatedAt, count: E.RULES_FILE.rules.length } });
    }
    if (m === 'GET' && path === 'rules') {
      const date = url.searchParams.get('date');
      if (!date) return json(req, E.RULES_FILE, 200, { 'Cache-Control': 'public, max-age=300' });
      if (!E.isISODate(date)) throw bad('date는 YYYY-MM-DD 형식이어야 해요');
      return json(req, { date, basis: E.RULES_FILE.basis, values: E.RULES_FILE.rules.map((r) => ({ id: r.id, label: r.label, category: r.category, ...E.resolveRule(r.id, date) })) });
    }
    if (m === 'GET' && path === 'faq') return json(req, E.FAQS, 200, { 'Cache-Control': 'public, max-age=300' });
    if (m === 'GET' && path === 'checklist-items') return json(req, E.CHECKLIST_ITEMS, 200, { 'Cache-Control': 'public, max-age=300' });
    if (m === 'GET' && path === 'holidays') return json(req, { source: E.HOLIDAY_SOURCE, holidays: E.HOLIDAYS });
    const body = await readJson<Body>(req);
    if (m === 'POST' && path === 'diagnosis') return json(req, { ...E.diagnose(body.answers ?? body), stored: false });
    if (m === 'POST' && path === 'precheck') return json(req, precheck(body));
    if (m === 'POST' && path === 'guest-consult') {
      const { data, error } = await serviceClient().rpc('submit_guest_consult', {
        p_nickname: str(body.nickname, '호칭', 30),
        p_phone: str(body.phone, '휴대폰 번호', 20),
        p_contact_time: str(body.contactTime, '연락 편한 시간', 60),
        p_topic: str(body.topic, '상담 주제', 30, false) || '기타',
        p_summary: str(body.summary, '진단 요약', 300, false),
        p_consent_collect: body.consentCollect === true,
        p_consent_provide: body.consentProvide === true,
        p_honeypot: typeof body.website === 'string' ? body.website : '',
      });
      if (error) throw error;
      return json(req, data, (data as { accepted?: boolean })?.accepted ? 201 : 200);
    }
    throw notFound(`없는 경로예요: ${m} /${path}`);
  } catch (e) {
    return handleError(req, e);
  }
}
