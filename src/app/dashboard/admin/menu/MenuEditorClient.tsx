'use client';

import React, { useState } from 'react';
import { Plus, Edit2, Trash2, ArrowLeft, Layers, Coffee, Check, X, Upload, GlassWater, UtensilsCrossed } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface Categoria {
  id: string;
  nome: string;
  ordine_visualizzazione: number;
  attiva: boolean;
}

interface Prodotto {
  id: string;
  categoria_id: string;
  nome: string;
  descrizione: string | null;
  prezzo: number | string;
  immagine_url: string | null;
  disponibile: boolean;
  reparto?: string;
}

interface MenuEditorClientProps {
  lidoId: string;
  initialCategories: Categoria[];
  initialProducts: Prodotto[];
}

export default function MenuEditorClient({ lidoId, initialCategories, initialProducts }: MenuEditorClientProps) {
  const [activeTab, setActiveTab] = useState<'categories' | 'products'>('products');
  const [categories, setCategories] = useState<Categoria[]>(initialCategories);
  const [products, setProducts] = useState<Prodotto[]>(initialProducts);
  const [isUploadingProd, setIsUploadingProd] = useState(false);
  const supabase = createClient();

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setIsUploadingProd(true);
    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `prod-${lidoId}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
    const filePath = `prodotti/${fileName}`;

    try {
      const { data, error } = await supabase.storage
        .from('waveorder')
        .upload(filePath, file);

      if (error) {
        setErrorMsg(`Errore caricamento immagine: ${error.message}`);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('waveorder')
          .getPublicUrl(filePath);
        setProdImg(publicUrl);
        setErrorMsg(null);
      }
    } catch (err) {
      setErrorMsg('Errore di rete durante il caricamento dell\'immagine.');
    } finally {
      setIsUploadingProd(false);
    }
  };

  // Modals state
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [isProdModalOpen, setIsProdModalOpen] = useState(false);

  // Category Form State
  const [selectedCat, setSelectedCat] = useState<Categoria | null>(null);
  const [catName, setCatName] = useState('');
  const [catOrder, setCatOrder] = useState(0);
  const [catActive, setCatActive] = useState(true);

  // Product Form State
  const [selectedProd, setSelectedProd] = useState<Prodotto | null>(null);
  const [prodCategory, setProdCategory] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState<number | string>('');
  const [prodImg, setProdImg] = useState('');
  const [prodAvailable, setProdAvailable] = useState(true);
  const [prodReparto, setProdReparto] = useState<'bar' | 'cucina'>('bar');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. GESTIONE CATEGORIE
  const openCatModal = (cat: Categoria | null = null) => {
    setSelectedCat(cat);
    setCatName(cat ? cat.nome : '');
    setCatOrder(cat ? cat.ordine_visualizzazione : 0);
    setCatActive(cat ? cat.attiva : true);
    setErrorMsg(null);
    setIsCatModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    const payload = {
      id: selectedCat?.id,
      nome: catName,
      ordine_visualizzazione: catOrder,
      attiva: catActive,
    };

    try {
      const method = selectedCat ? 'PUT' : 'POST';
      const res = await fetch('/api/menu/categories', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
      } else if (data.category) {
        if (selectedCat) {
          setCategories((prev) => prev.map((c) => (c.id === selectedCat.id ? data.category : c)));
        } else {
          setCategories((prev) => [...prev, data.category]);
        }
        setIsCatModalOpen(false);
      }
    } catch (err) {
      setErrorMsg("Errore di salvataggio categoria.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa categoria? Tutti i prodotti associati verranno eliminati.")) return;
    try {
      const res = await fetch(`/api/menu/categories?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.message) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        setProducts((prev) => prev.filter((p) => p.categoria_id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 2. GESTIONE PRODOTTI
  const openProdModal = (prod: Prodotto | null = null) => {
    setSelectedProd(prod);
    setProdCategory(prod ? prod.categoria_id : categories[0]?.id || '');
    setProdName(prod ? prod.nome : '');
    setProdDesc(prod ? prod.descrizione || '' : '');
    setProdPrice(prod ? prod.prezzo : '');
    setProdImg(prod ? prod.immagine_url || '' : '');
    setProdAvailable(prod ? prod.disponibile : true);
    setProdReparto(prod ? (prod.reparto as any) || 'bar' : 'bar');
    setErrorMsg(null);
    setIsProdModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodCategory) {
      setErrorMsg("Crea prima una categoria nel menu!");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const payload = {
      id: selectedProd?.id,
      categoria_id: prodCategory,
      nome: prodName,
      descrizione: prodDesc || null,
      prezzo: Number(prodPrice),
      immagine_url: prodImg || null,
      disponibile: prodAvailable,
      reparto: prodReparto,
    };

    try {
      const method = selectedProd ? 'PUT' : 'POST';
      const res = await fetch('/api/menu/products', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
      } else if (data.product) {
        if (selectedProd) {
          setProducts((prev) => prev.map((p) => (p.id === selectedProd.id ? data.product : p)));
        } else {
          setProducts((prev) => [...prev, data.product]);
        }
        setIsProdModalOpen(false);
      }
    } catch (err) {
      setErrorMsg("Errore di salvataggio prodotto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Eliminare definitivamente questo prodotto?")) return;
    try {
      const res = await fetch(`/api/menu/products?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.message) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 pb-12">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-900 mb-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/admin"
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Editor Menu</h1>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider font-bold">
              Organizza il catalogo delle tue bevande e pietanze
            </p>
          </div>
        </div>

        <button
          onClick={() => activeTab === 'categories' ? openCatModal() : openProdModal()}
          className="bg-indigo-650 hover:bg-indigo-600 text-white font-bold px-5 py-3 rounded-xl text-sm flex items-center gap-2 shadow-lg transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          <span>Aggiungi {activeTab === 'categories' ? 'Categoria' : 'Prodotto'}</span>
        </button>
      </header>

      {/* SELEZIONE SCHEDA (TABS) */}
      <div className="flex gap-4 border-b border-slate-900 pb-4 mb-8 max-w-7xl mx-auto text-sm font-semibold">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'products' ? 'bg-indigo-500/10 text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Coffee className="w-4.5 h-4.5" />
          Prodotti
        </button>
        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
            activeTab === 'categories' ? 'bg-indigo-500/10 text-indigo-400 font-bold' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-4.5 h-4.5" />
          Categorie
        </button>
      </div>

      {/* CONTENUTO SCHEDA */}
      <main className="max-w-7xl mx-auto">
        {activeTab === 'categories' ? (
          /* TABELLA CATEGORIE */
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl overflow-hidden">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-900 text-slate-400 font-bold text-xs uppercase tracking-wider bg-slate-950/20">
                  <th className="px-6 py-4.5">Ordine Visualizzazione</th>
                  <th className="px-6 py-4.5">Nome Categoria</th>
                  <th className="px-6 py-4.5">Stato</th>
                  <th className="px-6 py-4.5 text-right">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-500 font-semibold">
                      Nessuna categoria nel menu. Aggiungine una per iniziare!
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-slate-900/20 transition-colors">
                      <td className="px-6 py-4 text-slate-300 font-mono">#{cat.ordine_visualizzazione}</td>
                      <td className="px-6 py-4 font-bold text-slate-200">{cat.nome}</td>
                      <td className="px-6 py-4">
                        {cat.attiva ? (
                          <span className="text-emerald-400 text-xs font-bold">Attiva</span>
                        ) : (
                          <span className="text-slate-500 text-xs font-bold">Disattivata</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openCatModal(cat)}
                          className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg text-slate-300"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="bg-slate-800/60 hover:bg-red-950/30 hover:text-red-400 p-2 rounded-lg text-slate-500 border border-slate-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* GRIGLIA PRODOTTI */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 font-semibold bg-slate-900/20 border border-slate-900 rounded-3xl">
                Nessun prodotto configurato. Clicca su Aggiungi Prodotto per iniziare!
              </div>
            ) : (
              products.map((prod) => {
                const category = categories.find((c) => c.id === prod.categoria_id);
                return (
                  <div key={prod.id} className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 flex flex-col justify-between hover:border-slate-800 transition-all duration-200">
                    <div className="space-y-4.5">
                      {prod.immagine_url && (
                        <img src={prod.immagine_url} alt={prod.nome} className="w-full h-36 rounded-2xl object-cover border border-slate-850" />
                      )}
                      <div>
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">
                          {category ? category.nome : 'Categoria Sconosciuta'}
                        </span>
                        <h3 className="font-extrabold text-base text-slate-100 leading-snug">{prod.nome}</h3>
                        {prod.descrizione && (
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{prod.descrizione}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-900/60 pt-4 mt-5">
                      <div>
                        <span className="text-[10px] text-slate-500 block font-semibold uppercase">Prezzo</span>
                        <span className="font-extrabold text-base text-white">€{Number(prod.prezzo).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openProdModal(prod)}
                          className="bg-slate-800 hover:bg-slate-700 p-2 rounded-xl text-slate-300 transition-colors"
                        >
                          <Edit2 className="w-4.5 h-4.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(prod.id)}
                          className="bg-slate-850 hover:bg-red-950/20 hover:text-red-400 hover:border-red-900/30 p-2 rounded-xl text-slate-500 border border-slate-850 transition-all"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </main>

      {/* MODAL CATEGORIA */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div>
                <h3 className="font-extrabold text-xl">{selectedCat ? 'Modifica Categoria' : 'Crea Categoria'}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Sezione organizzativa del menu</p>
              </div>
              <button onClick={() => setIsCatModalOpen(false)} className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && <div className="bg-red-500/20 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl mb-4">{errorMsg}</div>}

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Nome Categoria *</label>
                <input
                  type="text"
                  required
                  placeholder="Es. Cocktail, Primi Piatti"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Ordine di Visualizzazione</label>
                <input
                  type="number"
                  value={catOrder}
                  onChange={(e) => setCatOrder(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Categoria Attiva</span>
                <input
                  type="checkbox"
                  checked={catActive}
                  onChange={(e) => setCatActive(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-800 text-indigo-650 bg-slate-950 focus:ring-indigo-500/50"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-colors mt-6"
              >
                {isSubmitting ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'Salva Categoria'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PRODOTTO */}
      {isProdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div>
                <h3 className="font-extrabold text-xl">{selectedProd ? 'Modifica Prodotto' : 'Aggiungi Prodotto'}</h3>
                <p className="text-xs text-slate-400 mt-0.5">Dettagli dell'articolo in vendita</p>
              </div>
              <button onClick={() => setIsProdModalOpen(false)} className="p-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && <div className="bg-red-500/20 border border-red-500/30 text-red-300 text-xs p-3 rounded-xl mb-4">{errorMsg}</div>}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Categoria *</label>
                <select
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Nome Prodotto *</label>
                <input
                  type="text"
                  required
                  placeholder="Es. Mojito, Burger Classico"
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Descrizione (Ingredienti/Dettagli)</label>
                <textarea
                  placeholder="Es. Rum, lime, menta, zucchero di canna, soda"
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 min-h-20"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Prezzo (€) *</label>
                <input
                  type="number"
                  step="0.10"
                  required
                  placeholder="7.50"
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Immagine Prodotto (Upload)</label>
                <div className="flex gap-4 items-center bg-slate-950 border border-slate-800 rounded-xl p-4.5">
                  {prodImg ? (
                    <img src={prodImg} alt="Product Preview" className="w-16 h-16 rounded-xl object-cover bg-slate-900 border border-slate-800" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 border-dashed flex items-center justify-center text-slate-500 font-bold text-xs">NO IMG</div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProductImageUpload}
                      disabled={isUploadingProd}
                      className="hidden"
                      id="product-image-upload"
                    />
                    <label
                      htmlFor="product-image-upload"
                      className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold px-4 py-3 rounded-xl text-slate-200 cursor-pointer transition-colors"
                    >
                      {isUploadingProd ? (
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
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">Reparto Destinazione (KDS)</label>
                <select
                  value={prodReparto}
                  onChange={(e) => setProdReparto(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 font-bold"
                >
                  <option value="bar">☕ Bar (Snack, Gelati, Drink, Caffetteria)</option>
                  <option value="cucina">🍳 Cucina (Primi, Secondi, Pizze, Ristorante)</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-950 rounded-xl">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Disponibile</span>
                <input
                  type="checkbox"
                  checked={prodAvailable}
                  onChange={(e) => setProdAvailable(e.target.checked)}
                  className="w-5 h-5 rounded border-slate-800 text-indigo-650 bg-slate-950 focus:ring-indigo-500/50 cursor-pointer"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-colors mt-6"
              >
                {isSubmitting ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> : 'Salva Prodotto'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
