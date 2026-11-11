// 테스트(Node)에서 Edge Function 파일(gemini.ts 등)을 불러올 때 필요한 Deno 전역의 최소 모양.
// 실제 값은 각 테스트가 vi.stubGlobal('Deno', …)로 넣는다.
declare const Deno: { env: { get(key: string): string | undefined } };
