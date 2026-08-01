-- One-off fix: corrects the single "Cash sale" capital_transactions row
-- that was recorded before the cost-only fix (it currently shows the full
-- UGX 10,000 sale price instead of the UGX 6,000 cost that was actually
-- recovered), and adjusts the business's capital_balance by the difference.
--
-- Safe to run once. If you've already fixed this manually, running it
-- again will find nothing (amount = 10000 no longer matches) and do nothing.

do $$
declare
  v_biz_id uuid;
  v_txn_id uuid;
  v_old_amount numeric;
  v_new_amount numeric := 6000; -- the correct cost-recovered amount
  v_delta numeric;
begin
  select id into v_biz_id from businesses where name = 'FredMatic Shop';

  if v_biz_id is null then
    raise notice 'Business not found — check the name matches exactly.';
    return;
  end if;

  select id, amount into v_txn_id, v_old_amount
  from capital_transactions
  where business_id = v_biz_id
    and type = 'sale_income'
    and amount = 10000
    and note ilike 'Cash sale%'
  order by created_at desc
  limit 1;

  if v_txn_id is null then
    raise notice 'No matching transaction found — nothing to fix.';
    return;
  end if;

  v_delta := v_new_amount - v_old_amount;

  update capital_transactions
  set amount = v_new_amount,
      note = 'Cash sale — cost recovered'
  where id = v_txn_id;

  update businesses
  set capital_balance = capital_balance + v_delta
  where id = v_biz_id;

  raise notice 'Fixed transaction %, balance adjusted by %', v_txn_id, v_delta;
end $$;
