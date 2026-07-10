'use client';

import React, { useState, useMemo } from 'react';
import { CreditCard, DollarSign, ArrowLeft, ShieldAlert, CheckCircle, Save, Globe, QrCode, Upload, Users, Search, Trophy } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface Lido {
  id: string;
  nome_struttura: string;
  slug: string;
  logo_url: string | null;
  colore_primario: string;
  tipo_contratto: string;
  accetta_contanti: boolean;
  pagamenti_digitali_attivi: boolean;
  stripe_account_id: string | null;
  fidelity_attivo: boolean;
  fidelity_soglia_punti: number;
  fidelity_valore_sconto: number | string;
}

interface Order {
  totale: number | string;
  metodo_pagamento: string;
  stato_pagamento: string;
  stato: string;
}

interface CashCommission {
  importo_commissione: number | string;
}

interface ClienteFidelity {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
  punti_totali: number;
  creato_il: string;
}

interface LidoAdminClientProps {
  lido: Lido;
  orders: Order[];
  cashCommissions: CashCommission[];
  clientiFidelity: ClienteFidelity[];
}

export default function LidoAdminClient({ lido, orders, cashCommissions, clientiFidelity }: LidoAdminClientProps) {
  const [nomeStruttura, setNomeStruttura] = useState(lido.nome_struttura);
  const [logoUrl, setLogoUrl] = useState(lido.logo_url || '');
  const [colorePrimario, setColorePrimario] = useState(lido.colore_primario);
  const [accettaContanti, setAccettaContanti] = useState(lido.accetta_contanti);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [fidelityAttivo, setFidelityAttivo] = useState(lido.fidelity_attivo !== undefined ? lido.fidelity_attivo : true);
  const [fidelitySogliaPunti, setFidelitySogliaPunti] = useState(lido.fidelity_soglia_punti || 100);
  const [fidelityValoreSconto, setFidelityValoreSconto] = useState(Number(lido.fidelity_valore_sconto) || 5.00);
  const [clientiSearch, setClientiSearch] = useState('');
  const supabase = createClient();

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingLogo(true);
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `logo-${lido.id}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const filePath = `loghi/${fileName}`;

    try {
      const { data, error } = await supabase.storage
        .from('waveorder')
        .upload(filePath, file);

      if (error) {
        setSaveMessage(`Errore caricamento: ${error.message}`);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('waveorder')
          .getPublicUrl(filePath);
        setLogoUrl(publicUrl);
        setSaveMessage('Logo caricato con successo! Ricorda di salvare le impostazioni.');
      }
    } catch (err) {
      setSaveMessage('Errore di rete durante il caricamento del logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Calcolo statistiche finanziarie del lido
  const stats = useMemo(() => {
    const paidOrders = orders.filter((o) => o.stato_pagamento === 'pagato');
    
    const totalSales = paidOrders.reduce((sum, o) => sum + Number(o.totale), 0);
    const cardSales = paidOrders.filter((o) => o.metodo_pagamento === 'carta_stripe').reduce((sum, o) => sum + Number(o.totale), 0);
    const cashSales = paidOrders.filter((o) => o.metodo_pagamento === 'contanti').reduce((sum, o) => sum + Number(o.totale), 0);

    // Calcolo tasso cancellazione contanti settimanale (simuliamo su base storica totale)
    const cashOrders = orders.filter((o) => o.metodo_pagamento === 'contanti');
    const cancelledCashOrders = cashOrders.filter((o) => o.stato === 'annullato');
    const cashCancelRate = cashOrders.length > 0 ? (cancelledCashOrders.length / cashOrders.length) * 100 : 0;

    const totalCashDue = cashCommissions.reduce((sum, c) => sum + Number(c.importo_commissione), 0);

    return {
      totalSales,
      cardSales,
      cashSales,
      cashCancelRate,
      totalCashDue,
      cashOrdersCount: cashOrders.length,
    };
  }, [orders, cashCommissions]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/lidi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_struttura: nomeStruttura,
          logo_url: logoUrl || null,
          colore_primario: colorePrimario,
          accetta_contanti: accettaContanti,
          fidelity_attivo: fidelityAttivo,
          fidelity_soglia_punti: Number(fidelitySogliaPunti),
          fidelity_valore_sconto: Number(fidelityValoreSconto),
        }),
      });

      const data = await res.json();
      if (data.error) {
        setSaveMessage(`Errore: ${data.error}`);
      } else {
        setSaveMessage('Impostazioni salvate con successo!');
      }
    } catch (err) {
      setSaveMessage('Errore di rete durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 pb-12">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-900 mb-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/orders"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">{lido.nome_struttura} - Impostazioni Admin</h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
              Gestione Menu, Spiaggia e Configurazione Commerciale
            </p>
          </div>
        </div>

        {/* Link rapidi alle altre sezioni admin */}
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/admin/menu"
            className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-xs font-bold px-4 py-2.5 rounded-xl text-slate-200"
          >
            Gestione Menu
          </Link>
          <Link
            href="/dashboard/admin/ombrelloni"
            className="inline-flex items-center gap-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 text-xs font-bold px-4 py-2.5 rounded-xl text-slate-200"
          >
            Generatore Spiaggia & QR
          </Link>
        </div>
      </header>

      {/* METRICHE FINANZIARIE DEL LIDO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto mb-10">
        {/* Card 1: Fatturato Totale */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
            €
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fatturato Totale</span>
            <span className="block text-xl font-black text-white mt-0.5">€{stats.totalSales.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 2: Carte */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fatturato Carte</span>
            <span className="block text-xl font-black text-white mt-0.5">€{stats.cardSales.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 3: Contanti */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fatturato Contanti</span>
            <span className="block text-xl font-black text-white mt-0.5">€{stats.cashSales.toFixed(2)}</span>
          </div>
        </div>

        {/* Card 4: Saldo platform */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5.5 flex items-center gap-4.5">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Comm. Contanti Dovute</span>
            <span className="block text-xl font-black text-red-400 mt-0.5">€{stats.totalCashDue.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* COMPILAZIONE INFORMAZIONI E BRANDING */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {/* Form Impostazioni */}
        <div className="lg:col-span-2 bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5">
          <h2 className="font-extrabold text-lg text-slate-100 pb-4 border-b border-slate-900 mb-6">Impostazioni Stabilimento</h2>
          
          {saveMessage && (
            <div className={`p-3.5 rounded-xl text-xs font-semibold mb-6 border ${
              saveMessage.includes('Errore')
                ? 'bg-red-500/20 border-red-500/30 text-red-300'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
            }`}>
              {saveMessage}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Nome Stabilimento *</label>
              <input
                type="text"
                required
                value={nomeStruttura}
                onChange={(e) => setNomeStruttura(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Logo Stabilimento (Upload)</label>
              <div className="flex gap-4 items-center bg-slate-950 border border-slate-800 rounded-xl p-4.5">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo Preview" className="w-16 h-16 rounded-xl object-cover bg-slate-900 border border-slate-800" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 border-dashed flex items-center justify-center text-slate-500 font-bold text-xs">NO LOGO</div>
                )}
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                    className="hidden"
                    id="logo-upload-input"
                  />
                  <label
                    htmlFor="logo-upload-input"
                    className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold px-4 py-3 rounded-xl text-slate-200 cursor-pointer transition-colors"
                  >
                    {isUploadingLogo ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Upload className="w-4.5 h-4.5 text-indigo-400" />
                    )}
                    Sfoglia Immagine
                  </label>
                  <p className="text-[10px] text-slate-500 mt-1.5">JPG, PNG o WEBP. Dimensione max 2MB.</p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Colore Primario di Brand</label>
              <div className="flex gap-4 items-center">
                <input
                  type="color"
                  value={colorePrimario}
                  onChange={(e) => setColorePrimario(e.target.value)}
                  className="w-12 h-12 bg-transparent border-0 rounded-xl cursor-pointer"
                />
                <span className="text-sm font-mono uppercase tracking-wider">{colorePrimario}</span>
              </div>
            </div>

            {/* SELEZIONE CONTANTI (CON ALERT SE BLOCCATO DA SISTEMA) */}
            <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-sm">Accetta pagamenti in contanti</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Permette ai clienti di pagare l'ordinazione al cameriere</p>
                </div>
                <input
                  type="checkbox"
                  disabled={!lido.accetta_contanti && stats.cashCancelRate > 10 && stats.cashOrdersCount >= 10} // Blocco se disabilitato da anti-frode
                  checked={accettaContanti}
                  onChange={(e) => setAccettaContanti(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-800 text-indigo-650 bg-slate-950 focus:ring-indigo-500/50 cursor-pointer disabled:opacity-50"
                />
              </div>

              {!lido.accetta_contanti && stats.cashCancelRate > 10 && stats.cashOrdersCount >= 10 && (
                <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs p-3.5 rounded-xl flex gap-2.5 leading-relaxed">
                  <ShieldAlert className="w-5 h-5 shrink-0" />
                  <p>
                    <strong>Opzione Contanti Sospesa Automaticamente:</strong> Il tuo tasso di cancellazione ordini contanti negli ultimi 7 giorni ({stats.cashCancelRate.toFixed(1)}%) supera il limite del 10%. Per sbloccare l'opzione contatti contatta l'assistenza.
                  </p>
                </div>
              )}
            </div>

            {/* CONFIGURAZIONE RACCOLTA PUNTI (FIDELITY CARD) */}
            <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-900">
                <div>
                  <h4 className="font-bold text-sm">Abilita Raccolta Punti Fedeltà</h4>
                  <p className="text-xs text-slate-500 mt-0.5">Attiva la WaveCard digitale per i tuoi clienti</p>
                </div>
                <input
                  type="checkbox"
                  checked={fidelityAttivo}
                  onChange={(e) => setFidelityAttivo(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-800 text-indigo-650 bg-slate-950 focus:ring-indigo-500/50 cursor-pointer"
                />
              </div>

              {fidelityAttivo && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Soglia Punti per Premio</label>
                    <input
                      type="number"
                      required
                      min="10"
                      value={fidelitySogliaPunti}
                      onChange={(e) => setFidelitySogliaPunti(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Es. 100"
                    />
                    <p className="text-[10px] text-slate-500">I punti necessari per sbloccare lo sconto (es. 100 punti).</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Valore Sconto (€)</label>
                    <input
                      type="number"
                      required
                      min="0.50"
                      step="0.50"
                      value={fidelityValoreSconto}
                      onChange={(e) => setFidelityValoreSconto(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Es. 5.00"
                    />
                    <p className="text-[10px] text-slate-500">Il valore monetario dello sconto applicato alla soglia (es. 5€).</p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 bg-indigo-650 hover:bg-indigo-650/80 text-white font-bold px-6 py-3.5 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-colors duration-200"
            >
              <Save className="w-4 h-4" />
              {isSaving ? "Salvataggio..." : "Salva Impostazioni"}
            </button>
          </form>
        </div>

        {/* Informazioni Stripe Connect */}
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5 h-fit space-y-6">
          <h2 className="font-extrabold text-lg text-slate-100 pb-4 border-b border-slate-900">Stripe Connect</h2>
          
          {lido.stripe_account_id ? (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-2xl flex gap-2.5 items-start">
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Account Connesso</h4>
                  <p className="text-slate-300 mt-1 leading-relaxed">Il tuo lido è connesso a Stripe con ID: <strong>{lido.stripe_account_id}</strong></p>
                </div>
              </div>
              
              <div className="text-xs text-slate-400 leading-relaxed">
                I pagamenti digitali dei clienti dall'ombrellone fluiscono direttamente sul tuo conto Stripe. L'application fee contrattuale del lido viene trattenuta ed accreditata alla piattaforma in modalità split automatico alla sorgente.
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs rounded-2xl flex gap-2.5 items-start">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">Stripe Non Configurato</h4>
                  <p className="text-slate-300 mt-1 leading-relaxed">Completa l'onboarding di Stripe per abilitare i pagamenti con Carta e Apple Pay dall'ombrellone.</p>
                </div>
              </div>

              <button
                disabled
                className="w-full py-4 text-center bg-slate-800 border border-slate-700 text-slate-400 font-bold rounded-2xl text-xs uppercase tracking-wider cursor-not-allowed"
              >
                Connetti Stripe Connect
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SEZIONE CLIENTI FIDELITY REGISTRATI */}
      {fidelityAttivo && (
        <div className="max-w-7xl mx-auto mt-10">
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-6.5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-extrabold text-lg text-slate-100">Clienti WaveCard</h2>
                  <p className="text-xs text-slate-500">{clientiFidelity.length} clienti registrati</p>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cerca per nome o telefono..."
                  value={clientiSearch}
                  onChange={(e) => setClientiSearch(e.target.value)}
                  className="w-full md:w-72 bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
            </div>

            {clientiFidelity.length === 0 ? (
              <div className="py-12 text-center">
                <Trophy className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Nessun cliente registrato alla WaveCard</p>
                <p className="text-xs text-slate-600 mt-1">I clienti si registreranno tramite la PWA del menu</p>
              </div>
            ) : (
              <div className="mt-5 space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {clientiFidelity
                  .filter((c) => {
                    if (!clientiSearch.trim()) return true;
                    const search = clientiSearch.toLowerCase();
                    return (
                      c.nome.toLowerCase().includes(search) ||
                      c.cognome.toLowerCase().includes(search) ||
                      c.telefono.includes(search)
                    );
                  })
                  .map((cliente) => (
                    <div key={cliente.id} className="flex items-center justify-between bg-slate-950/50 border border-slate-900 rounded-2xl px-5 py-4 hover:border-slate-800 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                          {cliente.nome.charAt(0)}{cliente.cognome.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-200">{cliente.nome} {cliente.cognome}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{cliente.telefono}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-xl font-black text-indigo-400">{cliente.punti_totali}</span>
                          <span className="text-[10px] text-slate-500 font-bold">PTS</span>
                        </div>
                        {cliente.punti_totali >= fidelitySogliaPunti && (
                          <span className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full mt-1">
                            Premio pronto!
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


