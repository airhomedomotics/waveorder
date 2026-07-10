import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// POST: Registrazione nuovo cliente fidelity
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { lido_id, nome, cognome, telefono } = body;

    if (!lido_id || !nome?.trim() || !cognome?.trim() || !telefono?.trim()) {
      return NextResponse.json({ error: 'Tutti i campi sono obbligatori (nome, cognome, telefono).' }, { status: 400 });
    }

    // Normalizza il telefono (rimuovi spazi)
    const telefonoNorm = telefono.replace(/\s+/g, '').trim();

    // Verifica se esiste già un cliente con lo stesso telefono per questo lido
    const { data: existing } = await supabase
      .from('clienti_fidelity')
      .select('*')
      .eq('lido_id', lido_id)
      .eq('telefono', telefonoNorm)
      .single();

    if (existing) {
      // Il cliente esiste già — ritorna il profilo esistente (come un login)
      return NextResponse.json({ cliente: existing, isExisting: true });
    }

    // Crea il nuovo cliente
    const { data: cliente, error } = await supabase
      .from('clienti_fidelity')
      .insert({
        lido_id,
        nome: nome.trim(),
        cognome: cognome.trim(),
        telefono: telefonoNorm,
        punti_totali: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: `Errore registrazione: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ cliente, isExisting: false });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: Login / Recupera profilo cliente tramite telefono + lido_id
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const lido_id = searchParams.get('lido_id');
    const telefono = searchParams.get('telefono');

    if (!lido_id || !telefono) {
      return NextResponse.json({ error: 'lido_id e telefono sono obbligatori' }, { status: 400 });
    }

    const telefonoNorm = telefono.replace(/\s+/g, '').trim();

    const { data: cliente, error } = await supabase
      .from('clienti_fidelity')
      .select('*')
      .eq('lido_id', lido_id)
      .eq('telefono', telefonoNorm)
      .single();

    if (error || !cliente) {
      return NextResponse.json({ error: 'Nessun account trovato con questo numero di telefono.' }, { status: 404 });
    }

    return NextResponse.json({ cliente });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT: Aggiorna punti dopo un ordine
export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const { cliente_id, punti_da_aggiungere, punti_da_sottrarre } = body;

    if (!cliente_id) {
      return NextResponse.json({ error: 'cliente_id è obbligatorio' }, { status: 400 });
    }

    // Recupera punti attuali
    const { data: cliente, error: fetchError } = await supabase
      .from('clienti_fidelity')
      .select('punti_totali')
      .eq('id', cliente_id)
      .single();

    if (fetchError || !cliente) {
      return NextResponse.json({ error: 'Cliente non trovato' }, { status: 404 });
    }

    let nuoviPunti = cliente.punti_totali || 0;

    if (punti_da_aggiungere && punti_da_aggiungere > 0) {
      nuoviPunti += punti_da_aggiungere;
    }

    if (punti_da_sottrarre && punti_da_sottrarre > 0) {
      nuoviPunti = Math.max(0, nuoviPunti - punti_da_sottrarre);
    }

    const { data: updated, error: updateError } = await supabase
      .from('clienti_fidelity')
      .update({ punti_totali: nuoviPunti })
      .eq('id', cliente_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: `Errore aggiornamento punti: ${updateError.message}` }, { status: 500 });
    }

    return NextResponse.json({ cliente: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
