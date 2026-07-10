'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Play, Check, X, AlertTriangle, ShieldAlert, ShoppingCart, DollarSign, CreditCard } from 'lucide-react';

interface Lido {
  id: string;
  nome_struttura: string;
  tipo_contratto: string;
  accetta_contanti: boolean;
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
  creato_il: string;
}

interface DashboardClientProps {
  lido: Lido;
  initialOrders: Order[];
}

export default function DashboardClient({ lido, initialOrders }: DashboardClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeWarnOrder, setActiveWarnOrder] = useState<Order | null>(null);
  const [isLidoCashActive, setIsLidoCashActive] = useState(lido.accetta_contanti);
  const supabase = createClient();

  // Riproduce un suono acustico sintetizzato (Web Audio API)
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = audioCtx.createOscillator();
      const osc2 = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(audioCtx.destination);

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
      osc1.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.12); // E5

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.24); // G5

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);

      osc1.start(audioCtx.currentTime);
      osc1.stop(audioCtx.currentTime + 0.5);
      osc2.start(audioCtx.currentTime + 0.24);
      osc2.stop(audioCtx.currentTime + 0.5);
    } catch (e) {
      console.warn('Browser blocks audio until user interaction:', e);
    }
  };

  const fetchOrderDetails = async (id: string) => {
    const { data } = await supabase
      .from('ordini')
      .select(`
        *,
        ombrelloni (codice_identificativo),
        dettagli_ordine (
          id, quantita, prezzo_unitario, note,
          prodotti (nome)
        )
      `)
      .eq('id', id)
      .single();
    return data as Order;
  };

  useEffect(() => {
    // 1. Sottoscrizione realtime ai cambiamenti di ordini per questo lido
    const channel = supabase
      .channel(`lido-orders-${lido.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ordini',
          filter: `lido_id=eq.${lido.id}`,
        },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = await fetchOrderDetails(payload.new.id);
            if (newOrder) {
              setOrders((prev) => [newOrder, ...prev]);
              playNotificationSound();
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as any;
            
            // Se lo stato di accetta_contanti del lido cambia (es. disabilitato da trigger anti-frode)
            if (updated.id === lido.id) {
              // Questo payload si riferisce alla tabella lidi se ascoltassimo i lidi, 
              // ma siccome ascoltiamo ordini, controlliamo se l'opzione contanti del lido è cambiata
            }

            // Aggiorna l'ordine locale
            const fullOrder = await fetchOrderDetails(updated.id);
            if (fullOrder) {
              setOrders((prev) => prev.map((o) => (o.id === fullOrder.id ? fullOrder : o)));
            }
          }
        }
      )
      .subscribe();

    // 2. Controllo periodico dello stato contanti del lido (per mostrare banner di blocco)
    const checkLidoStatus = setInterval(async () => {
      const { data } = await supabase
        .from('lidi')
        .select('accetta_contanti')
        .eq('id', lido.id)
        .single();
      if (data) {
        setIsLidoCashActive(data.accetta_contanti);
      }
    }, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(checkLidoStatus);
    };
  }, [lido.id, supabase]);

  const updateOrderStatus = async (orderId: string, nextStato: 'in_preparazione' | 'consegnato' | 'annullato') => {
    try {
      const res = await fetch('/api/orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: orderId, stato: nextStato }),
      });
      const data = await res.json();
      if (data.order) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, stato: nextStato } : o)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCancelClick = (order: Order) => {
    // Se l'ordine è in contanti ed è già in preparazione, mostra avviso anti-frode
    if (order.metodo_pagamento === 'contanti' && order.stato === 'in_preparazione') {
      setActiveWarnOrder(order);
    } else {
      updateOrderStatus(order.id, 'annullato');
    }
  };

  // Separa gli ordini in colonne
  const columns = {
    inviati: orders.filter((o) => o.stato === 'inviato'),
    in_preparazione: orders.filter((o) => o.stato === 'in_preparazione'),
    completati: orders.filter((o) => o.stato === 'consegnato' || o.stato === 'annullato').slice(0, 15), // Mostra solo i 15 più recenti
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 pb-12">
      {/* HEADER DELLA DASHBOARD */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-900 mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">{lido.nome_struttura}</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
            Pannello Gestione Ordini & Comande • Contratto: {lido.tipo_contratto.replace('_', ' ')}
          </p>
        </div>

        {/* STATUS BANNER ANTI-FRODE CONTANTI */}
        <div className="flex items-center gap-3">
          {isLidoCashActive ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-2 rounded-xl flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="font-semibold">Pagamento Contanti Attivo</span>
            </div>
          ) : (
            <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs px-4 py-2 rounded-xl flex items-center gap-2 animate-pulse">
              <ShieldAlert className="w-4 h-4" />
              <span className="font-bold">Contanti Disabilitati per Tasso Cancellazione Elevato (&gt;10%)</span>
            </div>
          )}
        </div>
      </header>

      {/* GRIGLIA KANBAN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* COLONNA: IN ARRIVO */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 flex flex-col h-[75vh]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-900 mb-4">
            <h2 className="font-extrabold text-base tracking-wide uppercase text-amber-500 flex items-center gap-2">
              <span>In Arrivo</span>
              <span className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-0.5 rounded-full font-black">
                {columns.inviati.length}
              </span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {columns.inviati.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 py-12 text-sm">
                <ShoppingCart className="w-8 h-8 mb-2 opacity-30" />
                Nessun nuovo ordine
              </div>
            ) : (
              columns.inviati.map((order) => (
                <OrderCard key={order.id} order={order} onStart={() => updateOrderStatus(order.id, 'in_preparazione')} onCancel={() => handleCancelClick(order)} />
              ))
            )}
          </div>
        </div>

        {/* COLONNA: IN PREPARAZIONE */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 flex flex-col h-[75vh]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-900 mb-4">
            <h2 className="font-extrabold text-base tracking-wide uppercase text-sky-400 flex items-center gap-2">
              <span>In Preparazione</span>
              <span className="bg-sky-400/10 text-sky-300 text-xs px-2.5 py-0.5 rounded-full font-black">
                {columns.in_preparazione.length}
              </span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {columns.in_preparazione.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 py-12 text-sm">
                <Play className="w-8 h-8 mb-2 opacity-30" />
                Nessuna comanda in preparazione
              </div>
            ) : (
              columns.in_preparazione.map((order) => (
                <OrderCard key={order.id} order={order} onComplete={() => updateOrderStatus(order.id, 'consegnato')} onCancel={() => handleCancelClick(order)} />
              ))
            )}
          </div>
        </div>

        {/* COLONNA: RECENTI COMPLETATI / ANNULLATI */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 flex flex-col h-[75vh]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-900 mb-4">
            <h2 className="font-extrabold text-base tracking-wide uppercase text-slate-400 flex items-center gap-2">
              <span>Finiti Recenti</span>
              <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-0.5 rounded-full font-black">
                {columns.completati.length}
              </span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {columns.completati.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 py-12 text-sm">
                <Check className="w-8 h-8 mb-2 opacity-30" />
                Nessun ordine storico recente
              </div>
            ) : (
              columns.completati.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL DI WARNING ANTI-FRODE */}
      {activeWarnOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 border-b border-slate-850 pb-4 mb-4">
              <ShieldAlert className="w-8 h-8" />
              <div>
                <h3 className="font-black text-lg">Controllo Anti-Evasione</h3>
                <p className="text-xs text-slate-400 mt-0.5">Avviso Annullamento Tardivo</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-5">
              Stai provando ad annullare l'ordine per l'<strong>Ombrellone {activeWarnOrder.ombrelloni?.codice_identificativo || activeWarnOrder.numero_ombrellone_manuale}</strong> ({activeWarnOrder.totale}€) con pagamento in <strong>Contanti</strong>, dopo che è già stato messo <strong>In Preparazione</strong>.
            </p>

            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2.5 text-xs mb-6 text-slate-400">
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p>Verrà inviata una notifica automatica al cliente per segnalare l'annullamento della comanda.</p>
              </div>
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p>La commissione rimarrà fiscalizzata nel saldo mensile dovuto alla piattaforma.</p>
              </div>
              <div className="flex gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p>Se il tasso di cancellazione contanti supera il 10%, la possibilità di accettare contanti verrà sospesa per questo lido.</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  updateOrderStatus(activeWarnOrder.id, 'annullato');
                  setActiveWarnOrder(null);
                }}
                className="flex-1 bg-red-650 hover:bg-red-650/80 border border-red-700/50 text-white font-bold py-3.5 rounded-xl text-sm transition-all duration-200 active:scale-95"
              >
                Annulla Ordine
              </button>
              <button
                onClick={() => setActiveWarnOrder(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3.5 rounded-xl text-sm transition-all duration-200"
              >
                Mantieni Attivo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// COMPONENTE SCHEDA ORDINE
interface OrderCardProps {
  order: Order;
  onStart?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
}

function OrderCard({ order, onStart, onComplete, onCancel }: OrderCardProps) {
  const formatTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`p-4 rounded-2xl border transition-all duration-200 ${
      order.stato === 'annullato'
        ? 'bg-red-950/10 border-red-950/40 opacity-60'
        : order.stato === 'consegnato'
        ? 'bg-slate-900/40 border-slate-900/60'
        : 'bg-slate-900 border-slate-800/80 hover:border-slate-700/60'
    }`}>
      {/* CARD HEADER */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/60 mb-3 text-xs text-slate-400">
        <span className="font-extrabold text-slate-200 text-sm">
          Ombrellone: {order.ombrelloni?.codice_identificativo || order.numero_ombrellone_manuale || 'N/A'}
        </span>
        <span>{formatTime(order.creato_il)}</span>
      </div>

      {/* CARD ITEMS */}
      <div className="space-y-2.5 mb-4">
        {order.dettagli_ordine.map((det) => (
          <div key={det.id} className="text-xs">
            <div className="flex justify-between items-start">
              <span className="font-bold text-slate-300 leading-snug">
                {det.prodotti?.nome || 'Prodotto'} <span className="text-slate-500 font-medium">x{det.quantita}</span>
              </span>
            </div>
            {det.note && <span className="block text-[10px] text-amber-500 italic mt-0.5">Nota: "{det.note}"</span>}
          </div>
        ))}
      </div>

      {/* METODO PAGAMENTO & TOTALE */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/40 mb-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          {order.metodo_pagamento === 'carta_stripe' ? (
            <>
              <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
              <span>Digitale</span>
            </>
          ) : (
            <>
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span>Contanti</span>
            </>
          )}
          <span className="text-[10px]">•</span>
          <span className={order.stato_pagamento === 'pagato' ? 'text-emerald-400' : 'text-amber-400'}>
            {order.stato_pagamento === 'pagato' ? 'Pagato' : 'In attesa'}
          </span>
        </div>
        <span className="font-extrabold text-sm text-indigo-400">€{Number(order.totale).toFixed(2)}</span>
      </div>

      {/* AZIONI */}
      {(onStart || onComplete || onCancel) && (
        <div className="flex gap-2">
          {onStart && (
            <button
              onClick={onStart}
              className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-650 hover:bg-indigo-650/80 text-white font-bold py-2 rounded-xl text-xs transition-all duration-200 active:scale-95"
            >
              <Play className="w-3 h-3" />
              Prepara
            </button>
          )}
          {onComplete && (
            <button
              onClick={onComplete}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-650 hover:bg-emerald-650/80 text-white font-bold py-2 rounded-xl text-xs transition-all duration-200 active:scale-95"
            >
              <Check className="w-3 h-3" />
              Consegna
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 flex items-center justify-center bg-slate-800 hover:bg-red-950/30 hover:border-red-900/50 hover:text-red-400 border border-slate-700 text-slate-400 py-2 rounded-xl text-xs transition-all duration-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
