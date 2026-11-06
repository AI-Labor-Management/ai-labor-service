import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppState, Role } from '../src/domain/types';

export interface Identity {
  userId: string;
  workspaceId: string;
  role: Role;
  employeeId: string | null;
  assuranceLevel?: 'aal1' | 'aal2';
}
/** Replace with verified Supabase JWT + server membership lookup. Never trust a role from the browser. */
export type VerifyIdentity = (request: IncomingMessage) => Promise<Identity | null>;
export interface StateDocument {
  revision: number;
  state: AppState | null;
  updatedAt: string | null;
}
export interface StateRepository {
  read(workspaceId: string): Promise<StateDocument>;
  write(workspaceId: string, expectedRevision: number, state: AppState): Promise<StateDocument>;
}
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export interface AiInput {
  question: string;
  context: { industry: string; scale: string };
}
export interface AiAnswer {
  status: 'answer' | 'insufficient_evidence' | 'expert_required';
  text: string;
  citations: { title: string; url: string; checkedAt: string }[];
}
/** Questions must not be logged, cached, or persisted by the provider. */
export type AnswerQuestion = (input: AiInput, signal: AbortSignal) => Promise<AiAnswer>;
export type AuthProvider = (
  input: { action: 'login' | 'signup'; email: string; password: string },
  request: IncomingMessage,
  response: ServerResponse,
) => Promise<{ status: 'verification_required' | 'authenticated'; redirectTo?: string }>;
