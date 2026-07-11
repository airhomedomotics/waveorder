import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getGestore } from '@/utils/supabase/auth';

// GET: Recupera il lido associato all'utente loggato, oppure cerca per slug (pubblico)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');

    // Se viene passato uno slug, è una richiesta pubblica (es. cliente ombrellone)
    if (slug) {
      const { data: lido, error } = await supabase
        .from('lidi')
        .select('id, nome_struttura, slug, logo_url, colore_primario, accetta_contanti, pagamenti_digitali_attivi, stripe_account_id, bar_ora_apertura, bar_ora_chiusura, cucina_ora_apertura, cucina_ora_chiusura')
        .eq('slug', slug)
        .eq('attivo', true)
        .single();

      if (error || !lido) {
        return NextResponse.json({ error: 'Lido non trovato o non attivo' }, { status: 404 });
      }

      return NextResponse.json({ lido });
    }

    // Altrimenti, recupera la sessione per l'amministrazione del lido
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Ottieni il lido a cui appartiene il gestore (con supporto impersonificazione per Super Admin)
    const gestoreData = await getGestore(supabase, user);

    if (!gestoreData) {
      return NextResponse.json({ error: 'Nessun lido associato a questo account' }, { status: 404 });
    }

    const { data: lido, error: lidoError } = await supabase
      .from('lidi')
      .select('*')
      .eq('id', gestoreData.lido_id)
      .single();

    if (lidoError || !lido) {
      return NextResponse.json({ error: 'Lido non trovato' }, { status: 404 });
    }

    return NextResponse.json({ lido });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Crea un nuovo lido (Tenant) e mappa l'utente loggato come gestore
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body = await request.json();
    const { nome_struttura, slug, logo_url, colore_primario, tipo_contratto, accetta_contanti } = body;

    if (!nome_struttura || !slug || !tipo_contratto) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti: nome_struttura, slug, tipo_contratto' }, { status: 400 });
    }

    // Calcola i valori di default per i canoni in base al tipo di contratto
    let quota_commissione_percentuale = 0.00;
    let canone_mensile_fisso = 0.00;
    let canone_stagionale_fisso = 0.00;

    if (tipo_contratto === 'commissione_piena') {
      quota_commissione_percentuale = 5.00;
    } else if (tipo_contratto === 'ibrido') {
      quota_commissione_percentuale = 2.00;
      canone_mensile_fisso = 149.00;
    } else if (tipo_contratto === 'stagionale_flat') {
      canone_stagionale_fisso = 900.00;
    }

    // Inserisci il nuovo lido
    const { data: lido, error: lidoError } = await supabase
      .from('lidi')
      .insert({
        nome_struttura,
        slug,
        email_amministratore: user.email!,
        logo_url,
        colore_primario: colore_primario || '#0070f3',
        tipo_contratto,
        quota_commissione_percentuale,
        canone_mensile_fisso,
        canone_stagionale_fisso,
        accetta_contanti: accetta_contanti !== undefined ? accetta_contanti : true
      })
      .select()
      .single();

    if (lidoError || !lido) {
      return NextResponse.json({ error: `Errore creazione lido: ${lidoError?.message}` }, { status: 400 });
    }

    // Associa l'utente loggato come amministratore del lido creato
    const { error: gestoreError } = await supabase
      .from('lidi_gestori')
      .insert({
        lido_id: lido.id,
        user_id: user.id,
        ruolo: 'admin'
      });

    if (gestoreError) {
      // In caso di errore nel mapping, proviamo a cancellare il lido per consistenza
      await supabase.from('lidi').delete().eq('id', lido.id);
      return NextResponse.json({ error: `Errore associazione gestore: ${gestoreError.message}` }, { status: 500 });
    }

    return NextResponse.json({ lido, message: 'Lido creato con successo!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Aggiorna la configurazione del lido (Branding, Stripe keys, Pagamenti)
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Controlla se è un super admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    // Recupera lido del gestore (con supporto impersonificazione per Super Admin)
    const gestoreData = await getGestore(supabase, user);

    const body = await request.json();
    const {
      lido_id,
      nome_struttura,
      logo_url,
      colore_primario,
      accetta_contanti,
      stripe_account_id,
      pagamenti_digitali_attivi,
      fidelity_attivo,
      fidelity_soglia_punti,
      fidelity_valore_sconto,
      bar_ora_apertura,
      bar_ora_chiusura,
      cucina_ora_apertura,
      cucina_ora_chiusura,
      // Campi riservati al super_admin
      tipo_contratto,
      quota_commissione_percentuale,
      canone_mensile_fisso,
      canone_stagionale_fisso,
      attivo
    } = body;

    // Determina il lido target
    const targetLidoId = (superAdmin && lido_id) ? lido_id : gestoreData?.lido_id;

    if (!targetLidoId) {
      return NextResponse.json({ error: 'Struttura lido non specificata o non associata' }, { status: 400 });
    }

    // Crea oggetto di aggiornamento
    const updateData: any = {};
    if (nome_struttura !== undefined) updateData.nome_struttura = nome_struttura;
    if (logo_url !== undefined) updateData.logo_url = logo_url;
    if (colore_primario !== undefined) updateData.colore_primario = colore_primario;
    if (accetta_contanti !== undefined) updateData.accetta_contanti = accetta_contanti;
    if (stripe_account_id !== undefined) updateData.stripe_account_id = stripe_account_id;
    if (pagamenti_digitali_attivi !== undefined) updateData.pagamenti_digitali_attivi = pagamenti_digitali_attivi;
    if (fidelity_attivo !== undefined) updateData.fidelity_attivo = fidelity_attivo;
    if (fidelity_soglia_punti !== undefined) updateData.fidelity_soglia_punti = fidelity_soglia_punti;
    if (fidelity_valore_sconto !== undefined) updateData.fidelity_valore_sconto = fidelity_valore_sconto;
    if (bar_ora_apertura !== undefined) updateData.bar_ora_apertura = bar_ora_apertura;
    if (bar_ora_chiusura !== undefined) updateData.bar_ora_chiusura = bar_ora_chiusura;
    if (cucina_ora_apertura !== undefined) updateData.cucina_ora_apertura = cucina_ora_apertura;
    if (cucina_ora_chiusura !== undefined) updateData.cucina_ora_chiusura = cucina_ora_chiusura;

    // Campi modificabili solo se super admin
    if (superAdmin) {
      if (tipo_contratto !== undefined) updateData.tipo_contratto = tipo_contratto;
      if (quota_commissione_percentuale !== undefined) updateData.quota_commissione_percentuale = quota_commissione_percentuale;
      if (canone_mensile_fisso !== undefined) updateData.canone_mensile_fisso = canone_mensile_fisso;
      if (canone_stagionale_fisso !== undefined) updateData.canone_stagionale_fisso = canone_stagionale_fisso;
      if (attivo !== undefined) updateData.attivo = attivo;
    }

    const { data: lido, error: updateError } = await supabase
      .from('lidi')
      .update(updateData)
      .eq('id', targetLidoId)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ lido, message: 'Struttura aggiornata con successo!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Elimina definitivamente un lido (Solo Super Admin)
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    // Verifica autenticazione
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    // Controlla se è un super admin
    const { data: superAdmin } = await supabase
      .from('super_admins')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!superAdmin) {
      return NextResponse.json({ error: 'Operazione consentita solo ai Super Admin' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const lidoId = searchParams.get('id');

    if (!lidoId) {
      return NextResponse.json({ error: 'ID lido obbligatorio' }, { status: 400 });
    }

    const { error: dbError } = await supabase
      .from('lidi')
      .delete()
      .eq('id', lidoId);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Lido eliminato con successo!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

