import { NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export async function POST(request: Request) {
  try {
    const { email, password, nome_lido, tipo_contratto } = await request.json();

    if (!email || !password || !nome_lido) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // 1. Crea l'utente nel database Auth tramite l'Admin client
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || 'Errore registrazione utente' }, { status: 400 });
    }

    const user = authData.user;

    // 2. Genera uno slug valido e univoco dal nome del lido
    const baseSlug = nome_lido
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slug = baseSlug || 'lido';
    
    let isUnique = false;
    let count = 0;
    while (!isUnique) {
      const { data: existingLido } = await supabase
        .from('lidi')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();

      if (!existingLido) {
        isUnique = true;
      } else {
        count++;
        slug = `${baseSlug}-${count}`;
      }
    }

    // 3. Crea il record del Lido
    const { data: lido, error: lidoError } = await supabase
      .from('lidi')
      .insert({
        nome_struttura: nome_lido,
        slug: slug,
        tipo_contratto: tipo_contratto || 'commissione_5',
        colore_primario: '#6366f1',
        attivo: true,
        accetta_contanti: true,
      })
      .select()
      .single();

    if (lidoError || !lido) {
      // rollback utente
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json({ error: lidoError?.message || 'Errore creazione lido' }, { status: 500 });
    }

    // 4. Associa il ruolo amministrativo
    const { error: gestoreError } = await supabase
      .from('lidi_gestori')
      .insert({
        user_id: user.id,
        lido_id: lido.id,
        ruolo: 'admin',
      });

    if (gestoreError) {
      // rollback lido e utente
      await supabase.from('lidi').delete().eq('id', lido.id);
      await supabase.auth.admin.deleteUser(user.id);
      return NextResponse.json({ error: gestoreError.message || 'Errore associazione gestore' }, { status: 500 });
    }

    return NextResponse.json({ success: true, user, lido });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Errore interno del server' }, { status: 500 });
  }
}
