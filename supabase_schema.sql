-- ============================================================
-- CB Training Futevôlei — Schema Supabase
-- Cole este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

-- Jogadores
create table players (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  gender text not null check (gender in ('Masculino', 'Feminino')),
  level text not null check (level in ('Intermediário', 'Avançado')),
  side text not null check (side in ('Direita', 'Esquerda', 'Ambos')),
  created_at timestamptz default now()
);

-- Partidas
create table matches (
  id uuid default gen_random_uuid() primary key,
  category text not null check (category in ('Masculino', 'Feminino', 'Misto')),
  match_level text,
  p1 uuid references players(id) on delete cascade,
  p1_level text,
  p2 uuid references players(id) on delete cascade,
  p2_level text,
  p3 uuid references players(id) on delete cascade,
  p3_level text,
  p4 uuid references players(id) on delete cascade,
  p4_level text,
  winner text check (winner in ('A', 'B')),
  source text default 'manual',
  match_date text,
  created_at timestamptz default now()
);

-- Sorteios (sessões do dia)
create table sorteios (
  id uuid default gen_random_uuid() primary key,
  category text not null,
  duplas jsonb not null,
  jogos jsonb not null,
  leftover_msg text,
  created_at timestamptz default now()
);

-- RLS: acesso público de leitura, escrita sem autenticação (app interno)
alter table players enable row level security;
alter table matches enable row level security;
alter table sorteios enable row level security;

create policy "public read players" on players for select using (true);
create policy "public insert players" on players for insert with check (true);
create policy "public delete players" on players for delete using (true);

create policy "public read matches" on matches for select using (true);
create policy "public insert matches" on matches for insert with check (true);
create policy "public delete matches" on matches for delete using (true);

create policy "public read sorteios" on sorteios for select using (true);
create policy "public insert sorteios" on sorteios for insert with check (true);
create policy "public update sorteios" on sorteios for update using (true);
create policy "public delete sorteios" on sorteios for delete using (true);
