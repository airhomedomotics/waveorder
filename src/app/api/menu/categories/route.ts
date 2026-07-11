import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getGestore } from '@/utils/supabase/auth';

// GET: Recupera tutte le categorie di un lido (se pubblico, serve lido_id)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lidoId = searchParams.get('lido_id');

    if (lidoId) {
      // Richiesta pubblica per clienti ombrellone
      const { data: categories, error } = await supabase
        .from('categorie_menu')
        .select('*')
        .eq('lido_id', lidoId)
        .eq('attiva', true)
        .order('ordine_visualizzazione', { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ categories });
    }

    // Richiesta amministrativa gestore
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const gestoreData = await getGestore(supabase, user);

    if (!gestoreData) {
      return NextResponse.json({ error: 'Lido non trovato' }, { status: 404 });
    }

    const { data: categories, error: dbError } = await supabase
      .from('categorie_menu')
      .select('*')
      .eq('lido_id', gestoreData.lido_id)
      .order('ordine_visualizzazione', { ascending: true });

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
    return NextResponse.json({ categories });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Crea una nuova categoria
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const gestoreData = await getGestore(supabase, user);

    if (!gestoreData) {
      return NextResponse.json({ error: 'Lido non trovato' }, { status: 404 });
    }

    const body = await request.json();
    const { nome, ordine_visualizzazione, attiva } = body;

    if (!nome) {
      return NextResponse.json({ error: 'Il nome della categoria è obbligatorio' }, { status: 400 });
    }

    const { data: category, error: dbError } = await supabase
      .from('categorie_menu')
      .insert({
        lido_id: gestoreData.lido_id,
        nome,
        ordine_visualizzazione: ordine_visualizzazione || 0,
        attiva: attiva !== undefined ? attiva : true
      })
      .select()
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
    return NextResponse.json({ category, message: 'Categoria creata!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Modifica una categoria esistente
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const gestoreData = await getGestore(supabase, user);

    if (!gestoreData) {
      return NextResponse.json({ error: 'Lido non trovato' }, { status: 404 });
    }

    const body = await request.json();
    const { id, nome, ordine_visualizzazione, attiva } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID categoria obbligatorio' }, { status: 400 });
    }

    const updateData: any = {};
    if (nome !== undefined) updateData.nome = nome;
    if (ordine_visualizzazione !== undefined) updateData.ordine_visualizzazione = ordine_visualizzazione;
    if (attiva !== undefined) updateData.attiva = attiva;

    const { data: category, error: dbError } = await supabase
      .from('categorie_menu')
      .update(updateData)
      .eq('id', id)
      .eq('lido_id', gestoreData.lido_id) // Garantisce che il gestore modifichi solo le proprie categorie
      .select()
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
    return NextResponse.json({ category, message: 'Categoria modificata!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Elimina una categoria
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const gestoreData = await getGestore(supabase, user);

    if (!gestoreData) {
      return NextResponse.json({ error: 'Lido non trovato' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID categoria obbligatorio' }, { status: 400 });
    }

    const { error: dbError } = await supabase
      .from('categorie_menu')
      .delete()
      .eq('id', id)
      .eq('lido_id', gestoreData.lido_id);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
    return NextResponse.json({ message: 'Categoria eliminata con successo!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
