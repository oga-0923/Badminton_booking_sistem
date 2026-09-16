-- ============================================================================
-- 備品の在庫を「予約日ごと」に正しく計算する。
-- これまでは equipment_loans.status='borrowed' を全期間で合計していたため、
-- 未来の予約に紐づくレンタルが、他の日の在庫まで圧迫してしまっていた。
-- ============================================================================
create or replace function get_equipment_availability(p_date date)
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
          -- 予約に紐づくレンタルは、その予約日の在庫としてのみ消費する
          (l.reservation_id is not null and r.reservation_date = p_date)
          -- 予約に紐づかない当日受付のレンタルは、その日の在庫としてのみ消費する
          or (l.reservation_id is null and l.borrowed_at::date = p_date)
        )
    ), 0)::int
  from equipment e;
$$;

grant execute on function get_equipment_availability(date) to authenticated;
