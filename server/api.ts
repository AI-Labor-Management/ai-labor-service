import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import {
  ApiError,
  type AnswerQuestion,
  type AuthProvider,
  type Identity,
  type StateRepository,
  type VerifyIdentity,
} from './contracts';
import { validateAppState, StateValidationError } from '../src/domain/validateState';
import { isISODate, todayLocal } from '../src/domain/dates';
import { validMonth } from '../src/domain/navigation';
import { computeChecklist } from '../src/domain/checklist';
import { computeDeadlines } from '../src/domain/deadlines';
import { computeTodos } from '../src/domain/todos';
import { payrollLines } from '../src/domain/payroll';
import { employeeInsurance } from '../src/domain/insurance';
import { employeeScope, firmScope, adminScope } from '../src/domain/scopes';
import { detectPII, needsExpert } from '../src/domain/consult';
import { allRules } from '../src/domain/rules';

interface Options {
  repository: StateRepository;
  verifyIdentity?: VerifyIdentity;
  answerQuestion?: AnswerQuestion;
  authenticate?: AuthProvider;
  allowedOrigins?: string[];
  allowedHosts?: string[];
  /** Deliberately opt in, only from a loopback-bound development entrypoint. */
  developmentSession?: boolean;
  aiDailyLimit?: number;
}
const MAX_BODY = 5 * 1024 * 1024;
function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json'))
    throw new ApiError(415, 'JSON_REQUIRED', 'JSON 형식으로 보내 주세요.');
  return new Promise((resolve, reject) => {
    let size = 0,
      oversized = false;
    const chunks: Buffer[] = [];
    req.on('data', (part: Buffer) => {
      size += part.length;
      if (size > MAX_BODY) {
        oversized = true;
        chunks.length = 0;
      } else if (!oversized) chunks.push(part);
    });
    req.on('error', reject);
    req.on('aborted', () => reject(new ApiError(400, 'ABORTED', '요청이 취소됐어요.')));
    req.on('end', () => {
      if (oversized) return reject(new ApiError(413, 'BODY_TOO_LARGE', '파일은 5MB 이하여야 해요.'));
      try {
        const value: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
        resolve(value as Record<string, unknown>);
      } catch {
        reject(new ApiError(400, 'INVALID_JSON', 'JSON 내용을 확인해 주세요.'));
      }
    });
  });
}
function reply(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  res.end(JSON.stringify(value));
}
export function createApiServer(options: Options) {
  const sessions = new Map<string, { identity: Identity; expires: number }>();
  const quota = new Map<string, { day: string; count: number }>();
  const origins = options.allowedOrigins ?? ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const server = createServer(async (req, res) => {
    const requestId = randomUUID();
    try {
      // No wildcard CORS; DNS rebinding and cross-origin writes fail before session/body processing.
      const host = new URL(`http://${req.headers.host || 'invalid'}`).hostname;
      if (!(options.allowedHosts ?? ['localhost', '127.0.0.1', '[::1]']).includes(host))
        throw new ApiError(403, 'HOST_DENIED', '허용되지 않은 호스트예요.');
      if (req.headers.origin && !origins.includes(req.headers.origin))
        throw new ApiError(403, 'ORIGIN_DENIED', '허용되지 않은 출처예요.');
      const path = new URL(req.url || '/', 'http://localhost');
      const method = req.method || 'GET';
      if (method === 'OPTIONS')
        throw new ApiError(403, 'CORS_DENIED', '다른 사이트의 요청은 허용하지 않아요.');
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && req.headers['x-saram-client'] !== 'web')
        throw new ApiError(403, 'CLIENT_REQUIRED', '요청 확인 정보가 없어요.');
      const ok = (data: unknown) => reply(res, 200, { data, requestId });
      if (path.pathname === '/api/v1/health' && method === 'GET')
        return ok({
          service: '사람샘각',
          apiVersion: 1,
          mode: options.developmentSession ? 'development' : 'provider-required',
          authConnected: !!options.verifyIdentity,
          aiConnected: !!options.answerQuestion,
        });
      if (path.pathname === '/api/v1/rules' && method === 'GET')
        return ok({
          rules: allRules(),
          note: '수집된 기획 자료의 규칙이며 최신 법령 검증을 대신하지 않습니다.',
        });
      if (path.pathname === '/api/v1/dev/session' && method === 'POST') {
        if (
          !options.developmentSession ||
          !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')
        )
          throw new ApiError(404, 'NOT_FOUND', '경로를 찾지 못했어요.');
        for (const [key, session] of sessions) if (session.expires < Date.now()) sessions.delete(key);
        const existingToken = /(?:^|;\s*)saram_dev=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
        const existingSession = existingToken ? sessions.get(existingToken) : null;
        if (existingSession) return ok({ mode: 'development', identity: existingSession.identity });
        if (sessions.size >= 100)
          throw new ApiError(429, 'TOO_MANY_SESSIONS', '잠시 후 다시 시도해 주세요.', 60);
        const token = randomUUID();
        const identity: Identity = {
          userId: 'development-owner',
          workspaceId: 'development',
          role: 'owner',
          employeeId: null,
        };
        sessions.set(token, { identity, expires: Date.now() + 8 * 60 * 60 * 1000 });
        res.setHeader(
          'Set-Cookie',
          `saram_dev=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800`,
        );
        return ok({ mode: 'development', identity });
      }
      if (path.pathname === '/api/v1/auth' && method === 'POST') {
        if (!options.authenticate)
          throw new ApiError(503, 'AUTH_NOT_CONFIGURED', '로그인 제공사가 아직 연결되지 않았어요.');
        const b = await body(req);
        if (
          !['login', 'signup'].includes(String(b.action)) ||
          typeof b.email !== 'string' ||
          typeof b.password !== 'string' ||
          b.password.length < 8 ||
          b.password.length > 256 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email) ||
          b.email.length > 254
        )
          throw new ApiError(422, 'INVALID_AUTH_INPUT', '로그인 입력을 확인해 주세요.');
        return ok(
          await options.authenticate(
            { action: b.action as 'login' | 'signup', email: b.email, password: b.password },
            req,
            res,
          ),
        );
      }
      let identity = (await options.verifyIdentity?.(req)) ?? null;
      if (!identity && options.developmentSession) {
        const token = /(?:^|;\s*)saram_dev=([^;]+)/.exec(req.headers.cookie ?? '')?.[1];
        const session = token ? sessions.get(token) : null;
        if (session && session.expires >= Date.now()) identity = session.identity;
      }
      if (!identity) throw new ApiError(401, 'AUTH_REQUIRED', '로그인이 필요해요. 다시 연결해 주세요.');
      if (['firm', 'admin'].includes(identity.role) && identity.assuranceLevel !== 'aal2')
        throw new ApiError(403, 'MFA_REQUIRED', '2단계 인증을 완료해 주세요.');
      if (path.pathname === '/api/v1/me' && method === 'GET') return ok(identity);
      if (path.pathname === '/api/v1/state' && !['GET', 'PUT'].includes(method))
        throw new ApiError(405, 'METHOD_NOT_ALLOWED', '지원하지 않는 동작이에요.');
      if (path.pathname === '/api/v1/state') {
        if (identity.role !== 'owner')
          throw new ApiError(403, 'FORBIDDEN', '사장님만 전체 데이터를 관리할 수 있어요.');
        if (method === 'GET') return ok(await options.repository.read(identity.workspaceId));
        const b = await body(req);
        if (!Number.isSafeInteger(b.expectedRevision) || (b.expectedRevision as number) < 0)
          throw new ApiError(422, 'REVISION_REQUIRED', '저장 버전을 확인해 주세요.');
        const state = validateAppState(b.state);
        return ok(await options.repository.write(identity.workspaceId, b.expectedRevision as number, state));
      }
      const doc = await options.repository.read(identity.workspaceId);
      if (!doc.state) throw new ApiError(404, 'WORKSPACE_EMPTY', '사업장 정보를 먼저 등록해 주세요.');
      const state = doc.state;
      const base = path.searchParams.get('date') ?? state.settings.baseDateOverride ?? todayLocal();
      if (!isISODate(base)) throw new ApiError(422, 'INVALID_DATE', '날짜를 확인해 주세요.');
      if (path.pathname === '/api/v1/view' && method === 'GET') {
        if (identity.role === 'employee') {
          const employee = state.employees.find((e) => e.id === identity!.employeeId);
          if (!employee || employee.account !== 'joined')
            throw new ApiError(403, 'EMPLOYEE_ACCESS_DENIED', '직원 계정 연결 상태를 확인해 주세요.');
          return ok(employeeScope(state, employee.id, base));
        }
        if (identity.role === 'firm') return ok(firmScope(state));
        if (identity.role === 'admin') return ok(adminScope(state));
        return ok({ todos: computeTodos(state, base), revision: doc.revision });
      }
      if (identity.role !== 'owner') throw new ApiError(403, 'FORBIDDEN', '접근 권한이 없어요.');
      if (path.pathname === '/api/v1/consult/answer' && method === 'POST') {
        if (!state.workplace)
          throw new ApiError(422, 'WORKPLACE_REQUIRED', '사업장 설정을 먼저 완료해 주세요.');
        const b = await body(req);
        if (typeof b.question !== 'string' || !b.question.trim() || b.question.length > 2000)
          throw new ApiError(422, 'INVALID_QUESTION', '질문은 1~2,000자로 입력해 주세요.');
        if (detectPII(b.question).length)
          throw new ApiError(422, 'PERSONAL_DATA', '개인정보 패턴을 지운 뒤 다시 보내 주세요.');
        if (needsExpert(b.question))
          return ok({
            status: 'expert_required',
            text: '분쟁·해고 등은 노무 전문가의 확인이 필요해요.',
            citations: [],
          });
        if (!options.answerQuestion)
          throw new ApiError(
            503,
            'AI_NOT_CONFIGURED',
            'AI 제공사가 아직 연결되지 않았어요. FAQ 또는 노무 전문가 상담을 이용해 주세요.',
          );
        const key = identity.userId;
        let usage = quota.get(key);
        const day = new Date().toISOString().slice(0, 10);
        for (const [id, item] of quota) if (item.day !== day) quota.delete(id);
        if (!usage || usage.day !== day) {
          usage = { day, count: 0 };
          quota.set(key, usage);
        }
        if (usage.count >= (options.aiDailyLimit ?? 20))
          throw new ApiError(
            429,
            'DAILY_LIMIT',
            '오늘의 AI 이용 한도를 모두 사용했어요. 전문가 상담은 계속 이용할 수 있어요.',
            3600,
          );
        usage.count++;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);
        const stop = () => {
          if (!res.writableEnded) controller.abort();
        };
        res.on('close', stop);
        try {
          const answer = await Promise.race([
            options.answerQuestion(
              {
                question: b.question.trim(),
                context: { industry: state.workplace!.industry, scale: state.workplace!.scale },
              },
              controller.signal,
            ),
            new Promise<never>((_, reject) =>
              controller.signal.addEventListener(
                'abort',
                () =>
                  reject(
                    new ApiError(504, 'AI_TIMEOUT', '답변을 기다리는 시간이 길어졌어요. 다시 시도해 주세요.'),
                  ),
                { once: true },
              ),
            ),
          ]);
          if (
            !['answer', 'insufficient_evidence', 'expert_required'].includes(answer.status) ||
            typeof answer.text !== 'string' ||
            answer.text.length > 20000 ||
            !Array.isArray(answer.citations) ||
            answer.citations.some(
              (c) => typeof c.title !== 'string' || !/^https:\/\//.test(c.url) || !isISODate(c.checkedAt),
            )
          )
            throw new ApiError(502, 'INVALID_AI_RESPONSE', '답변의 근거 형식을 확인하지 못했어요.');
          if (answer.status === 'answer' && !answer.citations.length)
            return ok({
              status: 'insufficient_evidence',
              text: '확인 가능한 근거를 찾지 못했어요. 전문가에게 확인해 주세요.',
              citations: [],
            });
          return ok(answer);
        } finally {
          clearTimeout(timer);
          res.removeListener('close', stop);
        }
      }
      if (path.pathname === '/api/v1/owner/summary' && method === 'GET')
        return ok({
          todos: computeTodos(state, base),
          checklist: computeChecklist(state, base),
          deadlines: computeDeadlines(state, base),
        });
      if (path.pathname === '/api/v1/owner/payroll' && method === 'GET') {
        const month = path.searchParams.get('month');
        if (!validMonth(month)) throw new ApiError(422, 'INVALID_MONTH', '급여 월을 확인해 주세요.');
        return ok(payrollLines(state, month));
      }
      if (path.pathname === '/api/v1/owner/insurance' && method === 'GET') {
        const employee = state.employees.find((e) => e.id === path.searchParams.get('employeeId'));
        if (!employee) throw new ApiError(404, 'EMPLOYEE_NOT_FOUND', '직원을 찾지 못했어요.');
        return ok(employeeInsurance(state, employee, base));
      }
      throw new ApiError(404, 'NOT_FOUND', '경로를 찾지 못했어요.');
    } catch (e) {
      const error =
        e instanceof ApiError
          ? e
          : e instanceof StateValidationError
            ? new ApiError(422, 'INVALID_STATE', e.message)
            : new ApiError(500, 'INTERNAL_ERROR', '요청을 처리하지 못했어요. 기존 데이터는 보존돼요.');
      if (error.retryAfter) res.setHeader('Retry-After', error.retryAfter);
      if (!res.destroyed && !res.writableEnded)
        reply(res, error.status, {
          error: { code: error.code, message: error.message, retryAfter: error.retryAfter },
          requestId,
        });
    }
  });
  server.requestTimeout = 30000;
  server.headersTimeout = 10000;
  server.maxHeadersCount = 50;
  return server;
}
