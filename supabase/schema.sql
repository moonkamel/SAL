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

-- Droits du serveur (clé secrète / service_role). Nécessaire sur les projets
-- où les nouvelles tables ne sont pas exposées automatiquement à l'API.
grant usage on schema public to service_role;
grant select, insert, update, delete on table content to service_role;
grant select, insert, update, delete on table clicks to service_role;

-- Statistiques d'usage anonymes (écrans, recherches, itinéraires).
create table if not exists events (
  id bigint generated always as identity primary key,
  name text not null,
  props jsonb,
  session text not null,
  created_at timestamptz not null default now()
);

create index if not exists events_created_at_idx on events (created_at);

alter table events enable row level security;
grant select, insert, delete on table events to service_role;
