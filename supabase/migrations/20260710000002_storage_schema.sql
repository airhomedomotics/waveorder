-- 1. CREAZIONE BUCKET PER WAVEORDER (LOGHI E PRODOTTI)
insert into storage.buckets (id, name, public)
values ('waveorder', 'waveorder', true)
on conflict (id) do nothing;

-- Abilita RLS per gli oggetti del bucket
alter table storage.objects enable row level security;

-- 2. POLICY PER ACCESSO PUBBLICO IN LETTURA ALLE IMMAGINI
create policy "Immagini leggibili pubblicamente"
on storage.objects for select
using (bucket_id = 'waveorder');

-- 3. POLICY PER CONSENTIRE L'INSERIMENTO DI IMMAGINI AGLI UTENTI AUTENTICATI
create policy "Gestori possono caricare immagini"
on storage.objects for insert
with check (
    bucket_id = 'waveorder' 
    and auth.role() = 'authenticated'
);

-- 4. POLICY PER CONSENTIRE LA CANCELLAZIONE DI IMMAGINI AI GESTORI
create policy "Gestori possono cancellare immagini"
on storage.objects for delete
using (
    bucket_id = 'waveorder' 
    and auth.role() = 'authenticated'
);
