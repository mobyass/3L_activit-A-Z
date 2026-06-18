-- À exécuter dans Supabase SQL Editor
alter table ideas add column if not exists done_at date;
