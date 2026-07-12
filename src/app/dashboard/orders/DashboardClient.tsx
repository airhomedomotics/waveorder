'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Play, Check, X, AlertTriangle, ShieldAlert, ShoppingCart, DollarSign, CreditCard, Printer, ArrowLeft, Maximize, Minimize, Clock, Utensils, CheckCircle } from 'lucide-react';

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
    reparto?: string;
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
  userRole: string;
  repartoFilter?: string;
}

export default function DashboardClient({ lido, initialOrders, userRole, repartoFilter = 'all' }: DashboardClientProps) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [activeWarnOrder, setActiveWarnOrder] = useState<Order | null>(null);
  const [isLidoCashActive, setIsLidoCashActive] = useState(lido.accetta_contanti);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const supabase = createClient();

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn(`Errore avvio fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const playNotificationSound = () => {
    if (!isAudioEnabled) {
      console.warn('Audio non riprodotto: attendere interazione utente');
      return;
    }
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
          prodotti (nome, reparto)
        )
      `)
      .eq('id', id)
      .single();
    return data as Order;
  };

  useEffect(() => {
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
            const fullOrder = await fetchOrderDetails(updated.id);
            if (fullOrder) {
              setOrders((prev) => prev.map((o) => (o.id === fullOrder.id ? fullOrder : o)));
            }
          }
        }
      )
      .subscribe();

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
      if (res.ok && data.order) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, stato: nextStato } : o)));
      } else {
        alert(`Errore aggiornamento comanda: ${data.error || 'Risposta del server non valida'}`);
      }
    } catch (e: any) {
      alert(`Errore di rete KDS: ${e.message || e}`);
    }
  };

  const handleCancelClick = (order: Order) => {
    if (order.metodo_pagamento === 'contanti' && order.stato === 'in_preparazione') {
      setActiveWarnOrder(order);
    } else {
      updateOrderStatus(order.id, 'annullato');
    }
  };

  const handlePrintOrder = (order: Order) => {
    setPrintingOrder(order);
    setTimeout(() => {
      window.print();
      setPrintingOrder(null);
    }, 150);
  };

  const filteredOrders = React.useMemo(() => {
    if (repartoFilter === 'all') return orders;

    return orders.map((order) => {
      const details = order.dettagli_ordine || [];
      const filteredDetails = details.filter(
        (det) => det.prodotti && det.prodotti.reparto === repartoFilter
      );
      if (filteredDetails.length === 0) return null;
      return {
        ...order,
        dettagli_ordine: filteredDetails
      };
    }).filter(Boolean) as Order[];
  }, [orders, repartoFilter]);

  // Ordinamento: In Arrivo ed In Preparazione dal più vecchio al più nuovo (FIFO)
  // Completati dal più nuovo al più vecchio (LIFO)
  const columns = {
    inviati: filteredOrders.filter((o) => o.stato === 'inviato').sort((a, b) => new Date(a.creato_il).getTime() - new Date(b.creato_il).getTime()),
    in_preparazione: filteredOrders.filter((o) => o.stato === 'in_preparazione').sort((a, b) => new Date(a.creato_il).getTime() - new Date(b.creato_il).getTime()),
    completati: filteredOrders.filter((o) => o.stato === 'consegnato' || o.stato === 'annullato').sort((a, b) => new Date(b.creato_il).getTime() - new Date(a.creato_il).getTime()).slice(0, 15),
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-6 pb-12 print:bg-white print:text-black">
      {/* HEADER DELLA DASHBOARD */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 md:pb-6 border-b border-slate-800 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">{lido.nome_struttura}</span>
            <span className={`text-[10px] uppercase font-black px-2.5 py-1 rounded-md border shadow-sm ${
              repartoFilter === 'cucina' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
              repartoFilter === 'bar' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
              'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
            }`}>
              {repartoFilter === 'cucina' ? '🍳 Monitor Cucina' :
               repartoFilter === 'bar' ? '☕ Monitor Bar' :
               '💻 KDS Master'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
            Kitchen Display System • {new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Pulsante Abilita Suoni */}
          {!isAudioEnabled && (
            <button
              onClick={() => {
                // Tenta di creare un context temporaneo per sbloccare l'audio
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                audioCtx.resume().then(() => {
                  setIsAudioEnabled(true);
                });
              }}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 shadow-lg animate-bounce"
            >
              🔊 Clicca qui per abilitare i suoni
            </button>
          )}

          {/* Pulsante Schermo Intero */}
          <button
            onClick={toggleFullscreen}
            className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl transition-colors shadow-sm"
            title="Schermo Intero"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>

          {['admin', 'cucina', 'staff'].includes(userRole) && (
            <a
              href="/dashboard/admin"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-3 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Pannello Gestione</span>
            </a>
          )}

          {!isLidoCashActive && (
            <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-pulse">
              <ShieldAlert className="w-4 h-4" />
              <span className="font-bold hidden sm:inline">Contanti Disabilitati</span>
            </div>
          )}
        </div>
      </header>

      {/* GRIGLIA KANBAN PROFESSIONALE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:hidden">
        
        {/* COLONNA: IN ARRIVO */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl flex flex-col h-[80vh] overflow-hidden shadow-2xl">
          <div className="bg-amber-500/10 border-b border-amber-500/20 p-4 flex items-center justify-between">
            <h2 className="font-black text-lg tracking-wide uppercase text-amber-500 flex items-center gap-2">
              <Utensils className="w-5 h-5" />
              <span>In Arrivo</span>
            </h2>
            <span className="bg-amber-500 text-slate-950 text-sm px-3 py-1 rounded-full font-black shadow-sm">
              {columns.inviati.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {columns.inviati.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <ShoppingCart className="w-10 h-10 mb-3 opacity-30" />
                <span className="font-semibold text-sm">Nessun nuovo ordine</span>
              </div>
            ) : (
              columns.inviati.map((order) => (
                <OrderCard key={order.id} order={order} variant="new" onStart={() => updateOrderStatus(order.id, 'in_preparazione')} onCancel={() => handleCancelClick(order)} onPrint={handlePrintOrder} />
              ))
            )}
          </div>
        </div>

        {/* COLONNA: IN PREPARAZIONE */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl flex flex-col h-[80vh] overflow-hidden shadow-2xl">
          <div className="bg-sky-500/10 border-b border-sky-500/20 p-4 flex items-center justify-between">
            <h2 className="font-black text-lg tracking-wide uppercase text-sky-400 flex items-center gap-2">
              <Play className="w-5 h-5" />
              <span>In Preparazione</span>
            </h2>
            <span className="bg-sky-500 text-slate-950 text-sm px-3 py-1 rounded-full font-black shadow-sm">
              {columns.in_preparazione.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {columns.in_preparazione.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <Clock className="w-10 h-10 mb-3 opacity-30" />
                <span className="font-semibold text-sm">Nessuna comanda in corso</span>
              </div>
            ) : (
              columns.in_preparazione.map((order) => (
                <OrderCard key={order.id} order={order} variant="progress" onComplete={() => updateOrderStatus(order.id, 'consegnato')} onCancel={() => handleCancelClick(order)} onPrint={handlePrintOrder} />
              ))
            )}
          </div>
        </div>

        {/* COLONNA: COMPLETATI */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl flex flex-col h-[80vh] overflow-hidden shadow-2xl opacity-80">
          <div className="bg-slate-800/50 border-b border-slate-800 p-4 flex items-center justify-between">
            <h2 className="font-black text-lg tracking-wide uppercase text-slate-400 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              <span>Finiti Recenti</span>
            </h2>
            <span className="bg-slate-700 text-slate-300 text-sm px-3 py-1 rounded-full font-black">
              {columns.completati.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {columns.completati.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <Check className="w-10 h-10 mb-3 opacity-30" />
                <span className="font-semibold text-sm">Storico vuoto</span>
              </div>
            ) : (
              columns.completati.map((order) => (
                <OrderCard key={order.id} order={order} variant="done" onPrint={handlePrintOrder} />
              ))
            )}
          </div>
        </div>
      </div>

      {/* SEZIONE STAMPA */}
      {printingOrder && (
        <div className="hidden print:block fixed inset-0 z-50 bg-white text-black p-4 w-[80mm] mx-auto text-xs font-mono printable-receipt">
          <div className="text-center font-bold text-sm uppercase mb-1">
            {lido.nome_struttura}
          </div>
          <div className="text-center text-[10px] uppercase tracking-wider mb-2 border-b border-black border-dashed pb-1.5">
            Comanda di Servizio
          </div>
          <div className="space-y-1 mb-2">
            <div><strong>Tavolo/Ombrellone:</strong> {printingOrder.ombrelloni?.codice_identificativo || printingOrder.numero_ombrellone_manuale || 'N/A'}</div>
            <div><strong>Orario:</strong> {new Date(printingOrder.creato_il).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Pagamento:</strong> {printingOrder.metodo_pagamento === 'carta_stripe' ? 'Digitale (Stripe)' : 'Contanti'}</div>
          </div>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="space-y-1.5 mb-2">
            {printingOrder.dettagli_ordine.map((det) => (
              <div key={det.id} className="flex justify-between items-start">
                <div>
                  <span className="font-bold">{det.prodotti?.nome || 'Prodotto'}</span>
                  <span className="text-slate-700"> x{det.quantita}</span>
                  {det.note && <span className="block text-[10px] italic">Nota: "{det.note}"</span>}
                </div>
                <span>€{(Number(det.prezzo_unitario) * det.quantita).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-b border-black border-dashed my-2"></div>
          <div className="flex justify-between font-bold text-sm">
            <span>TOTALE ORDINE</span>
            <span>€{Number(printingOrder.totale).toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* MODAL WARNING ANTI-FRODE */}
      {activeWarnOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 print:hidden">
          <div className="bg-slate-900 border border-red-500/30 rounded-3xl max-w-md w-full p-8 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400 border-b border-slate-800 pb-5 mb-5">
              <ShieldAlert className="w-8 h-8" />
              <div>
                <h3 className="font-black text-xl">Controllo Anti-Evasione</h3>
                <p className="text-xs font-bold text-red-500/70 mt-1 uppercase tracking-wider">Avviso Annullamento Tardivo</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Stai provando ad annullare un ordine <strong>in Contanti</strong> per l'<strong>Ombrellone {activeWarnOrder.ombrelloni?.codice_identificativo || activeWarnOrder.numero_ombrellone_manuale}</strong> dopo che è già stato messo in preparazione.
            </p>

            <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3 text-xs mb-8 text-slate-400">
              <div className="flex gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>Verrà inviata una notifica automatica al cliente.</p>
              </div>
              <div className="flex gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>La commissione rimarrà fiscalizzata nel saldo dovuto.</p>
              </div>
              <div className="flex gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <p>Oltre il 10% di annullamenti settimanali, il pagamento in contanti verrà sospeso in automatico.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  updateOrderStatus(activeWarnOrder.id, 'annullato');
                  setActiveWarnOrder(null);
                }}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black py-4 rounded-xl text-sm transition-all"
              >
                Forza Annullamento
              </button>
              <button
                onClick={() => setActiveWarnOrder(null)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-black py-4 rounded-xl text-sm transition-all"
              >
                Mantieni Ordine
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM SCROLLBAR CSS */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #334155;
          border-radius: 10px;
        }
        @media print {
          body * { visibility: hidden !important; }
          .printable-receipt, .printable-receipt * { visibility: visible !important; }
          .printable-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 8px !important;
            background-color: white !important;
            color: black !important;
          }
        }
      `}</style>
    </div>
  );
}

// -------------------------------------------------------------
// COMPONENTE SCHEDA ORDINE (TICKET KDS)
// -------------------------------------------------------------
interface OrderCardProps {
  order: Order;
  variant: 'new' | 'progress' | 'done';
  onStart?: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
  onPrint?: (order: Order) => void;
}

function OrderCard({ order, variant, onStart, onComplete, onCancel, onPrint }: OrderCardProps) {
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // Calcola tempo trascorso se non è completato/annullato
  useEffect(() => {
    if (variant === 'done') return;

    const calcElapsed = () => {
      const diffMs = Date.now() - new Date(order.creato_il).getTime();
      setElapsedMinutes(Math.floor(diffMs / 60000));
    };

    calcElapsed();
    const interval = setInterval(calcElapsed, 30000); // aggiorna ogni 30s
    return () => clearInterval(interval);
  }, [order.creato_il, variant]);

  // Colori in base al tempo di attesa
  const isWarning = elapsedMinutes >= 10 && elapsedMinutes < 20;
  const isCritical = elapsedMinutes >= 20;

  return (
    <div className={`relative overflow-hidden rounded-2xl flex flex-col shadow-lg transition-transform hover:-translate-y-1 ${
      variant === 'done' 
        ? order.stato === 'annullato' ? 'bg-red-950/20 border border-red-900/30' : 'bg-slate-900/50 border border-slate-800'
        : 'bg-white border-0' // Sfondo bianco stile scontrino per gli ordini attivi
    }`}>
      
      {/* HEADER TICKET */}
      <div className={`p-4 border-b flex justify-between items-start ${
        variant === 'done' 
          ? order.stato === 'annullato' ? 'border-red-900/30 text-red-500' : 'border-slate-800 text-slate-400'
          : variant === 'new'
          ? 'bg-amber-100 border-amber-200 text-amber-900'
          : 'bg-sky-100 border-sky-200 text-sky-900'
      }`}>
        <div>
          <span className="block text-[10px] font-black uppercase tracking-widest opacity-60 mb-0.5">Ombrellone / Tavolo</span>
          <span className={`text-4xl font-black tracking-tighter leading-none ${variant === 'done' ? '' : 'text-slate-900'}`}>
            {order.ombrelloni?.codice_identificativo || order.numero_ombrellone_manuale || 'N/A'}
          </span>
        </div>

        <div className="text-right flex flex-col items-end gap-2">
          {variant !== 'done' && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold shadow-sm ${
              isCritical ? 'bg-red-500 text-white animate-pulse' :
              isWarning ? 'bg-amber-500 text-white' :
              'bg-emerald-500 text-white'
            }`}>
              <Clock className="w-3.5 h-3.5" />
              <span>{elapsedMinutes} min</span>
            </div>
          )}
          {variant === 'done' && (
            <span className="text-xs font-bold opacity-50">
              {new Date(order.creato_il).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* CORPO DEL TICKET (PRODOTTI) */}
      <div className={`p-4 flex-1 ${variant === 'done' ? 'text-slate-300' : 'text-slate-900'}`}>
        <div className="space-y-4">
          {order.dettagli_ordine.map((det) => (
            <div key={det.id} className="flex gap-3 border-b border-dashed border-slate-200 pb-3 last:border-0 last:pb-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm shrink-0 ${
                variant === 'done' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-800'
              }`}>
                {det.quantita}
              </div>
              <div className="pt-1">
                <span className="font-bold text-base leading-snug block">
                  {det.prodotti?.nome || 'Prodotto'}
                </span>
                {det.note && (
                  <div className="mt-1 inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded text-[11px] font-bold">
                    Nota: {det.note}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER & PAGAMENTO */}
      <div className={`px-4 py-3 border-t flex items-center justify-between text-xs font-bold ${
        variant === 'done' ? 'border-slate-800 bg-slate-900/30' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-2">
          {order.metodo_pagamento === 'carta_stripe' ? (
            <span className="flex items-center gap-1 text-indigo-600 bg-indigo-100 px-2 py-1 rounded">
              <CreditCard className="w-3.5 h-3.5" /> Digitale
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
              <DollarSign className="w-3.5 h-3.5" /> Contanti
            </span>
          )}
          
          <span className={`${order.stato_pagamento === 'pagato' ? (variant === 'done' ? 'text-emerald-500' : 'text-emerald-600') : (variant === 'done' ? 'text-amber-500' : 'text-amber-600')}`}>
            {order.stato_pagamento === 'pagato' ? 'Pagato' : 'In attesa'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {onPrint && (
            <button onClick={() => onPrint(order)} className={`p-1.5 rounded-lg transition-colors ${
              variant === 'done' ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-200'
            }`}>
              <Printer className="w-4 h-4" />
            </button>
          )}
          <span className={`text-base font-black ${variant === 'done' ? 'text-slate-300' : 'text-slate-900'}`}>
            €{Number(order.totale).toFixed(2)}
          </span>
        </div>
      </div>

      {/* PULSANTI DI AZIONE GIGANTI */}
      {(onStart || onComplete || onCancel) && (
        <div className="flex bg-slate-100 p-2 gap-2">
          {onCancel && variant === 'new' && (
            <button onClick={onCancel} className="w-12 flex items-center justify-center bg-white text-red-500 hover:bg-red-50 hover:text-red-600 border border-slate-200 rounded-xl transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          )}
          
          {onCancel && variant === 'progress' && (
            <button onClick={onCancel} className="w-12 flex items-center justify-center bg-white text-slate-400 hover:bg-red-50 hover:text-red-500 border border-slate-200 rounded-xl transition-colors shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </button>
          )}

          {onStart && (
            <button onClick={onStart} className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black uppercase tracking-wider py-4 rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2">
              <Play className="w-4 h-4 fill-current" /> INIZIA PREPARAZIONE
            </button>
          )}

          {onComplete && (
            <button onClick={onComplete} className="flex-1 bg-sky-500 hover:bg-sky-400 text-white font-black uppercase tracking-wider py-4 rounded-xl text-sm transition-colors shadow-sm flex items-center justify-center gap-2">
              <Check className="w-5 h-5 stroke-[3]" /> PRONTO DA SERVIRE
            </button>
          )}
        </div>
      )}
    </div>
  );
}
