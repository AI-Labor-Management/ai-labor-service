-- E2E 시험 계정과 그 사업장 데이터 전부 지우기 (e2e-*@example.test만)
begin;
select set_config('app.allow_purge', 'on', true);
delete from public.payroll_lines where workplace_id in (select id from public.workplaces where owner_id in (select id from auth.users where email like 'e2e-%@example.test'));
delete from public.payroll_edits where workplace_id in (select id from public.workplaces where owner_id in (select id from auth.users where email like 'e2e-%@example.test'));
delete from public.statement_deliveries where workplace_id in (select id from public.workplaces where owner_id in (select id from auth.users where email like 'e2e-%@example.test'));
delete from public.workplaces where owner_id in (select id from auth.users where email like 'e2e-%@example.test');
delete from public.firm_members where user_id in (select id from auth.users where email like 'e2e-%@example.test');
delete from auth.users where email like 'e2e-%@example.test';
commit;
select (select count(*) from auth.users where email like 'e2e-%@example.test') as remaining_users;
