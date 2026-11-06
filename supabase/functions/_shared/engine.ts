// 계산 엔진 묶음(domain.js)을 타입 계약(Engine)으로 감싼다.
import * as bundle from './domain.js';
import type { Engine } from './engine-api.ts';

export const engine = bundle as unknown as Engine;
