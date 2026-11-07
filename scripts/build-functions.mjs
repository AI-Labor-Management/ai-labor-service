// Edge Function 공유 코드 만들기
//  1) src/domain 계산 엔진을 하나의 ESM 파일로 묶는다 → supabase/functions/_shared/domain.js
//  2) 도메인 타입을 복사한다 → supabase/functions/_shared/domain-types.ts
// 실행: npm run build:functions  (src/domain을 바꾸면 다시 실행하고 커밋)
import { build } from 'esbuild';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shared = join(root, 'supabase', 'functions', '_shared');

await build({
  entryPoints: [join(shared, 'domain-entry.ts')],
  outfile: join(shared, 'domain.js'),
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  charset: 'utf8',
  legalComments: 'none',
  logLevel: 'warning',
});

const js = await readFile(join(shared, 'domain.js'), 'utf8');
const hash = createHash('sha256').update(js).digest('hex').slice(0, 12);
await writeFile(
  join(shared, 'domain.js'),
  `// 자동 생성 파일 — 직접 고치지 마세요. 원본: src/domain, src/data (npm run build:functions)\n// sha256:${hash}\n${js}`,
);
await copyFile(join(root, 'src', 'domain', 'types.ts'), join(shared, 'domain-types.ts'));
console.log(`domain.js ${(js.length / 1024).toFixed(1)}KB sha256:${hash}`);

// 3) 함수별 단일 묶음 → supabase/functions/_dist/<함수>.js
//    handler와 setCreateClient만 내보내고 supabase-js는 넣지 않는다(진입점이 주입).
//    MCP·대시보드 배포 때 진입점이 이 파일을 커밋 고정 URL(jsDelivr)로 가져온다 — DEPLOY.md 참고.
const dist = join(root, 'supabase', 'functions', '_dist');
for (const fn of ['api', 'public-api', 'cron-daily']) {
  const out = join(dist, `${fn}.js`);
  await build({
    stdin: {
      // api는 Claude SDK도 진입점에서 넣어 준다 (setAnthropic) — SDK는 묶음에 넣지 않는다
      contents: `export { handler } from '../${fn}/handler.ts';\nexport { setCreateClient } from '../_shared/db.ts';\n${fn === 'api' ? "export { setAnthropic } from '../api/ai.ts';\n" : ''}`,
      resolveDir: dist,
      sourcefile: `${fn}-entry.ts`,
      loader: 'ts',
    },
    outfile: out,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'warning',
  });
  const code = await readFile(out, 'utf8');
  if (/from ["'](jsr|npm):/.test(code)) throw new Error(`${fn}.js에 jsr/npm 런타임 import가 남아 있어요`);
  const h = createHash('sha256').update(code).digest('hex').slice(0, 12);
  await writeFile(out, `// 자동 생성 파일 — 직접 고치지 마세요. 원본: supabase/functions/${fn}/handler.ts (npm run build:functions)\n// sha256:${h}\n${code}`);
  console.log(`_dist/${fn}.js ${(code.length / 1024).toFixed(1)}KB sha256:${h}`);
}
