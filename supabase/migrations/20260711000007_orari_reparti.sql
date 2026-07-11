-- Aggiunge le colonne per gli orari di apertura e chiusura dei reparti Bar e Cucina
ALTER TABLE lidi ADD COLUMN IF NOT EXISTS bar_ora_apertura varchar(10) DEFAULT '07:00';
ALTER TABLE lidi ADD COLUMN IF NOT EXISTS bar_ora_chiusura varchar(10) DEFAULT '20:00';
ALTER TABLE lidi ADD COLUMN IF NOT EXISTS cucina_ora_apertura varchar(10) DEFAULT '12:30';
ALTER TABLE lidi ADD COLUMN IF NOT EXISTS cucina_ora_chiusura varchar(10) DEFAULT '17:00';
