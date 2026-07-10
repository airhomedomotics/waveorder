-- Abilita le estensioni necessarie
create extension if not exists "uuid-ossp";

-- 1. TABELLA LIDI (TENANTS)
create table lidi (
    id uuid default uuid_generate_v4() primary key,
    nome_struttura varchar(255) not null,
    slug varchar(255) unique not null, -- Usato per l'URL del menu (es. lido-serena)
    email_amministratore varchar(255) unique not null,
    logo_url text,
    colore_primario varchar(7) default '#0070f3',
    
    -- Configurazione Finanziaria e Contratti
    tipo_contratto varchar(50) not null check (tipo_contratto in ('commissione_piena', 'ibrido', 'stagionale_flat')),
    quota_commissione_percentuale decimal(4,2) default 0.00, -- es. 5.00 o 2.00
    canone_mensile_fisso decimal(10,2) default 0.00,
    canone_stagionale_fisso decimal(10,2) default 0.00,
    
    -- Integrazione Stripe Connect
    stripe_account_id varchar(255), -- ID dell'account Stripe Connect del lido
    pagamenti_digitali_attivi boolean default false,
    accetta_contanti boolean default true,
    
    attivo boolean default true,
    creato_il timestamp with time zone default current_timestamp
);

-- 2. TABELLA GESTORI (MAPPING UTENTI AUTH CON I LIDI)
create table lidi_gestori (
    id uuid default uuid_generate_v4() primary key,
    lido_id uuid references lidi(id) on delete cascade not null,
    user_id uuid not null, -- Riferimento a auth.users(id) in Supabase
    ruolo varchar(50) default 'staff' check (ruolo in ('admin', 'staff')),
    creato_il timestamp with time zone default current_timestamp,
    unique (lido_id, user_id)
);

-- 3. TABELLA OMBRELLONI
create table ombrelloni (
    id uuid default uuid_generate_v4() primary key,
    lido_id uuid references lidi(id) on delete cascade not null,
    codice_identificativo varchar(50) not null, -- es. "A12", "Fila 3 - Num 4"
    qr_token varchar(255) unique not null,       -- Token univoco inserito nell'URL del QR Code
    creato_il timestamp with time zone default current_timestamp,
    unique (lido_id, codice_identificativo)
);

-- 4. TABELLA CATEGORIE MENU
create table categorie_menu (
    id uuid default uuid_generate_v4() primary key,
    lido_id uuid references lidi(id) on delete cascade not null,
    nome varchar(100) not null, -- es. "Cocktail", "Primi Piatti", "Gelati"
    ordine_visualizzazione int default 0,
    attiva boolean default true
);

-- 5. TABELLA PRODOTTI
create table prodotti (
    id uuid default uuid_generate_v4() primary key,
    categoria_id uuid references categorie_menu(id) on delete cascade not null,
    lido_id uuid references lidi(id) on delete cascade not null,
    nome varchar(255) not null,
    descrizione text,
    prezzo decimal(10,2) not null,
    immagine_url text,
    disponibile boolean default true,
    creato_il timestamp with time zone default current_timestamp
);

-- 6. TABELLA ORDINI
create table ordini (
    id uuid default uuid_generate_v4() primary key,
    lido_id uuid references lidi(id) on delete cascade not null,
    ombrellone_id uuid references ombrelloni(id) on delete set null,
    numero_ombrellone_manuale varchar(50), -- Backup se il QR non ha il token
    totale decimal(10,2) not null,
    stato varchar(50) default 'inviato' check (stato in ('inviato', 'in_preparazione', 'consegnato', 'annullato')),
    metodo_pagamento varchar(50) check (metodo_pagamento in ('carta_stripe', 'contanti')),
    stato_pagamento varchar(50) default 'in_attesa' check (stato_pagamento in ('in_attesa', 'pagato', 'fallito', 'rimborsato')),
    stripe_charge_id varchar(255),
    creato_il timestamp with time zone default current_timestamp
);

