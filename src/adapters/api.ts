export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 0,
    public requestId?: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

/** Same-origin API only. Provider secrets never belong in a VITE_* variable. */
export async function apiRequest<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), 30000);
  const abort = () => controller.abort('cancelled');
  if (options.signal?.aborted) abort();
  else options.signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(`/api/v1/${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'X-Saram-Client': 'web' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const contentType = response.headers.get('Content-Type') ?? '';
    if (!contentType.includes('application/json'))
      throw new ServiceError(
        'API_UNAVAILABLE',
        '서버에 연결하지 못했어요. 개발용 API 또는 배포 경로를 확인해 주세요.',
        response.status,
      );
    const result = (await response.json()) as {
      data?: T;
      error?: { code: string; message: string; retryAfter?: number };
      requestId?: string;
    };
    if (!response.ok || result.error)
      throw new ServiceError(
        result.error?.code ?? 'API_ERROR',
        result.error?.message ?? '요청을 처리하지 못했어요.',
        response.status,
        result.requestId,
        result.error?.retryAfter,
      );
    return result.data as T;
  } catch (e) {
    if (e instanceof ServiceError) throw e;
    if (controller.signal.aborted)
      throw new ServiceError(
        options.signal?.aborted ? 'CANCELLED' : 'TIMEOUT',
        options.signal?.aborted
          ? '요청을 취소했어요.'
          : '응답을 기다리는 시간이 길어졌어요. 다시 시도해 주세요.',
      );
    throw new ServiceError('NETWORK_ERROR', '서버와 연결되지 않았어요. 연결을 확인하고 다시 시도해 주세요.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export interface AiAnswer {
  status: 'answer' | 'insufficient_evidence' | 'expert_required';
  text: string;
  citations: { title: string; url: string; checkedAt: string }[];
}
export const aiEnabled = import.meta.env.VITE_AI_ENABLED === 'true';
export const authEnabled = import.meta.env.VITE_AUTH_ENABLED === 'true';
export async function askAi(question: string, signal: AbortSignal): Promise<AiAnswer> {
  if (!aiEnabled)
    throw new ServiceError(
      'AI_NOT_CONFIGURED',
      'AI 제공사가 아직 연결되지 않았어요. FAQ나 노무 전문가 상담을 이용해 주세요.',
      503,
    );
  return apiRequest<AiAnswer>('consult/answer', { method: 'POST', body: { question }, signal });
}
export async function authenticate(
  input: { action: 'login' | 'signup'; email: string; password: string },
  signal: AbortSignal,
) {
  if (!authEnabled)
    throw new ServiceError('AUTH_NOT_CONFIGURED', '로그인 제공사가 아직 연결되지 않았어요.', 503);
  return apiRequest<{ status: 'verification_required' | 'authenticated'; redirectTo?: string }>('auth', {
    method: 'POST',
    body: input,
    signal,
  });
}
