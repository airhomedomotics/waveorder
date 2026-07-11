-- =============================================
-- TABELLA CANDIDATURE LIDI
-- =============================================

CREATE TABLE IF NOT EXISTS candidature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_contatto TEXT NOT NULL,
  email_contatto TEXT,
  telefono_contatto TEXT,
  nome_lido TEXT NOT NULL,
  piano_preferito TEXT DEFAULT 'commissione_5',
  messaggio TEXT,
  stato TEXT DEFAULT 'nuova' CHECK (stato IN ('nuova', 'contattato', 'approvata', 'rifiutata')),
  creato_il TIMESTAMPTZ DEFAULT NOW(),
  aggiornato_il TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: inserimento pubblico, lettura solo super admin
ALTER TABLE candidature ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chiunque può inserire una candidatura" ON candidature;
CREATE POLICY "Chiunque può inserire una candidatura"
  ON candidature
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Solo super admin leggono candidature" ON candidature;
CREATE POLICY "Solo super admin leggono candidature"
  ON candidature
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Solo super admin aggiornano candidature" ON candidature;
CREATE POLICY "Solo super admin aggiornano candidature"
  ON candidature
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM super_admins WHERE user_id = auth.uid()
    )
  );
