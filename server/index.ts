import { resolve } from 'node:path';
import { createApiServer } from './api';
import { FileStateRepository } from './repository';

if (process.env.NODE_ENV === 'production')
  throw new Error(
    '개발용 API는 production 모드로 실행할 수 없습니다. docs/API_HANDOFF.md를 읽고 실제 인증/DB 제공사를 연결하세요.',
  );
const port = Number(process.env.SARAM_API_PORT || 8787);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('SARAM_API_PORT는 1024~65535여야 합니다.');
const server = createApiServer({
  repository: new FileStateRepository(resolve(process.env.SARAM_DATA_DIR || '.local-data')),
  developmentSession: true,
});
server.listen(port, '127.0.0.1', () =>
  process.stdout.write(
    `사람샘각 개발용 API: http://127.0.0.1:${port}\n가상 데이터 전용 · 로그인/AI 제공사 미연결\n`,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.once(signal, () => {
    server.close();
    server.closeIdleConnections();
  });
