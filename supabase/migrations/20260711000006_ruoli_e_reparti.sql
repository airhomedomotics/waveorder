-- 1. Aggiorna il vincolo del ruolo in lidi_gestori
ALTER TABLE lidi_gestori DROP CONSTRAINT IF EXISTS lidi_gestori_ruolo_check;
ALTER TABLE lidi_gestori ADD CONSTRAINT lidi_gestori_ruolo_check CHECK (ruolo IN ('admin', 'staff', 'cucina', 'bar'));

-- 2. Aggiunge la colonna reparto alla tabella prodotti
ALTER TABLE prodotti ADD COLUMN IF NOT EXISTS reparto varchar(50) DEFAULT 'bar' CHECK (reparto IN ('bar', 'cucina'));

-- 3. Auto-imposta il reparto a 'cucina' per i prodotti in categorie alimentari
UPDATE prodotti 
SET reparto = 'cucina'
WHERE categoria_id IN (
    SELECT id FROM categorie_menu 
    WHERE lower(nome) LIKE '%piatt%' 
       OR lower(nome) LIKE '%cucina%' 
       OR lower(nome) LIKE '%ristor%' 
       OR lower(nome) LIKE '%primi%' 
       OR lower(nome) LIKE '%secondi%' 
       OR lower(nome) LIKE '%insalat%' 
       OR lower(nome) LIKE '%pizza%' 
       OR lower(nome) LIKE '%panin%'
       OR lower(nome) LIKE '%food%'
       OR lower(nome) LIKE '%fritt%'
);

-- 4. Aggiunge colonne nome ed email alla tabella lidi_gestori per tracciare lo staff
ALTER TABLE lidi_gestori ADD COLUMN IF NOT EXISTS nome varchar(100);
ALTER TABLE lidi_gestori ADD COLUMN IF NOT EXISTS email varchar(255);

