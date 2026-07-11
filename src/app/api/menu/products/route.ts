import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getGestore } from '@/utils/supabase/auth';

// GET: Recupera tutti i prodotti di un lido (se pubblico, serve lido_id)
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lidoId = searchParams.get('lido_id');
    const categoriaId = searchParams.get('categoria_id');

    if (lidoId) {
      // Richiesta pubblica per clienti ombrellone
      let query = supabase
        .from('prodotti')
        .select('*')
        .eq('lido_id', lidoId)
        .eq('disponibile', true);

      if (categoriaId) {
        query = query.eq('categoria_id', categoriaId);
      }

      const { data: products, error } = await query;

      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ products });
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

    let query = supabase
      .from('prodotti')
      .select('*, categorie_menu(nome)')
      .eq('lido_id', gestoreData.lido_id);

    if (categoriaId) {
      query = query.eq('categoria_id', categoriaId);
    }

    const { data: products, error: dbError } = await query;

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
    return NextResponse.json({ products });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Crea un nuovo prodotto
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
    const { categoria_id, nome, descrizione, prezzo, immagine_url, disponibile, reparto } = body;

    if (!categoria_id || !nome || prezzo === undefined) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti: categoria_id, nome, prezzo' }, { status: 400 });
    }

    const { data: product, error: dbError } = await supabase
      .from('prodotti')
      .insert({
        lido_id: gestoreData.lido_id,
        categoria_id,
        nome,
        descrizione,
        prezzo,
        immagine_url,
        disponibile: disponibile !== undefined ? disponibile : true,
        reparto: reparto || 'bar'
      })
      .select()
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
    return NextResponse.json({ product, message: 'Prodotto creato!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Modifica un prodotto esistente
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
    const { id, categoria_id, nome, descrizione, prezzo, immagine_url, disponibile, reparto } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID prodotto obbligatorio' }, { status: 400 });
    }

    const updateData: any = {};
    if (categoria_id !== undefined) updateData.categoria_id = categoria_id;
    if (nome !== undefined) updateData.nome = nome;
    if (descrizione !== undefined) updateData.descrizione = descrizione;
    if (prezzo !== undefined) updateData.prezzo = prezzo;
    if (immagine_url !== undefined) updateData.immagine_url = immagine_url;
    if (disponibile !== undefined) updateData.disponibile = disponibile;
    if (reparto !== undefined) updateData.reparto = reparto;

    const { data: product, error: dbError } = await supabase
      .from('prodotti')
      .update(updateData)
      .eq('id', id)
      .eq('lido_id', gestoreData.lido_id) // Impedisce di modificare prodotti altrui
      .select()
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
    return NextResponse.json({ product, message: 'Prodotto aggiornato!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Elimina un prodotto
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
      return NextResponse.json({ error: 'ID prodotto obbligatorio' }, { status: 400 });
    }

    const { error: dbError } = await supabase
      .from('prodotti')
      .delete()
      .eq('id', id)
      .eq('lido_id', gestoreData.lido_id);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 });
    return NextResponse.json({ message: 'Prodotto eliminato con successo!' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
