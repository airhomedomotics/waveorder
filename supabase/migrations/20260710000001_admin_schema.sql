-- 1. TABELLA SUPER ADMINS
create table super_admins (
    id uuid default uuid_generate_v4() primary key,
    user_id uuid not null, -- Riferimento a auth.users(id)
    email varchar(255) unique not null,
    creato_il timestamp with time zone default current_timestamp
);

-- Abilita RLS
alter table super_admins enable row level security;

-- 2. FUNZIONE HELPER PER VERIFICARE SE UN UTENTE E SUPER ADMIN
create or replace function is_super_admin(p_user_id uuid)
returns boolean as $$
    select exists(select 1 from super_admins where user_id = p_user_id);
$$ language sql security definer;

-- 3. RLS PER LA TABELLA SUPER_ADMINS
create policy "Super admin leggibili solo da altri super admin"
on super_admins for select
using (is_super_admin(auth.uid()));

create policy "Super admin gestibili solo da altri super admin"
on super_admins for all
using (is_super_admin(auth.uid()));

-- 4. AGGIUNGI POLICY DI SCRITTURA/LETTURA GENERALE PER I SUPER ADMIN SULLE ALTRE TABELLE
-- Lidi
create policy "Super admin possono fare tutto sui lidi"
on lidi for all
using (is_super_admin(auth.uid()));

-- Lidi Gestori
create policy "Super admin possono fare tutto sui lidi_gestori"
on lidi_gestori for all
using (is_super_admin(auth.uid()));

-- Ombrelloni
create policy "Super admin possono fare tutto sugli ombrelloni"
on ombrelloni for all
using (is_super_admin(auth.uid()));

-- Categorie Menu
create policy "Super admin possono fare tutto sulle categorie"
on categorie_menu for all
using (is_super_admin(auth.uid()));

-- Prodotti
create policy "Super admin possono fare tutto sui prodotti"
on prodotti for all
using (is_super_admin(auth.uid()));

-- Ordini
create policy "Super admin possono fare tutto sugli ordini"
on ordini for all
using (is_super_admin(auth.uid()));

-- Dettagli Ordine
create policy "Super admin possono fare tutto sui dettagli ordine"
on dettagli_ordine for all
using (is_super_admin(auth.uid()));

-- Commissioni Contanti
create policy "Super admin possono fare tutto sulle commissioni contanti"
on commissioni_contanti for all
using (is_super_admin(auth.uid()));

-- Segnalazioni Cancellazione
create policy "Super admin possono fare tutto sulle segnalazioni"
on segnalazioni_cancellazione for all
using (is_super_admin(auth.uid()));
