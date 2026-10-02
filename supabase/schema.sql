-- Base de l'espace partenaires « Sortir à Lille ».
-- À coller dans Supabase → SQL Editor → New query → Run.

create table if not exists content (
  kind text not null check (kind in ('sponsored', 'affiliates', 'offers', 'events')),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);

create table if not exists clicks (
  id bigint generated always as identity primary key,
  partner text not null,
  place_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists clicks_created_at_idx on clicks (created_at);

-- Sécurité : aucun accès public. Seul le serveur de l'app, avec la clé
-- « service_role » (jamais dans l'application), peut lire et écrire.
alter table content enable row level security;
alter table clicks enable row level security;
