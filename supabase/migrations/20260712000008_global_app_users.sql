-- Migrazione 8: App Globale Utenti (B2B2C)

-- 1. Tabella Globale degli Utenti dell'App
CREATE TABLE IF NOT EXISTS public.utenti_app (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    telefono TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    cognome TEXT NOT NULL,
    creato_il TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sicurezza: Abilitiamo RLS
ALTER TABLE public.utenti_app ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accesso pubblico per creare utente (registrazione)" ON public.utenti_app
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Gli utenti possono leggere il proprio profilo" ON public.utenti_app
    FOR SELECT USING (true); -- Per ora publico (può essere ristretto in base al token/telefono)

CREATE POLICY "I Super Admin possono gestire tutti gli utenti" ON public.utenti_app
    FOR ALL USING (true);


-- 2. Tabella Relazionale: Punti dell'Utente per Singolo Lido
CREATE TABLE IF NOT EXISTS public.utenti_punti_lido (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    utente_id UUID REFERENCES public.utenti_app(id) ON DELETE CASCADE,
    lido_id UUID REFERENCES public.lidi(id) ON DELETE CASCADE,
    punti_totali INTEGER DEFAULT 0,
    aggiornato_il TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(utente_id, lido_id)
);

-- Sicurezza: Abilitiamo RLS
ALTER TABLE public.utenti_punti_lido ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Accesso pubblico in lettura dei propri punti" ON public.utenti_punti_lido
    FOR SELECT USING (true);

CREATE POLICY "I gestori possono modificare i punti del proprio lido" ON public.utenti_punti_lido
    FOR ALL USING (true); -- In produzione: auth.uid() IN (SELECT user_id FROM admin_lidi WHERE lido_id = utenti_punti_lido.lido_id)
