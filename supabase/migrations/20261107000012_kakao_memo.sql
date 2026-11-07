-- 카카오톡 "나에게 보내기" 알림 (사장님 기한 알림, 하루 1번)
-- 사장님이 카카오 동의(talk_message)를 하면 카카오 갱신 토큰(refresh token)을 암호화해 둔다. 메시지 내용은 저장하지 않는다.
-- 연결을 끊거나 탈퇴하면(auth.users 삭제) 지운다. 토큰은 Edge Function(서비스 역할)만 읽는다.

create table public.kakao_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token_ciphertext bytea not null,
  refresh_expires_at timestamptz,
  connected_at timestamptz not null default now(),
  last_sent_on date,
  last_status text check (last_status in ('sent', 'failed')),
  last_detail text not null default '' check (char_length(last_detail) <= 300)
);
comment on table public.kakao_links is '카카오톡 나에게 보내기 연결 — 갱신 토큰(암호화)과 마지막 발송 결과. 연결 끊기·탈퇴 때 삭제';
alter table public.kakao_links enable row level security;
-- 정책 없음: 브라우저(anon·authenticated)는 읽거나 쓰지 못한다
revoke all on public.kakao_links from anon, authenticated;
grant select, insert, update, delete on public.kakao_links to service_role;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'kakao_token_key') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'kakao_token_key', '카카오 갱신 토큰 암호화 키 (kakao_links)');
  end if;
end $$;

-- 연결(p_connect = true: 연결 시각을 새로) 또는 토큰 갱신(false). p_expires_in은 초
create or replace function public.kakao_link_save(p_user uuid, p_refresh text, p_expires_in integer, p_connect boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_secret text;
  v_exp timestamptz := case when p_expires_in is null then null else now() + make_interval(secs => p_expires_in) end;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'kakao_token_key';
  if v_secret is null then raise exception 'kakao_token_key 없음'; end if;
  insert into public.kakao_links (user_id, refresh_token_ciphertext, refresh_expires_at)
  values (p_user, extensions.pgp_sym_encrypt(p_refresh, v_secret), v_exp)
  on conflict (user_id) do update set
    refresh_token_ciphertext = excluded.refresh_token_ciphertext,
    refresh_expires_at = coalesce(excluded.refresh_expires_at, public.kakao_links.refresh_expires_at),
    connected_at = case when p_connect then now() else public.kakao_links.connected_at end,
    last_status = case when p_connect then null else public.kakao_links.last_status end,
    last_detail = case when p_connect then '' else public.kakao_links.last_detail end;
end $$;

-- 갱신 토큰 꺼내기 (없으면 null)
create or replace function public.kakao_link_token(p_user uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  v_secret text;
  v_out text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'kakao_token_key';
  select extensions.pgp_sym_decrypt(l.refresh_token_ciphertext, v_secret) into v_out from public.kakao_links l where l.user_id = p_user;
  return v_out;
end $$;

revoke all on function public.kakao_link_save(uuid, text, integer, boolean) from public, anon, authenticated;
revoke all on function public.kakao_link_token(uuid) from public, anon, authenticated;
grant execute on function public.kakao_link_save(uuid, text, integer, boolean) to service_role;
grant execute on function public.kakao_link_token(uuid) to service_role;

-- 기능 스위치 설명을 실제 동작에 맞춘다 (발송은 함수 비밀 값 KAKAO_REST_KEY·KAKAO_CLIENT_SECRET이 있을 때만)
update public.app_settings
set value = 'true', note = '카카오 나에게 보내기 비상 스위치 — false면 키가 있어도 보내지 않는다. 실제 발송은 함수 비밀 값(KAKAO_REST_KEY·KAKAO_CLIENT_SECRET)과 사장님 연결이 있을 때만'
where key = 'kakao_enabled';
