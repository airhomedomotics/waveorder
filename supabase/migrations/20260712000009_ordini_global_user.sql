-- Migrazione 9: Link Ordini a Utenti App Globali

ALTER TABLE public.ordini ADD COLUMN IF NOT EXISTS utente_app_id UUID REFERENCES public.utenti_app(id) ON DELETE SET NULL;