-- 7. TABELLA DETTAGLI ORDINE (ELEMENTI NEL CARRELLO)
create table dettagli_ordine (
    id uuid default uuid_generate_v4() primary key,
    ordine_id uuid references ordini(id) on delete cascade not null,
    prodotto_id uuid references prodotti(id) on delete set null,
    quantita int not null check (quantita > 0),
    prezzo_unitario decimal(10,2) not null, -- Storicizzato al momento dell'ordine
    note text -- es. "Senza ghiaccio", "Salse a parte"
);

-- 8. TABELLA COMMISSIONI ORDINI IN CONTANTI (FISCALIZZAZIONE SOFTWARE)
create table commissioni_contanti (
    id uuid default uuid_generate_v4() primary key,
    lido_id uuid references lidi(id) on delete cascade not null,
    ordine_id uuid references ordini(id) on delete cascade not null,
    importo_ordine decimal(10,2) not null,
    quota_commissione_percentuale decimal(4,2) not null,
    importo_commissione decimal(10,2) not null,
    creato_il timestamp with time zone default current_timestamp,
    unique (ordine_id)
);

-- 9. TABELLA SEGNALAZIONI CANCELLAZIONE TARDIVA (CASH FRAUD DETECTION)
create table segnalazioni_cancellazione (
    id uuid default uuid_generate_v4() primary key,
    lido_id uuid references lidi(id) on delete cascade not null,
    ordine_id uuid references ordini(id) on delete cascade not null,
    motivo text default 'Annullamento tardivo dopo preparazione',
    notificato boolean default false,
    creato_il timestamp with time zone default current_timestamp
);

---------------------------------------------------------
-- FUNZIONI HELPER E TRIGGER (LOGICA ANTI-FRODE CONTANTI)
---------------------------------------------------------

-- Funzione helper per ottenere il lido_id del gestore autenticato
create or replace function get_my_lido_id()
returns uuid as $$
    select lido_id from lidi_gestori where user_id = auth.uid() limit 1;
$$ language sql security definer;

-- Trigger 1: Calcola la commissione sui contanti all'ingresso in preparazione
create or replace function calcola_commissione_contanti()
returns trigger as $$
declare
    v_tipo_contratto varchar(50);
    v_quota decimal(4,2);
    v_commissione decimal(10,2);
begin
    if (NEW.stato = 'in_preparazione' and (OLD.stato = 'inviato' or OLD.stato is null)) then
        if (NEW.metodo_pagamento = 'contanti') then
            select tipo_contratto, quota_commissione_percentuale into v_tipo_contratto, v_quota
            from lidi where id = NEW.lido_id;
            
            if (v_tipo_contratto in ('commissione_piena', 'ibrido') and v_quota > 0) then
                v_commissione := round((NEW.totale * v_quota / 100.0), 2);
                
                insert into commissioni_contanti (lido_id, ordine_id, importo_ordine, quota_commissione_percentuale, importo_commissione)
                values (NEW.lido_id, NEW.id, NEW.totale, v_quota, v_commissione)
                on conflict (ordine_id) do nothing;
            end if;
        end if;
    end if;
    return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_calcola_commissione_contanti
after update on ordini
for each row
execute function calcola_commissione_contanti();


-- Trigger 2: Gestione Annullamento Tardivo
create or replace function controlla_annullamento_tardivo()
returns trigger as $$
begin
    if (NEW.stato = 'annullato' and OLD.stato = 'in_preparazione') then
        insert into segnalazioni_cancellazione (lido_id, ordine_id)
        values (NEW.lido_id, NEW.id);
    end if;
    return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_controlla_annullamento_tardivo
after update on ordini
for each row
execute function controlla_annullamento_tardivo();


-- Trigger 3: Blocco automatico dell'opzione contanti se tasso cancellazione > 10%
create or replace function controlla_tasso_cancellazione_contanti()
returns trigger as $$
declare
    v_totali_cash int;
    v_annullati_cash int;
    v_tasso decimal;
