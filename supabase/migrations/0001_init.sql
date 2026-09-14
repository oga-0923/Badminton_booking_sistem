-- ============================================================================
-- 爪痕 (Tsumeato) - 大学体育館バドミントンコート予約システム
-- 初期スキーマ: プロフィール / コート / 予約 / (将来拡張)備品貸出
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type user_role as enum ('student', 'staff', 'admin');
create type reservation_status as enum ('pending_payment', 'confirmed', 'cancelled', 'expired');
create type equipment_type as enum ('racket', 'shuttle');
create type loan_status as enum ('borrowed', 'returned');

-- ----------------------------------------------------------------------------
-- updated_at 自動更新トリガー関数
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles: auth.users に 1:1 で紐づくプロフィール情報
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  student_id text,
  phone text,
  role user_role not null default 'student',
  stripe_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- 自分のロールを RLS 再帰なしに取得するための SECURITY DEFINER 関数
create or replace function get_my_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_staff_or_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(get_my_role() in ('staff', 'admin'), false);
$$;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(get_my_role() = 'admin', false);
$$;

alter table profiles enable row level security;

create policy "profiles_select_own_or_staff" on profiles
  for select using (auth.uid() = id or is_staff_or_admin());

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own_or_admin" on profiles
  for update using (auth.uid() = id or is_admin());

-- ----------------------------------------------------------------------------
-- courts: コート情報
-- ----------------------------------------------------------------------------
create table courts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger courts_set_updated_at
  before update on courts
  for each row execute function set_updated_at();

alter table courts enable row level security;

create policy "courts_select_authenticated" on courts
  for select using (auth.role() = 'authenticated');

create policy "courts_insert_staff" on courts
  for insert with check (is_staff_or_admin());

create policy "courts_update_staff" on courts
  for update using (is_staff_or_admin());

create policy "courts_delete_staff" on courts
  for delete using (is_staff_or_admin());

-- ----------------------------------------------------------------------------
-- venue_settings: 施設全体の設定 (1行のみ)
-- ----------------------------------------------------------------------------
create table venue_settings (
  id smallint primary key default 1 check (id = 1),
  open_time time not null default '08:00',
  close_time time not null default '22:00',
  slot_duration_minutes int not null default 60 check (slot_duration_minutes in (30, 60)),
  booking_window_days int not null default 14,
  cancellation_deadline_days_before int not null default 1,
  cancellation_deadline_time time not null default '23:59',
  price_per_slot_yen int not null default 0,
  pending_payment_timeout_minutes int not null default 10,
  updated_at timestamptz not null default now()
);

insert into venue_settings (id) values (1);

create trigger venue_settings_set_updated_at
  before update on venue_settings
  for each row execute function set_updated_at();

alter table venue_settings enable row level security;

create policy "venue_settings_select_authenticated" on venue_settings
  for select using (auth.role() = 'authenticated');

create policy "venue_settings_update_admin" on venue_settings
  for update using (is_admin());

-- ----------------------------------------------------------------------------
-- reservations: 予約
-- ----------------------------------------------------------------------------
create table reservations (
  id uuid primary key default gen_random_uuid(),
  court_id uuid not null references courts(id),
  user_id uuid not null references profiles(id),
  reservation_date date not null,
  start_time time not null,
  end_time time not null,
  status reservation_status not null default 'confirmed',
  hold_expires_at timestamptz,
  stripe_payment_intent_id text,
  amount_yen int not null default 0,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_time_order check (end_time > start_time)
);

-- 同一コート×日付×開始時刻の二重予約を防止 (仮予約/確定予約のみ対象)
create unique index reservations_no_double_booking
  on reservations (court_id, reservation_date, start_time)
  where status in ('pending_payment', 'confirmed');

create index reservations_user_idx on reservations (user_id);
create index reservations_date_idx on reservations (reservation_date);

create trigger reservations_set_updated_at
  before update on reservations
  for each row execute function set_updated_at();

alter table reservations enable row level security;

create policy "reservations_select_own_or_staff" on reservations
  for select using (user_id = auth.uid() or is_staff_or_admin());

create policy "reservations_insert_own" on reservations
  for insert with check (user_id = auth.uid());

create policy "reservations_update_own_or_staff" on reservations
  for update using (user_id = auth.uid() or is_staff_or_admin());

-- 指定日の空き状況を取得する関数。
-- 他人の予約者情報を漏らさず「埋まっているか」「自分の予約か」だけを返す。
create or replace function get_availability(p_date date)
returns table (
  court_id uuid,
  start_time time,
  end_time time,
  status reservation_status,
  is_own boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.court_id,
    r.start_time,
    r.end_time,
    r.status,
    (r.user_id = auth.uid()) as is_own
  from reservations r
  where r.reservation_date = p_date
    and r.status in ('pending_payment', 'confirmed')
    and auth.role() = 'authenticated';
$$;

grant execute on function get_availability(date) to authenticated;

-- 仮予約(決済未完了)を自動失効させるための関数
-- pg_cron または外部スケジューラ (Edge Function 等) から定期実行する想定
create or replace function expire_stale_reservations()
returns void
language sql
as $$
  update reservations
  set status = 'expired'
  where status = 'pending_payment'
    and hold_expires_at < now();
$$;

-- ----------------------------------------------------------------------------
-- 将来拡張: ラケット/シャトルのレンタル管理
-- ----------------------------------------------------------------------------
create table equipment (
  id uuid primary key default gen_random_uuid(),
  type equipment_type not null,
  name text not null,
  total_quantity int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger equipment_set_updated_at
  before update on equipment
  for each row execute function set_updated_at();

alter table equipment enable row level security;

create policy "equipment_select_authenticated" on equipment
  for select using (auth.role() = 'authenticated');

create policy "equipment_manage_staff" on equipment
  for all using (is_staff_or_admin()) with check (is_staff_or_admin());

create table equipment_loans (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id),
  reservation_id uuid references reservations(id),
  user_id uuid not null references profiles(id),
  quantity int not null default 1,
  status loan_status not null default 'borrowed',
  borrowed_at timestamptz not null default now(),
  due_at timestamptz,
  returned_at timestamptz
);

alter table equipment_loans enable row level security;

create policy "equipment_loans_select_own_or_staff" on equipment_loans
  for select using (user_id = auth.uid() or is_staff_or_admin());

create policy "equipment_loans_manage_staff" on equipment_loans
  for all using (is_staff_or_admin()) with check (is_staff_or_admin());
