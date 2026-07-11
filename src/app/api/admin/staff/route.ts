import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

// GET: Recupera tutti i membri dello staff del lido
export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verifica autenticazione e ruolo
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { data: gestoreData, error: gestoreError } = await supabase
      .from('lidi_gestori')
      .select('lido_id, ruolo')
      .eq('user_id', user.id)
      .single();

    if (gestoreError || !gestoreData || gestoreData.ruolo !== 'admin') {
      return NextResponse.json({ error: 'Operazione riservata all\'amministratore del lido' }, { status: 403 });
    }

    // 2. Recupera la lista dello staff
    const { data: staff, error: staffError } = await supabase
      .from('lidi_gestori')
      .select('*')
      .eq('lido_id', gestoreData.lido_id)
      .order('creato_il', { ascending: true });

    if (staffError) {
      return NextResponse.json({ error: staffError.message }, { status: 400 });
    }

    return NextResponse.json({ staff });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Crea un nuovo account staff (Autenticato ed associato al lido)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verifica autenticazione e ruolo
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { data: gestoreData, error: gestoreError } = await supabase
      .from('lidi_gestori')
      .select('lido_id, ruolo')
      .eq('user_id', user.id)
      .single();

    if (gestoreError || !gestoreData || gestoreData.ruolo !== 'admin') {
      return NextResponse.json({ error: 'Operazione riservata all\'amministratore del lido' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, nome, ruolo } = body;

    if (!email || !password || !nome || !ruolo) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti: email, password, nome, ruolo' }, { status: 400 });
    }

    if (!['admin', 'staff', 'cucina', 'bar'].includes(ruolo)) {
      return NextResponse.json({ error: 'Ruolo non valido' }, { status: 400 });
    }

    // 2. Crea l'utente auth usando il client admin
    const adminClient = createAdminClient();
    const { data: authUser, error: createUserError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome }
    });

    if (createUserError || !authUser.user) {
      return NextResponse.json({ error: createUserError?.message || 'Errore nella creazione dell\'account staff' }, { status: 400 });
    }

    // 3. Mappa l'utente su lidi_gestori
    const { data: newStaff, error: insertError } = await supabase
      .from('lidi_gestori')
      .insert({
        lido_id: gestoreData.lido_id,
        user_id: authUser.user.id,
        ruolo,
        nome,
        email
      })
      .select()
      .single();

    if (insertError) {
      // In caso di errore nel mapping, rimuovi l'utente per consistenza
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({ staff: newStaff, message: 'Account staff creato con successo!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Elimina un account staff dal lido ed elimina il suo utente auth
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    // 1. Verifica autenticazione e ruolo
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const { data: gestoreData, error: gestoreError } = await supabase
      .from('lidi_gestori')
      .select('lido_id, ruolo')
      .eq('user_id', user.id)
      .single();

    if (gestoreError || !gestoreData || gestoreData.ruolo !== 'admin') {
      return NextResponse.json({ error: 'Operazione riservata all\'amministratore del lido' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('id'); // ID record in lidi_gestori

    if (!staffId) {
      return NextResponse.json({ error: 'ID staff obbligatorio' }, { status: 400 });
    }

    // 2. Recupera l'utente corrispondente
    const { data: staffMember, error: fetchError } = await supabase
      .from('lidi_gestori')
      .select('user_id')
      .eq('id', staffId)
      .eq('lido_id', gestoreData.lido_id)
      .single();

    if (fetchError || !staffMember) {
      return NextResponse.json({ error: 'Membro dello staff non trovato' }, { status: 404 });
    }

    if (staffMember.user_id === user.id) {
      return NextResponse.json({ error: 'Non puoi eliminare il tuo stesso account amministratore' }, { status: 400 });
    }

    // 3. Elimina l'utente auth e poi il record gestori
    const adminClient = createAdminClient();
    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(staffMember.user_id);
    
    if (deleteUserError) {
      // Se l'utente auth non esiste più o dà errore, procedi comunque a eliminare il mapping
      console.warn("Auth delete warning:", deleteUserError.message);
    }

    const { error: deleteError } = await supabase
      .from('lidi_gestori')
      .delete()
      .eq('id', staffId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'Membro dello staff eliminato con successo!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
