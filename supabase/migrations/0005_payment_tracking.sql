-- ============================================================================
-- 現金決済の手動管理: 予約に paid フラグを追加
-- ============================================================================

alter table reservations add column paid boolean not null default false;

-- 金額0円(手数料免除)の予約は支払い不要のため、最初から支払い済み扱いにする
update reservations set paid = true where amount = 0;
