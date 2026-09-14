-- ============================================================================
-- 運用ルールの反映: 開館時間 18:00-21:00 / コート1〜8 / 通貨を円→汎用(台湾元想定)に変更
-- ============================================================================

-- amount_yen / price_per_slot_yen は日本円前提の命名だったため、
-- 通貨非依存の列名に変更する (今回は台湾元での運用を想定)。
alter table reservations rename column amount_yen to amount;
alter table venue_settings rename column price_per_slot_yen to price_per_slot;

update venue_settings
set
  open_time = '18:00',
  close_time = '21:00',
  slot_duration_minutes = 60,
  price_per_slot = 40
where id = 1;

-- 既存のサンプルコート (コート A/B/C) を削除し、コート1〜8に置き換える。
-- 動作確認中に入ったテスト予約も併せて削除する (本番運用開始後は実行しないこと)。
delete from reservations where court_id in (select id from courts where name in ('コート A', 'コート B', 'コート C'));
delete from courts where name in ('コート A', 'コート B', 'コート C');

insert into courts (name)
select 'コート' || n
from generate_series(1, 8) as n
on conflict do nothing;
