'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle2, Clock, Play, Check, AlertTriangle, ChevronRight, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Lido {
  nome_struttura: string;
  slug: string;
  colore_primario: string;
  fidelity_attivo: boolean;
  fidelity_soglia_punti: number;
  fidelity_valore_sconto: number | string;
}

interface OrderDetail {
  id: string;
  quantita: number;
  prezzo_unitario: number | string;
  note: string;
  prodotti: {
    nome: string;
  } | null;
}

interface Order {
  id: string;
  totale: number | string;
  stato: 'inviato' | 'in_preparazione' | 'consegnato' | 'annullato';
  metodo_pagamento: 'carta_stripe' | 'contanti';
  stato_pagamento: 'in_attesa' | 'pagato' | 'fallito' | 'rimborsato';
  numero_ombrellone_manuale: string | null;
  ombrelloni: {
    codice_identificativo: string;
  } | null;
  dettagli_ordine: OrderDetail[];
}

interface SuccessClientProps {
  lido: Lido;
  initialOrder: Order;
}

export default function SuccessClient({ lido, initialOrder }: SuccessClientProps) {
  const [order, setOrder] = useState<Order>(initialOrder);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [newTotalPoints, setNewTotalPoints] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const earned = Math.floor(Number(order.totale));
      setPointsEarned(earned);

      const pointsKey = `waveorder_points_${lido.slug}`;
      const hasAddedKey = `points_added_${order.id}`;

      const hasAdded = localStorage.getItem(hasAddedKey);
      const savedPoints = localStorage.getItem(pointsKey);
      let currentPoints = 0;
      if (savedPoints) {
        currentPoints = parseInt(savedPoints, 10);
      }

      // Se l'ordine conteneva lo sconto punti, dobbiamo sottrarre la soglia punti spesa!
      const isDiscounted = order.numero_ombrellone_manuale?.includes('[SCONTO PUNTI]');
      const threshold = lido.fidelity_soglia_punti || 100;

      if (!hasAdded) {
        let updatedPoints = currentPoints + earned;
        if (isDiscounted) {
          // Sottrai punti spesi per lo sconto
          updatedPoints = Math.max(0, updatedPoints - threshold);
        }
        localStorage.setItem(pointsKey, String(updatedPoints));
        localStorage.setItem(hasAddedKey, 'true');
        setNewTotalPoints(updatedPoints);
      } else {
        setNewTotalPoints(currentPoints);
      }
    }
  }, [order.id, order.totale, order.numero_ombrellone_manuale, lido.slug]);

  useEffect(() => {
    // Sottoscrizione realtime ai cambiamenti di stato dell'ordine corrente
    const channel = supabase
      .channel(`order-status-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ordini',
          filter: `id=eq.${order.id}`,
        },
        (payload) => {
          const updatedOrder = payload.new as any;
          setOrder((prev) => ({
            ...prev,
            stato: updatedOrder.stato,
            stato_pagamento: updatedOrder.stato_pagamento,
          }));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order.id, supabase]);

  const statusMeta = {
    inviato: {
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      icon: Clock,
      label: 'Ordine Inviato',
      desc: 'Il bar ha ricevuto il tuo ordine ed è in attesa di prenderlo in carico.',
    },
    in_preparazione: {
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
      icon: Play,
      label: 'In Preparazione',
      desc: 'Il tuo ordine è in preparazione al bar. A breve verrà consegnato!',
    },
    consegnato: {
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      icon: Check,
      label: 'Consegnato',
      desc: 'Il tuo ordine è stato consegnato all\'ombrellone. Buon appetito!',
    },
    annullato: {
      color: 'text-red-400 bg-red-500/10 border-red-500/20',
      icon: AlertTriangle,
      label: 'Ordine Annullato',
      desc: 'Il tuo ordine è stato annullato dal gestore. Se hai già ricevuto la merce o riscontri un errore, contatta subito l\'assistenza.',
    },
  };

  const currentStatus = statusMeta[order.stato] || statusMeta.inviato;
  const StatusIcon = currentStatus.icon;

  const getStepClass = (stepIndex: number) => {
    const states = ['inviato', 'in_preparazione', 'consegnato'];
    const currentIdx = states.indexOf(order.stato);
    if (order.stato === 'annullato') return 'bg-red-500/40 text-red-500';
    if (currentIdx >= stepIndex) return 'bg-indigo-500 text-white';
    return 'bg-slate-800 text-slate-500';
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center justify-center p-6 pb-12" style={{
      ['--lido-primary' as any]: lido.colore_primario,
    }}>
      <div className="w-full max-w-md bg-slate-800/30 backdrop-blur-md border border-slate-800 rounded-3xl p-6.5 shadow-2xl relative overflow-hidden">
        {/* CHECKMARK ANIMATION */}
        {order.stato !== 'annullato' ? (
          <div className="flex flex-col items-center text-center mt-2">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400 animate-bounce">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="font-extrabold text-2xl tracking-tight text-slate-100">Grazie per l'ordine!</h1>
            <p className="text-xs text-slate-400 mt-1">L'ordine è stato registrato ed è in elaborazione</p>
          </div>
        ) : (
          <div className="flex flex-col items-center text-center mt-2">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
              <AlertTriangle className="w-10 h-10" />
            </div>
            <h1 className="font-extrabold text-2xl tracking-tight text-red-400">Ordine Annullato</h1>
            <p className="text-xs text-slate-400 mt-1">Aggiornamento in tempo reale</p>
          </div>
        )}

        {/* STATUS BANNER */}
        <div className={`mt-6 p-4.5 rounded-2xl border ${currentStatus.color} flex gap-3.5`}>
          <div className="p-2 rounded-xl bg-white/5 h-fit mt-0.5">
            <StatusIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm tracking-wide uppercase">{currentStatus.label}</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">{currentStatus.desc}</p>
          </div>
        </div>

        {/* WIDGET FIDELITY RACCOLTA PUNTI (WaveCard) */}
        {lido.fidelity_attivo && pointsEarned > 0 && order.stato !== 'annullato' && (
          <div className="mt-6 p-4 bg-gradient-to-br from-indigo-950/25 to-slate-900/40 border border-indigo-500/25 rounded-3xl text-center">
            <span className="block text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1.5">WaveCard Programma Fedeltà</span>
            <span className="block text-xs text-slate-300">Con questo ordine hai guadagnato: <strong className="text-white">+{pointsEarned} Punti</strong></span>
            <div className="flex items-baseline justify-center gap-1.5 mt-3">
              <span className="text-3xl font-black text-indigo-400">{newTotalPoints}</span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Punti Totali Accumulati</span>
            </div>
            <p className="text-[9px] text-slate-500 mt-2 font-medium">Ogni {lido.fidelity_soglia_punti || 100} Punti ricevi {Number(lido.fidelity_valore_sconto || 5).toFixed(2)}€ di Sconto sui prossimi ordini!</p>
          </div>
        )}

        {/* PROGRESS STEPPER (Nessuna visualizzazione se annullato) */}
        {order.stato !== 'annullato' && (
          <div className="mt-7 flex items-center justify-between px-2">
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${getStepClass(0)}`}>
                1
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Inviato</span>
            </div>
            <div className="w-8 border-t border-slate-800 -mt-4"></div>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${getStepClass(1)}`}>
                2
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">In Preparazione</span>
            </div>
            <div className="w-8 border-t border-slate-800 -mt-4"></div>
            <div className="flex flex-col items-center gap-1.5 flex-1">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${getStepClass(2)}`}>
                3
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Consegnato</span>
            </div>
          </div>
        )}

        {/* RIEPILOGO ORDINE */}
        <div className="mt-8 border-t border-slate-800 pt-6">
          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-4.5">Riepilogo Dettagli</h4>
          
          <div className="space-y-3.5 mb-5 max-h-[22vh] overflow-y-auto pr-1">
            {order.dettagli_ordine.map((detail) => (
              <div key={detail.id} className="flex justify-between items-start text-sm">
                <div className="flex-1 pr-4">
                  <p className="font-semibold text-slate-200">
                    {detail.prodotti?.nome || 'Articolo sconosciuto'} 
                    <span className="text-slate-500 font-medium ml-1.5">x{detail.quantita}</span>
                  </p>
                  {detail.note && <p className="text-xs text-indigo-400 italic mt-0.5">Note: "{detail.note}"</p>}
                </div>
                <span className="font-bold text-slate-300">
                  €{(Number(detail.prezzo_unitario) * detail.quantita).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-4 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Metodo di Pagamento:</span>
              <span className="font-semibold text-slate-200 capitalize">
                {order.metodo_pagamento === 'carta_stripe' ? 'Carta di Credito / Apple Pay' : 'Contanti alla consegna'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Stato Pagamento:</span>
              <span className={`font-semibold ${order.stato_pagamento === 'pagato' ? 'text-emerald-400' : 'text-amber-400'}`}>
                {order.stato_pagamento === 'pagato' ? 'Pagato' : 'Da pagare'}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Consegna presso:</span>
              <span className="font-semibold text-slate-200">
                {order.ombrelloni?.codice_identificativo || order.numero_ombrellone_manuale || 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex justify-between items-center mt-5 pt-4.5 border-t border-slate-800">
            <span className="font-bold text-sm text-slate-300">Totale</span>
            <span className="font-black text-xl text-indigo-400">€{Number(order.totale).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-6.5 text-center">
        <Link
          href={`/menu/${lido.slug}`}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna al Menu
        </Link>
      </div>
    </div>
  );
}
