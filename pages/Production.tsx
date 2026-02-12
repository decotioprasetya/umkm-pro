
import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { Factory, Trash2, Plus, Info, Wallet, Calendar, Clock, CheckCircle2, Play, ChevronRight, Edit3, Landmark as BankIcon, AlertCircle } from 'lucide-react';
import { StockType, TransactionCategory, ProductionStatus, ProductionRecord, BatchVariant, ProductionIngredient } from '../types';

const Production: React.FC = () => {
  const { state, runProduction, updateProduction, completeProduction, deleteProduction } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<ProductionRecord | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState<ProductionRecord | null>(null);
  const [activeView, setActiveView] = useState<'ONGOING' | 'HISTORY'>('ONGOING');

  // Form New Production
  const [outputName, setOutputName] = useState('');
  const [outputQty, setOutputQty] = useState('' as string | number);
  const [manualDate, setManualDate] = useState('');
  const [ingredients, setIngredients] = useState<{ productName: string, quantity: string | number }[]>([
    { productName: '', quantity: '' }
  ]);
  const [opCosts, setOpCosts] = useState<{ amount: string | number, description: string, paymentMethod: 'CASH' | 'BANK' }[]>([
    { amount: '', description: '', paymentMethod: 'CASH' }
  ]);

  // Form Complete Production
  const [actualQty, setActualQty] = useState('' as string | number);
  const [completeIngredients, setCompleteIngredients] = useState<ProductionIngredient[]>([]);
  const [completeVariants, setCompleteVariants] = useState<BatchVariant[]>([]);

  const sanitizeNumeric = (val: string) => {
    let sanitized = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) sanitized = parts[0] + '.' + parts.slice(1).join('');
    return sanitized;
  };

  const ongoingProductions = state.productions.filter(p => p.status === ProductionStatus.IN_PROGRESS);
  const completedProductions = state.productions.filter(p => p.status === ProductionStatus.COMPLETED);

  const availableMaterialsInfo = state.batches
    .filter(b => b.stockType === StockType.FOR_PRODUCTION && b.currentQuantity > 0)
    .reduce((acc, curr) => {
      acc[curr.productName] = (acc[curr.productName] || 0) + curr.currentQuantity;
      return acc;
    }, {} as Record<string, number>);

  const materialNames = Object.keys(availableMaterialsInfo);

  const addIngredientRow = () => {
    setIngredients([...ingredients, { productName: '', quantity: '' }]);
  };

  const updateIngredient = (index: number, field: string, value: any) => {
    const updated = [...ingredients];
    if (field === 'quantity') {
      (updated[index] as any)[field] = sanitizeNumeric(value.toString());
    } else {
      (updated[index] as any)[field] = value;
    }
    setIngredients(updated);
  };

  const removeIngredientRow = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const addCostRow = () => {
    setOpCosts([...opCosts, { amount: '', description: '', paymentMethod: 'CASH' }]);
  };

  const updateCost = (index: number, field: string, value: any) => {
    const updated = [...opCosts];
    if (field === 'amount') {
      (updated[index] as any)[field] = sanitizeNumeric(value.toString());
    } else {
      (updated[index] as any)[field] = value;
    }
    setOpCosts(updated);
  };

  const removeCostRow = (index: number) => {
    if (opCosts.length > 1) {
      setOpCosts(opCosts.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(outputQty);
    const validIngredients = ingredients.map(i => ({ ...i, quantity: Number(i.quantity) }));
    const validCosts = opCosts.map(c => ({ ...c, amount: Number(c.amount) }));

    if (outputName && qty >= 0 && validIngredients.every(i => i.productName && Number(i.quantity) >= 0)) {
      const customTimestamp = manualDate ? new Date(manualDate).getTime() : undefined;
      runProduction(outputName, qty, validIngredients, validCosts, customTimestamp);
      setShowModal(false);
      resetForm();
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showEditModal) {
      updateProduction(showEditModal.id, {
        outputProductName: outputName,
        outputQuantity: Number(outputQty)
      });
      setShowEditModal(null);
    }
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCompleteModal) return;
    
    const qty = Number(actualQty);
    if (qty < 0) {
      alert("HASIL RIIL TIDAK BOLEH NEGATIF!");
      return;
    }

    // Pastikan semua bahan yang diinput riil valid
    if (completeIngredients.some(i => i.quantity <= 0)) {
      alert("SEMUA BAHAN BAKU TERPAKAI HARUS DIISI DENGAN ANGKA DI ATAS NOL!");
      return;
    }

    const variantTotal = completeVariants.reduce((sum, v) => sum + v.quantity, 0);
    if (completeVariants.length > 0 && variantTotal !== qty) {
      alert(`TOTAL KUANTITAS VARIAN (${variantTotal}) HARUS SAMA DENGAN HASIL AKTUAL (${qty})!`);
      return;
    }

    try {
      await completeProduction(showCompleteModal.id, qty, completeIngredients, completeVariants.length > 0 ? completeVariants : undefined);
      setShowCompleteModal(null);
    } catch (err: any) {
      alert("GAGAL MENYELESAIKAN PRODUKSI: " + err.message);
    }
  };

  const resetForm = () => {
    setOutputName('');
    setOutputQty('');
    setManualDate('');
    setIngredients([{ productName: '', quantity: '' }]);
    setOpCosts([{ amount: '', description: '', paymentMethod: 'CASH' }]);
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const formatQty = (val: number) => {
    return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const addCompleteVariant = () => {
    setCompleteVariants([...completeVariants, { id: crypto.randomUUID(), label: '', quantity: 0 }]);
  };

  const updateCompleteVariant = (idx: number, field: keyof BatchVariant, val: any) => {
    const updated = [...completeVariants];
    if (field === 'quantity') {
      updated[idx][field] = Number(sanitizeNumeric(val.toString()));
    } else {
      updated[idx][field] = val;
    }
    setCompleteVariants(updated);
  };

  const removeCompleteVariant = (idx: number) => {
    setCompleteVariants(completeVariants.filter((_, i) => i !== idx));
  };

  const updateCompleteIngredient = (idx: number, val: string) => {
    const updated = [...completeIngredients];
    updated[idx].quantity = Number(sanitizeNumeric(val));
    setCompleteIngredients(updated);
  };

  const renderProductionCard = (prod: ProductionRecord) => {
    const isOngoing = prod.status === ProductionStatus.IN_PROGRESS;
    
    return (
      <div key={prod.id} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden group hover:shadow-md transition-all">
        <div className={`flex flex-col md:flex-row md:items-center justify-between p-8 ${isOngoing ? 'bg-amber-50/30 dark:bg-amber-500/5' : 'bg-slate-50/50 dark:bg-slate-800/50'} border-b border-slate-100 dark:border-slate-800`}>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-widest border ${
                isOngoing 
                ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' 
                : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
              }`}>
                {isOngoing ? 'Dalam Proses' : 'Selesai'}
              </span>
              {isOngoing && <Clock size={12} className="text-amber-500 animate-pulse" />}
              {!isOngoing && <CheckCircle2 size={12} className="text-emerald-500" />}
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{prod.outputProductName}</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mulai: {new Date(prod.createdAt).toLocaleString('id-ID')}</p>
          </div>

          <div className="mt-6 md:mt-0 flex flex-wrap items-center gap-6 lg:gap-10 text-white">
            <div className="text-right">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{isOngoing ? 'Target Qty' : 'Hasil Akhir'}</p>
              <p className="text-xl font-black text-slate-900 dark:text-white tracking-tighter">{formatQty(prod.outputQuantity)} Unit</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Total Biaya</p>
              <p className="text-xl font-black text-blue-600 dark:text-blue-400 tracking-tighter">{formatIDR(prod.totalHPP)}</p>
            </div>
            
            <div className="flex items-center gap-2">
              {isOngoing && (
                <>
                  <button 
                    onClick={() => {
                      setOutputName(prod.outputProductName);
                      setOutputQty(prod.outputQuantity.toString());
                      setShowEditModal(prod);
                    }}
                    className="p-2.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all"
                  >
                    <Edit3 size={20} />
                  </button>
                  <button 
                    onClick={() => {
                      setActualQty(prod.outputQuantity.toString());
                      setCompleteVariants([]);
                      setCompleteIngredients(prod.ingredients?.map(i => ({ ...i })) || []);
                      setShowCompleteModal(prod);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
                  >
                    <CheckCircle2 size={14} strokeWidth={3} />
                    Selesaikan
                  </button>
                </>
              )}
              <button 
                onClick={() => deleteProduction(prod.id)}
                className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                title="Batalkan Produksi"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 text-white">
          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Plus size={12} className="text-blue-500" /> {isOngoing ? 'Rencana Bahan Baku' : 'Bahan Baku Terpakai'}
            </h4>
            <div className="space-y-3">
              {isOngoing ? (
                // Tampilkan rencana jika sedang proses
                prod.ingredients?.map((ing, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 border border-slate-100 dark:border-slate-600">
                        <Factory size={14} />
                      </div>
                      <p className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase">{ing.productName}</p>
                    </div>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400">{formatQty(ing.quantity)} UNIT <span className="mx-1 opacity-20">|</span> ESTIMASI</p>
                  </div>
                ))
              ) : (
                // Tampilkan realisasi penggunaan jika sudah selesai
                state.productionUsages
                  .filter(u => u.productionId === prod.id)
                  .map((usage) => {
                    const batch = state.batches.find(b => b.id === usage.batchId);
                    return (
                      <div key={usage.id} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl text-white">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 border border-slate-100 dark:border-slate-600">
                            <Factory size={14} />
                          </div>
                          <p className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase">{batch?.productName || '???'}</p>
                        </div>
                        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400">{formatQty(usage.quantityUsed)} UNIT <span className="mx-1 opacity-20">|</span> {formatIDR(usage.costPerUnit)}</p>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          <div>
            <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Wallet size={12} className="text-rose-500" /> Biaya Operasional Produksi
            </h4>
            <div className="space-y-3">
              {state.transactions
                .filter(t => t.relatedId === prod.id && t.category === TransactionCategory.PRODUCTION_COST)
                .map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3.5 bg-rose-50/30 dark:bg-rose-500/5 border border-rose-100/50 dark:border-rose-500/10 rounded-2xl text-white">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center text-rose-500 dark:text-rose-400 border border-rose-100 dark:border-rose-700">
                        <Wallet size={14} />
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[10px] font-black text-rose-900 dark:text-rose-200 uppercase">{tx.description.split('(')[1]?.replace(')', '') || tx.description}</p>
                        <span className={`text-[7px] font-black px-1 rounded w-fit ${tx.paymentMethod === 'BANK' ? 'bg-blue-100 text-blue-600' : 'bg-rose-100 text-rose-600'}`}>{tx.paymentMethod || 'CASH'}</span>
                      </div>
                    </div>
                    <p className="text-[10px] font-black text-rose-600 dark:text-rose-400 tracking-tighter">{formatIDR(tx.amount)}</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Sistem Produksi Pro</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Pelacakan Proses & Konversi Hasil Nyata</p>
        </div>

        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white px-8 py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-xl shadow-slate-900/10 active:scale-95 text-xs uppercase tracking-widest"
        >
          <Plus size={20} strokeWidth={3} />
          <span>Produksi Baru</span>
        </button>
      </div>

      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 w-fit">
        <button 
          onClick={() => setActiveView('ONGOING')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeView === 'ONGOING' 
            ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-lg' 
            : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Play size={14} />
          Sedang Jalan ({ongoingProductions.length})
        </button>
        <button 
          onClick={() => setActiveView('HISTORY')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeView === 'HISTORY' 
            ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-lg' 
            : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <CheckCircle2 size={14} />
          Selesai ({completedProductions.length})
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {(activeView === 'ONGOING' ? ongoingProductions : completedProductions)
          .sort((a, b) => b.createdAt - a.createdAt)
          .map(prod => renderProductionCard(prod))
        }
      </div>

      {/* Completion Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-500/5">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Selesaikan Produksi</h3>
                <p className="text-[9px] font-black text-emerald-600 uppercase mt-1">Input Pemakaian Riil & Hasil Akhir</p>
              </div>
              <button onClick={() => setShowCompleteModal(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition-all">
                <Plus className="rotate-45 text-slate-400" size={24} />
              </button>
            </div>
            <form onSubmit={handleCompleteSubmit} className="p-8 space-y-6 max-h-[80vh] overflow-y-auto no-scrollbar">
              <div className="bg-blue-50 dark:bg-blue-500/10 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/20">
                <div className="flex items-center gap-3">
                  <Info size={18} className="text-blue-600" />
                  <p className="text-[10px] font-bold text-blue-900 dark:text-blue-300 uppercase leading-relaxed">
                    Konfirmasi jumlah bahan baku yang benar-benar terpakai untuk menghitung HPP yang akurat.
                  </p>
                </div>
              </div>

              {/* Input Pemakaian Bahan Baku Riil */}
              <div className="space-y-4">
                <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">Konfirmasi Pemakaian Bahan Baku</label>
                <div className="space-y-3">
                  {completeIngredients.map((ing, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400 border border-slate-100 dark:border-slate-600">
                          <Factory size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black text-slate-900 dark:text-slate-100 uppercase truncate">{ing.productName}</p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Tersedia: {formatQty(availableMaterialsInfo[ing.productName] || 0)}</p>
                        </div>
                      </div>
                      <div className="w-32">
                        <input 
                          required 
                          type="text" 
                          inputMode="decimal" 
                          placeholder="0.00" 
                          className={`w-full px-4 py-2.5 bg-white dark:bg-slate-900 border-2 rounded-xl focus:outline-none text-[11px] text-slate-900 dark:text-white font-black transition-all ${ing.quantity <= 0 ? 'border-rose-400 animate-pulse' : 'border-slate-100 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500'}`}
                          value={ing.quantity} 
                          onChange={(e) => updateCompleteIngredient(idx, e.target.value)} 
                        />
                      </div>
                    </div>
                  ))}
                  {completeIngredients.length === 0 && (
                    <p className="text-[9px] font-bold text-slate-400 uppercase text-center py-4 italic">Tidak ada bahan baku yang didaftarkan di awal.</p>
                  )}
                </div>
              </div>

              <div className="border-t dark:border-slate-800 pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Kuantitas Hasil Berhasil (Aktual)</label>
                  <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white font-black text-lg transition-all" value={actualQty} onChange={(e) => setActualQty(sanitizeNumeric(e.target.value))} />
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest ml-1">* Hasil barang jadi akhir.</p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">Pecah ke Varian (Opsional)</label>
                    <button type="button" onClick={addCompleteVariant} className="text-[8px] font-black text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-lg flex items-center gap-2 hover:bg-blue-100 transition-all uppercase tracking-widest border border-blue-100">
                      <Plus size={12} strokeWidth={3} /> Varian
                    </button>
                  </div>
                  <div className="space-y-3">
                    {completeVariants.map((v, idx) => (
                      <div key={v.id} className="flex gap-2 items-center animate-in slide-in-from-left-2 duration-200">
                        <div className="flex-[2]">
                          <input required type="text" placeholder="LABEL" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[9px] text-slate-900 dark:text-white font-black uppercase transition-all" value={v.label} onChange={(e) => updateCompleteVariant(idx, 'label', e.target.value.toUpperCase())} />
                        </div>
                        <div className="flex-1">
                          <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[9px] text-slate-900 dark:text-white font-black transition-all" value={v.quantity} onChange={(e) => updateCompleteVariant(idx, 'quantity', e.target.value)} />
                        </div>
                        <button type="button" onClick={() => removeCompleteVariant(idx)} className="p-2 text-rose-300 hover:text-rose-500 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {completeVariants.length > 0 && (
                      <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-center border border-dashed dark:border-slate-700">
                         <p className="text-[8px] font-black uppercase text-slate-500">
                           Total: <span className={completeVariants.reduce((s,v)=>s+v.quantity,0) === Number(actualQty) ? 'text-emerald-500' : 'text-rose-500'}>
                             {formatQty(completeVariants.reduce((s,v)=>s+v.quantity,0))} / {formatQty(Number(actualQty))}
                           </span>
                         </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-4 sticky bottom-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm pb-2 border-t dark:border-slate-800">
                <button type="button" onClick={() => setShowCompleteModal(null)} className="flex-1 py-4 text-slate-400 font-black hover:bg-slate-100 rounded-2xl transition-all uppercase text-[9px] tracking-widest">Batal</button>
                <button 
                  type="submit" 
                  disabled={completeIngredients.some(i => i.quantity <= 0)}
                  className={`flex-[2] py-4 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase text-[9px] tracking-widest ${completeIngredients.some(i => i.quantity <= 0) ? 'bg-slate-300 cursor-not-allowed opacity-50' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  Konfirmasi Penggunaan & Simpan Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Production Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Edit Produksi</h3>
              <button onClick={() => setShowEditModal(null)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all text-white">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-8 space-y-5 text-white">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Produk Target</label>
                <input required type="text" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase text-slate-900 dark:text-white font-black text-xs transition-all" value={outputName} onChange={(e) => setOutputName(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Kuantitas Target</label>
                <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-black text-xs transition-all" value={outputQty} onChange={(e) => setOutputQty(sanitizeNumeric(e.target.value))} />
              </div>
              <div className="pt-4 flex gap-4">
                <button type="button" onClick={() => setShowEditModal(null)} className="flex-1 py-4 text-slate-400 font-black hover:bg-slate-100 rounded-2xl transition-all uppercase text-[9px] tracking-widest">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase text-[9px] tracking-widest">Update Data</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Production New Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in duration-200">
            <div className="px-8 py-6 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 text-white rounded-xl shadow-md"><Factory size={20} /></div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Mulai Produksi Baru</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all text-white">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-8 space-y-8 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Nama Produk Jadi (Target)</label>
                  <input required type="text" placeholder="CONTOH: ROTI MANIS" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase text-slate-900 dark:text-white font-black text-xs transition-all" value={outputName} onChange={(e) => setOutputName(e.target.value.toUpperCase())} />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Kuantitas Target</label>
                  <input required type="text" inputMode="decimal" placeholder="0.00" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-black text-xs transition-all" value={outputQty} onChange={(e) => setOutputQty(sanitizeNumeric(e.target.value))} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Tanggal Mulai (Opsional)</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  <input type="date" className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-black text-xs" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">Komposisi Bahan Baku (Bisa Diisi 0 Dahulu)</label>
                  <button type="button" onClick={addIngredientRow} className="text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 hover:bg-blue-100 px-4 py-2 rounded-xl flex items-center gap-2 transition-all uppercase tracking-widest border border-blue-100">
                    <Plus size={14} strokeWidth={3} /> Tambah Bahan
                  </button>
                </div>
                <div className="space-y-3">
                  {ingredients.map((ing, idx) => (
                    <div key={idx} className="flex gap-3 items-start animate-in slide-in-from-left-2 duration-200">
                      <div className="flex-1">
                        <select required className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-[10px] text-slate-900 dark:text-white font-black uppercase transition-all" value={ing.productName} onChange={(e) => updateIngredient(idx, 'productName', e.target.value)}>
                          <option value="">-- PILIH BAHAN --</option>
                          {materialNames.map(m => (
                            <option key={m} value={m}>{m} (Stok: {formatQty(availableMaterialsInfo[m])})</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-28">
                        <input required type="text" inputMode="decimal" placeholder="0.00" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-[10px] text-slate-900 dark:text-white font-black transition-all" value={ing.quantity} onChange={(e) => updateIngredient(idx, 'quantity', e.target.value)} />
                      </div>
                      <button type="button" onClick={() => removeIngredientRow(idx)} className="p-3 text-slate-300 hover:text-rose-500 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest ml-1">Biaya Operasional Langsung (Potong Kas)</label>
                  <button type="button" onClick={addCostRow} className="text-[9px] font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 px-4 py-2 rounded-xl flex items-center gap-2 transition-all uppercase tracking-widest border border-rose-100">
                    <Plus size={14} strokeWidth={3} /> Tambah Biaya
                  </button>
                </div>
                <div className="space-y-4">
                  {opCosts.map((cost, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3 animate-in slide-in-from-right-2 duration-200">
                      <div className="flex gap-3">
                        <div className="flex-[2]">
                          <input type="text" placeholder="KETERANGAN (MISAL: LISTRIK)" className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-[10px] text-slate-900 dark:text-white font-black uppercase transition-all" value={cost.description} onChange={(e) => updateCost(idx, 'description', e.target.value.toUpperCase())} />
                        </div>
                        <div className="flex-1">
                          <input type="text" inputMode="decimal" placeholder="BIAYA (RP)" className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-[10px] text-slate-900 dark:text-white font-black transition-all" value={cost.amount} onChange={(e) => updateCost(idx, 'amount', e.target.value)} />
                        </div>
                        <button type="button" onClick={() => removeCostRow(idx)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => updateCost(idx, 'paymentMethod', 'CASH')} className={`py-1.5 rounded-lg border transition-all font-black text-[8px] flex items-center justify-center gap-1.5 uppercase ${cost.paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}><Wallet size={10} /> Tunai</button>
                        <button type="button" onClick={() => updateCost(idx, 'paymentMethod', 'BANK')} className={`py-1.5 rounded-lg border transition-all font-black text-[8px] flex items-center justify-center gap-1.5 uppercase ${cost.paymentMethod === 'BANK' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700' : 'border-slate-200 dark:border-slate-600 text-slate-400'}`}><BankIcon size={10} /> Bank</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex gap-4 sticky bottom-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 text-slate-400 font-black hover:bg-slate-100 rounded-2xl transition-all uppercase text-[9px] tracking-widest">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase text-[9px] tracking-widest">Mulai Sekarang</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Production;
