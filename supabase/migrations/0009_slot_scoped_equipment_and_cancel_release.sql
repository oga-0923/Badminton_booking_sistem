-- ============================================================================
-- ① 予約キャンセル時、紐づくレンタル品を自動的に返却済みにする
-- ② 在庫を「予約日 + 時間枠」単位で計算する (枠が終われば即座に在庫が戻る)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ① キャンセルされた予約に紐づくレンタルを自動返却
-- ----------------------------------------------------------------------------
create or replace function release_rentals_on_cancel()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update equipment_loans
    set status = 'returned', returned_at = now()
    where reservation_id = new.id and status = 'borrowed';
  end if;
  return new;
end;
$$;

create trigger reservations_release_rentals_on_cancel
  after update on reservations
  for each row execute function release_rentals_on_cancel();

-- ----------------------------------------------------------------------------
-- ② 在庫計算を「予約日 + 開始時刻」単位に変更
-- (予約に紐づくレンタルはその時間枠のみ在庫を消費し、枠が変われば在庫は復活する。
--  予約に紐づかない当日受付のレンタルは、これまで通りその日1日分を消費する。)
-- ----------------------------------------------------------------------------
drop function if exists get_equipment_availability(date);

create or replace function get_equipment_availability(p_date date, p_start_time time default null)
returns table (
  equipment_id uuid,
  total_quantity int,
  available int
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.id,
    e.total_quantity,
    e.total_quantity - coalesce((
      select sum(l.quantity)
      from equipment_loans l
      left join reservations r on r.id = l.reservation_id
      where l.equipment_id = e.id
        and l.status = 'borrowed'
        and (
          (l.reservation_id is not null and r.reservation_date = p_date and r.start_time = p_start_time)
          or (l.reservation_id is null and l.borrowed_at::date = p_date)
        )
    ), 0)::int
  from equipment e;
$$;

grant execute on function get_equipment_availability(date, time) to authenticated;
