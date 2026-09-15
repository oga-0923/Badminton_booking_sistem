-- ============================================================================
-- プロフィール画面で保存前にリアルタイムに学籍番号を名簿照合するための関数。
-- is_verified_student(uuid) は保存済みプロフィールを見るのに対し、
-- こちらは入力中の文字列を直接名簿と照合する (名簿の中身は返さない)。
-- ============================================================================
create or replace function check_student_id(p_student_id text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from student_roster where student_id = p_student_id
  );
$$;

grant execute on function check_student_id(text) to authenticated;
