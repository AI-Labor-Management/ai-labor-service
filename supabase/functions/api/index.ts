// 진입점 — supabase-js를 넣어 주고 처리기를 띄운다. 처리 코드는 handler.ts (supabase functions deploy로 배포할 때 그대로 쓰임)
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { setCreateClient } from '../_shared/db.ts';
import Anthropic from '@anthropic-ai/sdk';
import { setAnthropic } from './ai.ts';
import { handler } from './handler.ts';

setCreateClient(createClient);
setAnthropic(Anthropic);
Deno.serve(handler);
