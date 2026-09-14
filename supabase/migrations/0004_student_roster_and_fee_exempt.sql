-- ============================================================================
-- 学生名簿による認定システム / 手数料免除フラグ
-- ============================================================================

-- ----------------------------------------------------------------------------
-- student_roster: 先生から受け取る学生名簿 (学籍番号が正)
-- 個人情報のため学生本人には見せず、検証は is_verified_student() 経由のみ。
-- ----------------------------------------------------------------------------
create table student_roster (
  id uuid primary key default gen_random_uuid(),
  student_id text not null unique,
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

alter table student_roster enable row level security;

create policy "student_roster_manage_staff" on student_roster
  for all using (is_staff_or_admin()) with check (is_staff_or_admin());

-- プロフィールの学籍番号が名簿に存在するかどうかで学生認定を判定する。
create or replace function is_verified_student(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from profiles p
    join student_roster r on r.student_id = p.student_id
    where p.id = p_user_id
      and p.student_id is not null
      and p.student_id <> ''
  );
$$;

grant execute on function is_verified_student(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- profiles.is_fee_exempt: 特定アカウント (開発者など) を恒久的に無料にするフラグ
-- ----------------------------------------------------------------------------
alter table profiles add column is_fee_exempt boolean not null default false;

-- role / stripe_customer_id と同様、本人が勝手に書き換えられないよう保護対象に追加
create or replace function protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' and not is_admin() then
    new.role := old.role;
    new.stripe_customer_id := old.stripe_customer_id;
    new.is_fee_exempt := old.is_fee_exempt;
  end if;
  return new;
end;
$$;

-- 開発者アカウントを恒久的に手数料免除にする
update profiles set is_fee_exempt = true where email = '2621006.oy@sist.ac.jp';
