-- TABELLA CLIENTI FIDELITY (OSPITI PWA)
-- Ogni cliente si registra con nome + telefono per ogni lido
create table clienti_fidelity (
    id uuid default uuid_generate_v4() primary key,
    lido_id uuid references lidi(id) on delete cascade not null,
    nome varchar(100) not null,
    cognome varchar(100) not null,
    telefono varchar(20) not null,
    punti_totali integer default 0,
    creato_il timestamp with time zone default current_timestamp,
    unique (lido_id, telefono) -- un solo profilo per lido per numero di telefono
);

-- Aggiungere colonna cliente_fidelity_id agli ordini per tracciare il cliente
alter table ordini add column if not exists cliente_fidelity_id uuid references clienti_fidelity(id) on delete set null;

-- RLS: la tabella deve essere accessibile pubblicamente dalla PWA (non autenticata)
alter table clienti_fidelity enable row level security;

-- I clienti possono registrarsi (insert) liberamente
create policy "Clienti possono registrarsi"
on clienti_fidelity for insert
with check (true);

-- I clienti possono leggere il proprio profilo (filtrato lato API per telefono + lido_id)
create policy "Clienti possono leggere profili"
on clienti_fidelity for select
using (true);

-- I clienti possono aggiornare i propri punti (filtrato lato API per id)
create policy "Clienti possono aggiornare punti"
on clienti_fidelity for update
using (true);

-- I gestori possono gestire i clienti del proprio lido
create policy "Gestori possono gestire clienti fidelity"
on clienti_fidelity for all
using (
    lido_id in (select lido_id from lidi_gestori where user_id = auth.uid())
);