begin
    if (NEW.stato = 'annullato' and NEW.metodo_pagamento = 'contanti') then
        select count(*) into v_totali_cash
        from ordini
        where lido_id = NEW.lido_id
          and metodo_pagamento = 'contanti'
          and creato_il >= now() - interval '7 days';
          
        select count(*) into v_annullati_cash
        from ordini
        where lido_id = NEW.lido_id
          and metodo_pagamento = 'contanti'
          and stato = 'annullato'
          and creato_il >= now() - interval '7 days';
          
        if (v_totali_cash >= 10) then
            v_tasso := v_annullati_cash::decimal / v_totali_cash::decimal;
            if (v_tasso > 0.10) then
                update lidi
                set accetta_contanti = false
                where id = NEW.lido_id;
            end if;
        end if;
    end if;
    return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_controlla_tasso_cancellazione_contanti
after update on ordini
for each row
execute function controlla_tasso_cancellazione_contanti();


---------------------------------------------------------
-- CONFIGURAZIONE RLS (ROW LEVEL SECURITY)
---------------------------------------------------------

-- 1. RLS LIDI
alter table lidi enable row level security;

create policy "Lidi leggibili pubblicamente"
on lidi for select
using (attivo = true);

create policy "Lidi gestibili dai propri gestori"
on lidi for all
using (
    id in (select lido_id from lidi_gestori where user_id = auth.uid())
);

-- 2. RLS GESTORI
alter table lidi_gestori enable row level security;

create policy "Gestori leggibili dallo staff"
on lidi_gestori for select
using (
    lido_id in (select lido_id from lidi_gestori where user_id = auth.uid())
);

-- 3. RLS OMBRELLONI
alter table ombrelloni enable row level security;

create policy "Ombrelloni leggibili pubblicamente"
on ombrelloni for select
using (true);

create policy "Ombrelloni gestibili dai gestori"
on ombrelloni for all
using (
    lido_id in (select lido_id from lidi_gestori where user_id = auth.uid())
);

-- 4. RLS CATEGORIE MENU
alter table categorie_menu enable row level security;

create policy "Categorie leggibili pubblicamente"
on categorie_menu for select
using (attiva = true);

create policy "Categorie gestibili dai gestori"
on categorie_menu for all
using (
    lido_id in (select lido_id from lidi_gestori where user_id = auth.uid())
);

-- 5. RLS PRODOTTI
alter table prodotti enable row level security;

create policy "Prodotti leggibili pubblicamente"
on prodotti for select
using (disponibile = true);

create policy "Prodotti gestibili dai gestori"
on prodotti for all
using (
    lido_id in (select lido_id from lidi_gestori where user_id = auth.uid())
);

-- 6. RLS ORDINI
alter table ordini enable row level security;

create policy "Clienti possono inserire ordini"
on ordini for insert
with check (true);

create policy "Clienti possono vedere i propri ordini per ID"
on ordini for select
using (true); -- Consentiamo la lettura dell'ordine per ID a livello di API client

create policy "Gestori possono vedere e aggiornare i propri ordini"
on ordini for all
using (
    lido_id in (select lido_id from lidi_gestori where user_id = auth.uid())
);

-- 7. RLS DETTAGLI ORDINE
alter table dettagli_ordine enable row level security;

create policy "Clienti possono inserire dettagli ordine"
on dettagli_ordine for insert
with check (true);

create policy "Clienti possono vedere dettagli ordine"
on dettagli_ordine for select
using (true);

create policy "Gestori possono vedere dettagli dei propri ordini"
on dettagli_ordine for all
using (
    ordine_id in (
        select id from ordini where lido_id in (
            select lido_id from lidi_gestori where user_id = auth.uid()
        )
    )
);

-- 8. RLS COMMISSIONI CONTANTI
alter table commissioni_contanti enable row level security;

create policy "Gestori possono vedere le proprie commissioni contanti"
on commissioni_contanti for select
using (
    lido_id in (select lido_id from lidi_gestori where user_id = auth.uid())
);

-- 9. RLS SEGNALAZIONI CANCELLAZIONE
alter table segnalazioni_cancellazione enable row level security;

create policy "Clienti possono visualizzare le proprie segnalazioni"
on segnalazioni_cancellazione for select
using (true);

create policy "Gestori possono vedere le proprie segnalazioni"
on segnalazioni_cancellazione for select
using (
    lido_id in (select lido_id from lidi_gestori where user_id = auth.uid())
);
