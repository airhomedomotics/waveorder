-- AGGIUNGI COLONNE DI CONFIGURAZIONE FIDELITY CARD ALLA TABELLA LIDI
alter table lidi add column if not exists fidelity_attivo boolean default true;
alter table lidi add column if not exists fidelity_soglia_punti integer default 100;
alter table lidi add column if not exists fidelity_valore_sconto decimal(10,2) default 5.00;
