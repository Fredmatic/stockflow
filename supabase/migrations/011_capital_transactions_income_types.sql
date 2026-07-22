-- Migration 011: capital_transactions gains two more transaction types so
-- money coming back in from sales and debt/installment collections can
-- flow into the capital balance too (previously it only tracked top-ups
-- and stock purchases going out).
--   sale_income  — a cash sale's total, credited immediately
--   debt_payment — a customer paying down credit/an installment plan,
--                  credited when the payment is actually collected
-- Credit/installment sales themselves do NOT create a capital_transactions
-- row at the time of sale — only once money is actually collected.

alter table capital_transactions
  drop constraint if exists capital_transactions_type_check;

alter table capital_transactions
  add constraint capital_transactions_type_check
    check (type in ('topup', 'stock_purchase', 'sale_income', 'debt_payment', 'adjustment'));
