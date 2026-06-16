-- À exécuter une seule fois dans Supabase : SQL Editor → New query → Run

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  letter text not null check (letter ~ '^[A-Z]$'),
  text text not null,
  checked boolean not null default false,
  caption text,
  created_at timestamptz not null default now()
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references ideas(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_state (
  id int primary key default 1,
  next_idea_id uuid references ideas(id) on delete set null
);
insert into app_state (id) values (1) on conflict (id) do nothing;

-- Accès ouvert (pas de connexion) : RLS activé mais policy permissive pour tous.
alter table ideas enable row level security;
alter table photos enable row level security;
alter table app_state enable row level security;

create policy "ideas_all" on ideas for all using (true) with check (true);
create policy "photos_all" on photos for all using (true) with check (true);
create policy "app_state_all" on app_state for all using (true) with check (true);

-- Bucket de stockage public pour les photos
insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "photos_bucket_read" on storage.objects for select using (bucket_id = 'photos');
create policy "photos_bucket_write" on storage.objects for insert with check (bucket_id = 'photos');
create policy "photos_bucket_delete" on storage.objects for delete using (bucket_id = 'photos');

-- Données de départ (3 idées par lettre)
insert into ideas (letter, text) values
('A','Aquarium'),('A','Atelier de cuisine'),('A','Astronomie (nuit étoilée)'),
('B','Balade en vélo'),('B','Bowling'),('B','Brunch en amoureux'),
('C','Cinéma en plein air'),('C','Cours de danse'),('C','Chalet à la montagne'),
('D','Dégustation de vins'),('D','Dessin ensemble'),('D','Dîner aux chandelles'),
('E','Escape game'),('E','Exposition d''art'),('E','Escalade'),
('F','Festival de musique'),('F','Feu de camp'),('F','Forêt enchantée'),
('G','Grimpette en forêt'),('G','Gastronomie locale'),('G','Go-kart'),
('H','Hammam & spa'),('H','Hamac sous les étoiles'),('H','Hiking en montagne'),
('I','Île à explorer'),('I','Impro théâtre'),('I','Ice skating'),
('J','Jardinage ensemble'),('J','Jeux de société'),('J','Journée plage'),
('K','Karaoké'),('K','Kayak'),('K','Kart électrique'),
('L','Laser game'),('L','Lecture au parc'),('L','Lunapark'),
('M','Match de sport'),('M','Musée'),('M','Marché nocturne'),
('N','Nuit sous les étoiles'),('N','Nuit dans un hôtel insolite'),('N','Nature walk'),
('O','Opéra'),('O','Observation des oiseaux'),('O','Open mic comedy'),
('P','Pique-nique'),('P','Paint & sip'),('P','Poterie'),
('Q','Quiz en couple'),('Q','Quartier méconnu à explorer'),('Q','Quête urbaine'),
('R','Road trip surprise'),('R','Restaurant haut de gamme'),('R','Randonnée'),
('S','Spa'),('S','Surf'),('S','Soirée jeux vidéo en duo'),
('T','Théâtre'),('T','Trampolines'),('T','Tir à l''arc'),
('U','Urban sketching'),('U','Ukulélé (cours à deux)'),('U','Ultramarathon spectateur'),
('V','Vignoble'),('V','Vélo électrique'),('V','Vide-greniers dépaysant'),
('W','Week-end surprise'),('W','Wakeboard'),('W','Workshop créatif'),
('X','Xylophone atelier'),('X','Xbox gaming café'),('X','Xmas market (marché de Noël)'),
('Y','Yoga du matin'),('Y','Yourte romantique'),('Y','Yoga aerial'),
('Z','Zoo'),('Z','Zen retraite'),('Z','Ziplining');
