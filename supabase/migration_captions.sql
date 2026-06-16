-- À exécuter dans Supabase SQL Editor (projet déjà créé avec schema.sql)
alter table ideas add column if not exists caption text;
alter table photos drop column if exists caption;
