-- ============================================================================
-- レンタル機能・管理画面 対応
-- - profiles.role の自己昇格を防止するセキュリティ修正
-- - equipment_loans に学生証有無・料金・徴収済みフラグを追加
-- - 学生自身がレンタル申請(insert)できるポリシーを追加
-- - コート閉鎖日 (court_closures) を追加
-- ============================================================================

-- ----------------------------------------------------------------------------
-- セキュリティ修正: 一般ユーザーが自分の role / stripe_customer_id を
-- 書き換えてしまわないようにする (RLSのUPDATEポリシーはON行の所有者チェックのみで
-- 列単位の制御はできないため、トリガーで保護する)。
-- ----------------------------------------------------------------------------
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
  end if;
  return new;
end;
$$;

create trigger profiles_protect_privileged_columns
  before update on profiles
  for each row execute function protect_profile_privileged_columns();

-- ----------------------------------------------------------------------------
-- equipment_loans: 学生証有無・料金・徴収済みフラグ
-- ----------------------------------------------------------------------------
alter table equipment_loans
  add column has_student_id boolean not null default true,
  add column fee_amount int not null default 0,
  add column fee_collected boolean not null default false;

-- 学生証なしでレンタルする場合の1点あたりの料金 (デフォルト10、通貨は price_per_slot と同じ想定)
alter table venue_settings
  add column rental_fee_per_item int not null default 10;

-- 学生自身が貸出を申請できるようにする (返却処理はスタッフのみ = equipment_loans_manage_staff)
create policy "equipment_loans_insert_own" on equipment_loans
  for insert with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- court_closures: コートの臨時休止日
-- ----------------------------------------------------------------------------
create table court_closures (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id) on delete cascade,
  closed_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (court_id, closed_date)
);

alter table court_closures enable row level security;

create policy "court_closures_select_authenticated" on court_closures
  for select using (auth.role() = 'authenticated');

create policy "court_closures_manage_staff" on court_closures
  for all using (is_staff_or_admin()) with check (is_staff_or_admin());

-- get_availability を拡張し、閉鎖日のコートも判定できるようにする
create or replace function is_court_closed(p_court_id uuid, p_date date)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from court_closures
    where court_id = p_court_id and closed_date = p_date
  );
$$;

grant execute on function is_court_closed(uuid, date) to authenticated;
