'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Search, MapPin, User, LogIn, ChevronRight, QrCode, Ticket, Clock, Star, Map } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface LidoLight {
  id: string;
  nome_struttura: string;
  slug: string;
  colore_primario: string;
  logo_url: string | null;
}

interface UtenteApp {
  id: string;
  telefono: string;
  nome: string;
  cognome: string;
}

interface Ordine {
  id: string;
  creato_il: string;
  totale: number;
  stato: string;
  lido_id: string;
  lidi?: {
    nome_struttura: string;
    colore_primario: string;
  };
}

interface PuntiLido {
  lido_id: string;
  punti_totali: number;
  lidi?: {
    nome_struttura: string;
    colore_primario: string;
  };
}

export default function AppClient({ lidi }: { lidi: LidoLight[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [utente, setUtente] = useState<UtenteApp | null>(null);
  
  // Data State
  const [ordini, setOrdini] = useState<Ordine[]>([]);
  const [punti, setPunti] = useState<PuntiLido[]>([]);
  
  // Auth Form State
  const [showAuth, setShowAuth] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // UI State
  const [activeTab, setActiveTab] = useState<'lidi' | 'ordini' | 'punti'>('lidi');

  useEffect(() => {
    const savedPhone = localStorage.getItem('waveorder_global_phone');
    if (savedPhone) {
      checkUserExists(savedPhone);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUserData = async (userId: string) => {
    try {
      // 1. Fetch Ordini
      const { data: ordiniData } = await supabase
        .from('ordini')
        .select(`
          id, creato_il, totale, stato, lido_id,
          lidi ( nome_struttura, colore_primario )
        `)
        .eq('utente_app_id', userId)
        .order('creato_il', { ascending: false })
        .limit(10);
      
      if (ordiniData) setOrdini(ordiniData as any[]);

      // 2. Fetch Punti Fedeltà
      const { data: puntiData } = await supabase
        .from('utenti_punti_lido')
        .select(`
          lido_id, punti_totali,
          lidi ( nome_struttura, colore_primario )
        `)
        .eq('utente_id', userId)
        .order('punti_totali', { ascending: false });

      if (puntiData) setPunti(puntiData as any[]);

    } catch (e) {
      console.error(e);
    }
  };

  const checkUserExists = async (phone: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('utenti_app')
        .select('*')
        .eq('telefono', phone)
        .single();
      
      if (data) {
        setUtente(data);
        localStorage.setItem('waveorder_global_phone', data.telefono);
        localStorage.setItem('waveorder_global_id', data.id);
        await fetchUserData(data.id);
      } else {
        localStorage.removeItem('waveorder_global_phone');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telefono) return;
    
    setErrorMsg('');
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('utenti_app')
        .select('*')
        .eq('telefono', telefono)
        .single();
        
      if (data) {
        setUtente(data);
        localStorage.setItem('waveorder_global_phone', data.telefono);
        localStorage.setItem('waveorder_global_id', data.id);
        setShowAuth(false);
        await fetchUserData(data.id);
      } else {
        setIsRegistering(true);
      }
    } catch (e) {
      setIsRegistering(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!telefono || !nome || !cognome) return;
    
    setErrorMsg('');
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('utenti_app')
        .insert({ telefono, nome, cognome })
        .select()
        .single();
        
      if (error) {
        setErrorMsg('Errore durante la registrazione. Riprova.');
      } else if (data) {
        setUtente(data);
        localStorage.setItem('waveorder_global_phone', data.telefono);
        localStorage.setItem('waveorder_global_id', data.id);
        setShowAuth(false);
        await fetchUserData(data.id);
      }
    } catch (e) {
      setErrorMsg('Errore di connessione.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('waveorder_global_phone');
    localStorage.removeItem('waveorder_global_id');
    setUtente(null);
    setOrdini([]);
    setPunti([]);
    setActiveTab('lidi');
  };

  const openQrScanner = () => {
    alert("Funzionalità QR Scanner Nativo. Apri l'app sul telefono per scansionare l'ombrellone.");
  };

  if (isLoading && !utente && !showAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 mt-4 font-bold tracking-wider">Avvio WaveOrder...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-24">
      {/* Header Nativo */}
      <header className="pt-12 pb-6 px-6 bg-slate-900 border-b border-slate-800 sticky top-0 z-30">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              WaveOrder
            </h1>
            <p className="text-xs font-bold text-indigo-400 tracking-widest uppercase mt-1">
              Beach & Service
            </p>
          </div>
          
          {utente ? (
            <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shadow-md active:scale-95 transition-transform">
              <User className="w-5 h-5 text-slate-300" />
            </button>
          ) : (
            <button onClick={() => setShowAuth(true)} className="px-4 py-2 bg-indigo-600 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2">
              <LogIn className="w-4 h-4" /> Accedi
            </button>
          )}
        </div>

        {/* Tab Navigation (solo se loggato) */}
        {utente && (
          <div className="flex gap-2 mt-6 overflow-x-auto pb-2 scrollbar-hide">
            <button 
              onClick={() => setActiveTab('lidi')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wider uppercase whitespace-nowrap transition-colors ${activeTab === 'lidi' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              Lidi
            </button>
            <button 
              onClick={() => setActiveTab('ordini')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wider uppercase whitespace-nowrap transition-colors ${activeTab === 'ordini' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              I Miei Ordini
            </button>
            <button 
              onClick={() => setActiveTab('punti')}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold tracking-wider uppercase whitespace-nowrap transition-colors ${activeTab === 'punti' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              Punti Fedeltà
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-8">
        
        {/* Welcome Section (Visibile su tutte le tab ma solo se loggato) */}
        {utente && activeTab === 'lidi' && (
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-2xl font-black mb-1 text-white">Ciao, {utente.nome}! 👋</h2>
              <p className="text-sm text-indigo-200 mb-6 font-medium">Pronto per rilassarti sotto l'ombrellone?</p>
              
              <button onClick={openQrScanner} className="w-full bg-white text-indigo-950 py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform">
                <QrCode className="w-6 h-6" />
                INQUADRA QR OMBRELLONE
              </button>
            </div>
          </div>
        )}

        {/* TAB: Lidi */}
        {(!utente || activeTab === 'lidi') && (
          <div className="animate-in fade-in duration-300">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-lg text-slate-200">Lidi Affiliati</h3>
              <MapPin className="w-5 h-5 text-slate-500" />
            </div>
            
            <div className="space-y-4">
              {lidi.map(lido => (
                <Link href={`/menu/${lido.slug}`} key={lido.id} className="block">
                  <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-3xl p-4 flex items-center gap-4 transition-all active:scale-[0.98]">
                    <div 
                      className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-black text-2xl shadow-inner"
                      style={{ backgroundColor: lido.colore_primario || '#4f46e5' }}
                    >
                      {lido.nome_struttura.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-white text-base">{lido.nome_struttura}</h4>
                      <p className="text-xs text-slate-400 mt-1">Ordina online da questo lido</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-600" />
                  </div>
                </Link>
              ))}
              
              {lidi.length === 0 && (
                <p className="text-slate-500 text-sm italic">Nessun lido disponibile al momento.</p>
              )}
            </div>
          </div>
        )}

        {/* TAB: Ordini */}
        {utente && activeTab === 'ordini' && (
          <div className="animate-in fade-in duration-300">
            <h3 className="font-extrabold text-lg text-slate-200 mb-4">Storico Ordini</h3>
            <div className="space-y-4">
              {ordini.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/30 rounded-3xl border border-slate-800 border-dashed">
                  <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">Non hai ancora effettuato ordini.</p>
                </div>
              ) : (
                ordini.map(ordine => (
                  <div key={ordine.id} className="bg-slate-900/50 border border-slate-800 rounded-3xl p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-white text-base" style={{ color: ordine.lidi?.colore_primario || '#818cf8' }}>
                          {ordine.lidi?.nome_struttura || 'Lido'}
                        </h4>
                        <span className="text-xs text-slate-500">
                          {new Date(ordine.creato_il).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="font-black text-lg">€{ordine.totale.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                        ordine.stato === 'consegnato' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        ordine.stato === 'annullato' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                        'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                      }`}>
                        {ordine.stato}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB: Punti Fedeltà */}
        {utente && activeTab === 'punti' && (
          <div className="animate-in fade-in duration-300">
            <h3 className="font-extrabold text-lg text-slate-200 mb-4">I tuoi Punti Fedeltà</h3>
            <div className="space-y-4">
              {punti.length === 0 ? (
                <div className="text-center py-12 bg-slate-900/30 rounded-3xl border border-slate-800 border-dashed">
                  <Star className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">Non hai ancora accumulato punti nei lidi.</p>
                </div>
              ) : (
                punti.map(p => (
                  <div key={p.lido_id} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-800 text-amber-400">
                        <Star className="w-6 h-6 fill-current" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-base">{p.lidi?.nome_struttura || 'Lido'}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">Punti accumulati</p>
                      </div>
                    </div>
                    <span className="font-black text-2xl text-amber-400">{p.punti_totali}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* Auth Modal / Bottom Sheet */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border-t border-slate-800 rounded-t-[2.5rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">{isRegistering ? 'Crea Account' : 'Accedi'}</h2>
              <button onClick={() => setShowAuth(false)} className="text-slate-500 font-bold p-2 hover:text-white transition-colors">Chiudi</button>
            </div>
            
            <form onSubmit={isRegistering ? handleRegisterSubmit : handleLoginSubmit} className="space-y-5">
              {errorMsg && <div className="p-3 bg-red-500/20 text-red-400 rounded-xl text-sm font-bold border border-red-500/20">{errorMsg}</div>}
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Numero di Telefono *</label>
                <input 
                  type="tel" 
                  required
                  placeholder="+39 333 1234567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                />
                {!isRegistering && <p className="text-[10px] text-slate-500 mt-2 font-medium">Se non hai un account, ti chiederemo di crearlo nel prossimo passaggio.</p>}
              </div>

              {isRegistering && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nome *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Mario"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cognome *</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Rossi"
                      value={cognome}
                      onChange={(e) => setCognome(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl shadow-lg shadow-indigo-600/20 mt-4 disabled:opacity-50 transition-all active:scale-95"
              >
                {isLoading ? 'Attendi...' : (isRegistering ? 'Completa Registrazione' : 'Accedi / Continua')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
