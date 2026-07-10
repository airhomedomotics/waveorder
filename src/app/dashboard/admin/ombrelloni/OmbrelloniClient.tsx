'use client';

import React, { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Plus, ArrowLeft, QrCode, Printer, Trash2, HelpCircle } from 'lucide-react';
import Link from 'next/link';

interface Ombrellone {
  id: string;
  codice_identificativo: string;
  qr_token: string;
}

interface OmbrelloniClientProps {
  lidoId: string;
  lidoSlug: string;
  initialOmbrelloni: Ombrellone[];
}

export default function OmbrelloniClient({ lidoId, lidoSlug, initialOmbrelloni }: OmbrelloniClientProps) {
  const [ombrelloni, setOmbrelloni] = useState<Ombrellone[]>(initialOmbrelloni);
  const [filaPrefix, setFilaPrefix] = useState('Fila A');
  const [numeroInizio, setNumeroInizio] = useState(1);
  const [numeroFine, setNumeroFine] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabase = createClient();

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numeroInizio > numeroFine) {
      setErrorMsg("Il numero di inizio non può essere maggiore di quello di fine.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const items = [];
    for (let i = numeroInizio; i <= numeroFine; i++) {
      const code = `${filaPrefix.trim()} - Num ${i}`;
      // Genera un token casuale per il QR
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      items.push({
        lido_id: lidoId,
        codice_identificativo: code,
        qr_token: token,
      });
    }

    try {
      const { data, error } = await supabase
        .from('ombrelloni')
        .insert(items)
        .select();

      if (error) {
        if (error.code === '23505' || error.message.includes('unique constraint') || error.message.includes('duplicate key')) {
          setErrorMsg("Alcuni ombrelloni in questo intervallo sono già presenti per questa Fila/Zona. Prova ad inserire una Fila diversa, a iniziare da un numero successivo (es. da 6) oppure elimina prima quelli esistenti!");
        } else {
          setErrorMsg(error.message);
        }
      } else if (data) {
        setOmbrelloni((prev) => [...prev, ...data]);
      }
    } catch (err) {
      setErrorMsg("Errore di rete durante la generazione in batch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo ombrellone? Il QR code associato cesserà di funzionare.")) return;
    try {
      const { error } = await supabase
        .from('ombrelloni')
        .delete()
        .eq('id', id);

      if (error) {
        alert(error.message);
      } else {
        setOmbrelloni((prev) => prev.filter((o) => o.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const getQRUrl = (token: string) => {
    const appUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return `${appUrl}/menu/${lidoSlug}?token=${token}`;
  };

  const triggerPrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 pb-12 print:bg-white print:text-black print:p-0">
      {/* HEADER (Nascosto in stampa) */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-900 mb-8 max-w-7xl mx-auto print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/admin"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Gestione Spiaggia & QR</h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
              Genera codici identificativi per i tuoi ombrelloni o tavoli
            </p>
          </div>
        </div>

        <button
          onClick={triggerPrint}
          className="bg-indigo-650 hover:bg-indigo-600 text-white font-bold px-5 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg transition-colors"
        >
          <Printer className="w-4 h-4" />
          Stampa QR Spiaggia
        </button>
      </header>

      {/* CONTENITORE PRINCIPALE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {/* PANNELLO GENERAZIONE (Nascosto in stampa) */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5 h-fit print:hidden">
          <h2 className="font-extrabold text-lg text-slate-100 pb-4 border-b border-slate-900 mb-6">Generazione in Batch</h2>

          {errorMsg && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl mb-4">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleCreateBatch} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Prefisso Fila / Zona</label>
              <input
                type="text"
                required
                placeholder="Es. Fila A, Terrazza"
                value={filaPrefix}
                onChange={(e) => setFilaPrefix(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Da Numero</label>
                <input
                  type="number"
                  required
                  value={numeroInizio}
                  onChange={(e) => setNumeroInizio(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">A Numero</label>
                <input
                  type="number"
                  required
                  value={numeroFine}
                  onChange={(e) => setNumeroFine(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-colors mt-4"
            >
              {isSubmitting ? (
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                "Genera QR"
              )}
            </button>
          </form>
        </div>

        {/* GRIGLIA QR CODE (LAYOUT DI STAMPA OTTIMIZZATO) */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="font-extrabold text-lg text-slate-100 print:hidden">Elenco QR Code</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-3 print:gap-4">
            {ombrelloni.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 font-semibold bg-slate-900/20 border border-slate-900 rounded-3xl print:hidden">
                Nessun ombrellone configurato in spiaggia. Generali usando il form laterale!
              </div>
            ) : (
              ombrelloni.map((omb) => {
                const targetUrl = getQRUrl(omb.qr_token);
                const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(targetUrl)}`;
                return (
                  <div
                    key={omb.id}
                    className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 flex flex-col items-center justify-between gap-4 text-center transition-all hover:border-slate-800 print:bg-white print:border print:border-black print:rounded-none print:p-6 print:shadow-none print:break-inside-avoid"
                  >
                    {/* Visualizzazione in stampa */}
                    <div className="hidden print:block text-center mb-2">
                      <h4 className="font-black text-lg text-black uppercase tracking-tight">WaveOrder</h4>
                      <p className="text-[10px] text-slate-600 font-bold uppercase tracking-wider">Scansiona per Ordinare</p>
                    </div>

                    <img
                      src={qrImageSrc}
                      alt={`QR Code ${omb.codice_identificativo}`}
                      className="w-40 h-40 object-contain rounded-2xl border border-slate-800 bg-white p-2.5 print:border-black print:rounded-none"
                    />

                    <div>
                      <h3 className="font-extrabold text-base text-slate-200 print:text-black">{omb.codice_identificativo}</h3>
                      <span className="text-[10px] text-slate-500 font-mono mt-1 block truncate max-w-[200px] print:text-slate-600">
                        {targetUrl}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDelete(omb.id)}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-red-400 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-500/5 transition-all print:hidden"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Elimina
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* STILI CSS STAMPA DEDICATI */}
      <style jsx global>{`
        @media print {
          body, html {
            background-color: white !important;
            color: black !important;
          }
          /* Nascondi sfondi ed elementi scuri */
          div {
            background-color: white !important;
            border-color: #000 !important;
          }
          /* Ottimizzazioni per layout etichette */
          .print\\:break-inside-avoid {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}
