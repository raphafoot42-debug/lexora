-- À coller dans Supabase → SQL Editor → New query → Run

create table if not exists app_db (
  id int primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists push_subscriptions (
  affiliate_id text primary key,
  subscription jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS activée mais aucune policy publique : seule la clé service_role
-- (utilisée uniquement côté serveur, jamais dans le front) peut lire/écrire.
alter table app_db enable row level security;
alter table push_subscriptions enable row level security;
