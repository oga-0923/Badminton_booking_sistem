-- ============================================================================
-- QRコードによる入場チェックイン
-- ============================================================================

alter table reservations add column checked_in_at timestamptz;

-- スタッフがQRコード(予約ID)をスキャンして予約内容を確認するための関数。
-- 本人以外の予約情報を select ポリシー経由で見せずに済むよう SECURITY DEFINER にする。
create or replace function get_checkin_info(p_reservation_id uuid)
returns table (
  id uuid,
  court_name text,
  reservation_date date,
  start_time time,
  end_time time,
  status reservation_status,
  full_name text,
  student_id text,
  checked_in_at timestamptz,
  rentals jsonb
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.id,
    c.name,
    r.reservation_date,
    r.start_time,
    r.end_time,
    r.status,
    p.full_name,
    p.student_id,
    r.checked_in_at,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('type', e.type, 'quantity', l.quantity))
        from equipment_loans l
        join equipment e on e.id = l.equipment_id
        where l.reservation_id = r.id
      ),
      '[]'::jsonb
    )
  from reservations r
  join courts c on c.id = r.court_id
  join profiles p on p.id = r.user_id
  where r.id = p_reservation_id
    and is_staff_or_admin();
$$;

grant execute on function get_checkin_info(uuid) to authenticated;
