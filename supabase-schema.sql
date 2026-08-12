create table if not exists app_db (
  id bigint primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists postback_log (
  id bigint generated always as identity primary key,
  code text not null,
  type text not null,
  amount numeric(10,2) not null default 0,
  raw jsonb not null default '{}'::jsonb,
  received_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists postback_daily_stats (
  code text not null,
  date date not null,
  clicks integer not null default 0,
  signups integer not null default 0,
  ftd integer not null default 0,
  deposits numeric(10,2) not null default 0,
  revenue numeric(10,2) not null default 0,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (code, date)
);
