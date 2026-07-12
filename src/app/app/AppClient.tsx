'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Search, MapPin, User, LogIn, ChevronRight, QrCode, Ticket } from 'lucide-react';
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

export default function AppClient({ lidi }: { lidi: LidoLight[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [utente, setUtente] = useState<UtenteApp | null>(null);
  
  // Auth Form State
  const [showAuth, setShowAuth] = useState(false);
  const [telefono, setTelefono] = useState('');
  const [nome, setNome] = useState('');
  const [cognome, setCognome] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Check se l'utente è già loggato nell'app nativa
    const savedPhone = localStorage.getItem('waveorder_global_phone');
    if (savedPhone) {
      checkUserExists(savedPhone);
    } else {
      setIsLoading(false);
    }
  }, []);

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
      } else {
        // Se c'è un telefono salvato ma non è nel DB, cancella il salvataggio
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
        // Login successo
        setUtente(data);
        localStorage.setItem('waveorder_global_phone', data.telefono);
        localStorage.setItem('waveorder_global_id', data.id);
        setShowAuth(false);
      } else {
        // Nessun utente, passa a registrazione
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
        .insert({
          telefono,
          nome,
          cognome
        })
        .select()
        .single();
        
      if (error) {
        setErrorMsg('Errore durante la registrazione. Riprova.');
      } else if (data) {
        setUtente(data);
        localStorage.setItem('waveorder_global_phone', data.telefono);
        localStorage.setItem('waveorder_global_id', data.id);
        setShowAuth(false);
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
  };

  const openQrScanner = () => {
    // In Capacitor, we would call the native QR scanner plugin here.
    // For now on web, we alert the user.
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
            <button onClick={handleLogout} className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
              <User className="w-5 h-5 text-slate-300" />
            </button>
          ) : (
            <button onClick={() => setShowAuth(true)} className="px-4 py-2 bg-indigo-600 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2">
              <LogIn className="w-4 h-4" /> Accedi
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 space-y-8">
        
        {/* Welcome Section */}
        {utente && (
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-xl">
            <h2 className="text-2xl font-black mb-1 text-white">Ciao, {utente.nome}! 👋</h2>
            <p className="text-sm text-indigo-200 mb-6 font-medium">Pronto per rilassarti sotto l'ombrellone?</p>
            
            <button onClick={openQrScanner} className="w-full bg-white text-indigo-950 py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform">
              <QrCode className="w-6 h-6" />
              INQUADRA QR OMBRELLONE
            </button>
          </div>
        )}

        {/* Explore Lidi */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-lg text-slate-200">Lidi WaveOrder</h3>
            <MapPin className="w-5 h-5 text-slate-500" />
          </div>
          
          <div className="space-y-4">
            {lidi.map(lido => (
              <Link href={`/menu/${lido.slug}`} key={lido.id} className="block">
                <div className="bg-slate-900/50 border border-slate-800 hover:border-slate-700 rounded-3xl p-4 flex items-center gap-4 transition-all">
                  <div 
                    className="w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center text-white font-black text-xl"
                    style={{ backgroundColor: lido.colore_primario || '#4f46e5' }}
                  >
                    {lido.nome_struttura.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-white">{lido.nome_struttura}</h4>
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

      </main>

      {/* Auth Modal / Bottom Sheet */}
      {showAuth && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full bg-slate-900 border-t border-slate-800 rounded-t-[2.5rem] p-8 pb-12 shadow-2xl animate-in slide-in-from-bottom-full duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-black">{isRegistering ? 'Crea Account' : 'Accedi'}</h2>
              <button onClick={() => setShowAuth(false)} className="text-slate-500 font-bold p-2">Chiudi</button>
            </div>
            
            <form onSubmit={isRegistering ? handleRegisterSubmit : handleLoginSubmit} className="space-y-5">
              {errorMsg && <div className="p-3 bg-red-500/20 text-red-400 rounded-xl text-sm font-bold">{errorMsg}</div>}
              
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Numero di Telefono *</label>
                <input 
                  type="tel" 
                  required
                  placeholder="+39 333 1234567"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {isRegistering && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nome *</label>
                    <input 
                      type="text" 
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Cognome *</label>
                    <input 
                      type="text" 
                      required
                      value={cognome}
                      onChange={(e) => setCognome(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </>
              )}

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg mt-4 disabled:opacity-50"
              >
                {isLoading ? 'Attendi...' : (isRegistering ? 'Completa Registrazione' : 'Continua')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
