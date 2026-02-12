
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../store';
import { 
  Plus, Trash2, Search, Filter, Layers, PackageCheck, 
  Boxes, Calculator, ArrowUpRight, ArrowDownLeft, History,
  Eye, EyeOff, Calendar, Tag, CircleDollarSign, Edit3, AlertTriangle, Wallet, Landmark as BankIcon,
  ChevronRight,
  MousePointerClick
} from 'lucide-react';
import { StockType, Batch, BatchVariant } from '../types';

const Inventory: React.FC = () => {
  const { state, addBatch, updateBatch, deleteBatch } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Batch | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | StockType>('ALL');
  const [showEmpty, setShowEmpty] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  
  // Form State (Stok Baru)
  const [formData, setFormData] = useState({
    productName: '',
    initialQuantity: '' as string | number,
    buyPrice: '' as string | number,
    totalPrice: '' as string | number,
    stockType: StockType.FOR_PRODUCTION,
    paymentMethod: 'CASH' as 'CASH' | 'BANK',
    manualDate: ''
  });

  // Edit Form State
  const [editFormData, setEditFormData] = useState({
    productName: '',
    variants: [] as BatchVariant[], 
    initialQuantity: '' as string | number,
    buyPrice: '' as string | number,
    totalPrice: '' as string | number,
    stockType: StockType.FOR_PRODUCTION,
    manualDate: ''
  });

  // Cek apakah tabel meluap untuk menampilkan hint scroll
  useEffect(() => {
    const checkOverflow = () => {
      if (tableContainerRef.current) {
        setIsOverflowing(tableContainerRef.current.scrollWidth > tableContainerRef.current.clientWidth);
      }
    };
    
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [state.batches, search, typeFilter]);

  const sanitizeNumeric = (val: string) => {
    let sanitized = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) sanitized = parts[0] + '.' + parts.slice(1).join('');
    return sanitized;
  };

  const relatedProduction = useMemo(() => {
    if (!showEditModal) return null;
    return state.productions.find(p => p.batchIdCreated === showEditModal.id);
  }, [showEditModal, state.productions]);

  const accumulatedQty = useMemo(() => {
    if (editFormData.variants.length === 0) return Number(editFormData.initialQuantity);
    return editFormData.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
  }, [editFormData.variants, editFormData.initialQuantity]);

  const isExceedingLimit = useMemo(() => {
    if (!relatedProduction) return false;
    return accumulatedQty > relatedProduction.outputQuantity;
  }, [accumulatedQty, relatedProduction]);

  const handleUnitPriceChange = (val: string, isEdit: boolean = false) => {
    const sanitized = sanitizeNumeric(val);
    const setter = isEdit ? setEditFormData : setFormData;
    const qtyForCalc = isEdit ? accumulatedQty : Number(formData.initialQuantity);
    const total = Number(sanitized) * qtyForCalc;
    setter((prev: any) => ({ ...prev, buyPrice: sanitized, totalPrice: total > 0 ? total.toString() : '' }));
  };

  const handleTotalPriceChange = (val: string, isEdit: boolean = false) => {
    const sanitized = sanitizeNumeric(val);
    const setter = isEdit ? setEditFormData : setFormData;
    const qty = isEdit ? accumulatedQty : Number(formData.initialQuantity);
    const unit = qty > 0 ? Number(sanitized) / qty : 0;
    setter((prev: any) => ({ ...prev, totalPrice: sanitized, buyPrice: unit > 0 ? unit.toString() : '' }));
  };

  const handleQuantityChange = (val: string) => {
    const sanitized = sanitizeNumeric(val);
    const total = Number(sanitized) * Number(formData.buyPrice);
    setFormData(prev => ({ ...prev, initialQuantity: sanitized, totalPrice: total > 0 ? total.toString() : '' }));
  };

  const addVariantRow = () => {
    setEditFormData(prev => ({
      ...prev,
      variants: [...prev.variants, { id: crypto.randomUUID(), label: '', quantity: 0 }]
    }));
  };

  const updateVariantRow = (idx: number, field: keyof BatchVariant, val: any) => {
    const updated = [...editFormData.variants];
    if (field === 'quantity') {
      (updated[idx] as any)[field] = Number(sanitizeNumeric(val.toString()));
    } else {
      (updated[idx] as any)[field] = val;
    }
    setEditFormData(prev => ({ ...prev, variants: updated }));
  };

  const removeVariantRow = (idx: number) => {
    const updated = editFormData.variants.filter((_, i) => i !== idx);
    setEditFormData(prev => ({ ...prev, variants: updated }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(formData.initialQuantity);
    const price = Number(formData.buyPrice);

    if (formData.productName && qty > 0) {
      const customTimestamp = formData.manualDate ? new Date(formData.manualDate).getTime() : undefined;
      addBatch({
        productName: formData.productName,
        initialQuantity: qty,
        buyPrice: price,
        stockType: formData.stockType,
        currentQuantity: qty
      }, customTimestamp, formData.paymentMethod);
      
      setShowModal(false);
      setFormData({ productName: '', initialQuantity: '', buyPrice: '', totalPrice: '', stockType: StockType.FOR_PRODUCTION, paymentMethod: 'CASH', manualDate: '' });
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isExceedingLimit) {
      alert(`STOK VARIAN (${accumulatedQty}) MELEBIHI HASIL PRODUKSI (${relatedProduction?.outputQuantity})!`);
      return;
    }

    if (showEditModal && editFormData.productName) {
      const customTimestamp = editFormData.manualDate ? new Date(editFormData.manualDate).getTime() : showEditModal.createdAt;
      
      updateBatch(showEditModal.id, {
        productName: editFormData.productName,
        variants: editFormData.variants,
        initialQuantity: accumulatedQty,
        currentQuantity: accumulatedQty, 
        buyPrice: Number(editFormData.buyPrice),
        stockType: editFormData.stockType,
        createdAt: customTimestamp
      });
      
      setShowEditModal(null);
    }
  };

  const filteredBatches = useMemo(() => {
    return state.batches.filter(b => {
      const variantSearch = b.variants?.map(v => v.label).join(' ') || '';
      const searchContent = `${b.productName} ${variantSearch}`.toLowerCase();
      const matchesSearch = searchContent.includes(search.toLowerCase());
      const matchesType = typeFilter === 'ALL' || b.stockType === typeFilter;
      const matchesVisibility = showEmpty ? true : b.currentQuantity > 0;
      return matchesSearch && matchesType && matchesVisibility;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [state.batches, search, typeFilter, showEmpty]);

  const totalValueFiltered = useMemo(() => {
    return filteredBatches.reduce((sum, b) => sum + (b.currentQuantity * b.buyPrice), 0);
  }, [filteredBatches]);

  const stockFlow = useMemo(() => {
    const flows: any[] = [];
    state.batches.forEach(b => {
      const isFromProduction = state.productions.some(p => p.batchIdCreated === b.id);
      flows.push({
        id: `in-${b.id}`,
        type: 'IN',
        productName: b.productName,
        quantity: b.initialQuantity,
        reason: isFromProduction ? 'HASIL PRODUKSI' : 'STOK MASUK (BELI)',
        createdAt: b.createdAt
      });
    });
    state.productionUsages.forEach(u => {
      const batch = state.batches.find(b => b.id === u.batchId);
      const prod = state.productions.find(p => p.id === u.productionId);
      flows.push({
        id: `out-prod-${u.id}`,
        type: 'OUT',
        productName: batch?.productName || 'PRODUK DIHAPUS',
        quantity: u.quantityUsed,
        reason: `DIPAKAI PRODUKSI: ${prod?.outputProductName || 'N/A'}`,
        createdAt: prod?.createdAt || Date.now()
      });
    });
    state.sales.forEach(s => {
      flows.push({
        id: `out-sale-${s.id}`,
        type: 'OUT',
        productName: s.productName + (s.variantLabel ? ` (${s.variantLabel})` : ''),
        quantity: s.quantity,
        reason: 'PENJUALAN',
        createdAt: s.createdAt
      });
    });
    return flows.sort((a, b) => b.createdAt - a.createdAt);
  }, [state.batches, state.productions, state.productionUsages, state.sales]);

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const formatQty = (val: number) => {
    return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      {/* CSS internal untuk mempercantik scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #334155;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl lg:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Manajemen Stok</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[9px] lg:text-[10px] font-bold uppercase tracking-wider">Gudang Aktif (FIFO System)</p>
        </div>

        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 lg:px-8 py-3 lg:py-3.5 rounded-xl lg:rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-500/20 active:scale-95 text-[10px] uppercase tracking-widest"
        >
          <Plus size={18} strokeWidth={3} />
          <span>Stok Baru</span>
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 lg:gap-8">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] lg:rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden text-slate-900 dark:text-white relative">
            
            {/* Scroll Hint */}
            {isOverflowing && (
              <div className="absolute top-24 right-4 z-20 pointer-events-none animate-bounce">
                <div className="bg-blue-600 text-white text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1 shadow-lg border border-blue-400 uppercase tracking-widest">
                  <MousePointerClick size={10} /> Geser Tabel →
                </div>
              </div>
            )}

            <div className="p-4 lg:p-6 border-b border-slate-50 dark:border-slate-800 space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="CARI NAMA BARANG ATAU VARIAN..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-700 text-[10px] transition-all uppercase text-slate-900 dark:text-white font-black"
                  value={search}
                  onChange={(e) => setSearch(e.target.value.toUpperCase())}
                />
              </div>
              
              <div className="flex flex-row items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 flex-nowrap">
                <div className="flex items-center gap-0.5 bg-slate-50 dark:bg-slate-800 p-0.5 rounded-xl border-2 border-slate-100 dark:border-slate-800 shrink-0">
                  {[
                    { id: 'ALL', label: 'SEMUA', icon: Boxes },
                    { id: StockType.FOR_PRODUCTION, label: 'BAHAN', icon: Layers },
                    { id: StockType.FOR_SALE, label: 'JADI', icon: PackageCheck }
                  ].map((btn) => {
                    const Icon = btn.icon;
                    const isActive = typeFilter === btn.id;
                    return (
                      <button
                        key={btn.id}
                        onClick={() => setTypeFilter(btn.id as any)}
                        className={`px-2 py-2 rounded-lg text-[8px] lg:text-[9px] font-black whitespace-nowrap transition-all flex items-center gap-1.5 border shrink-0 ${
                          isActive 
                          ? 'bg-white dark:bg-slate-700 border-white dark:border-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' 
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        <Icon size={12} strokeWidth={isActive ? 3 : 2} />
                        <span className="hidden sm:inline">{btn.label}</span>
                        <span className="inline sm:hidden">{btn.id === 'ALL' ? 'SEMUA' : btn.id === StockType.FOR_PRODUCTION ? 'BAHAN' : 'JADI'}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setShowEmpty(!showEmpty)}
                  className={`flex items-center gap-1.5 px-2.5 py-2 lg:py-2.5 rounded-xl border-2 font-black text-[8px] lg:text-[9px] transition-all shrink-0 ${
                    showEmpty 
                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600' 
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {showEmpty ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span className="uppercase tracking-widest">{showEmpty ? 'Tampil' : 'Sembunyi'}</span>
                </button>
              </div>
            </div>

            <div 
              ref={tableContainerRef}
              className="overflow-x-auto custom-scrollbar"
            >
              <table className="w-full text-left min-w-[900px] border-separate border-spacing-0">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[9px] uppercase font-black tracking-widest border-b dark:border-slate-800">
                    <th className="px-4 lg:px-6 py-4 sticky left-0 z-10 bg-slate-50 dark:bg-slate-900 border-b dark:border-slate-800">Produk & Variasi</th>
                    <th className="px-4 lg:px-6 py-4 w-24 border-b dark:border-slate-800">Tipe</th>
                    <th className="px-4 lg:px-6 py-4 w-32 border-b dark:border-slate-800">Total Stok</th>
                    <th className="px-4 lg:px-6 py-4 w-32 border-b dark:border-slate-800">Harga Beli</th>
                    <th className="px-4 lg:px-6 py-4 w-32 border-b dark:border-slate-800">Total Nilai</th>
                    <th className="px-4 lg:px-6 py-4 w-24 text-center sticky right-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-l dark:border-slate-800 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)]">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {filteredBatches.map((batch) => (
                    <tr key={batch.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group ${batch.currentQuantity === 0 ? 'opacity-40 grayscale-[0.5]' : ''}`}>
                      <td className="px-4 lg:px-6 py-4 sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 transition-colors">
                        <div className="flex flex-col gap-1">
                           <p className="font-black text-[10px] lg:text-[11px] text-slate-900 dark:text-slate-100 uppercase leading-none">
                             {batch.productName}
                           </p>
                           {batch.variants && batch.variants.length > 0 && (
                             <div className="flex flex-wrap gap-1 mt-1">
                                {batch.variants.map(v => (
                                  <span key={v.id} className="text-[7px] font-black bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800 uppercase">
                                    {v.label}: {formatQty(v.quantity)}
                                  </span>
                                ))}
                             </div>
                           )}
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border whitespace-nowrap ${
                          batch.stockType === StockType.FOR_PRODUCTION 
                          ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-500/10' 
                          : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/10'
                        }`}>
                          {batch.stockType === StockType.FOR_PRODUCTION ? 'Bahan' : 'Jadi'}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-end justify-between leading-none">
                            <span className={`font-black text-[10px] lg:text-xs ${
                              batch.currentQuantity === 0 ? 'text-slate-400' : 
                              batch.currentQuantity < 5 ? 'text-rose-600' : 'text-slate-900 dark:text-slate-200'
                            }`}>
                              {formatQty(batch.currentQuantity)}
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">/ {formatQty(batch.initialQuantity)}</span>
                          </div>
                          <div className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                batch.currentQuantity === 0 ? 'bg-slate-200' :
                                batch.currentQuantity < 5 ? 'bg-rose-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${(batch.currentQuantity / Math.max(1, batch.initialQuantity)) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <p className="text-[10px] lg:text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tighter whitespace-nowrap">{formatIDR(batch.buyPrice)}</p>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <p className={`text-[10px] lg:text-[11px] font-black tracking-tighter whitespace-nowrap ${batch.currentQuantity === 0 ? 'text-slate-300 dark:text-slate-600' : 'text-blue-600 dark:text-blue-400'}`}>
                          {formatIDR(batch.currentQuantity * batch.buyPrice)}
                        </p>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-center sticky right-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 border-l dark:border-slate-800 shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] transition-colors">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => {
                              setEditFormData({
                                productName: batch.productName,
                                variants: batch.variants || [],
                                initialQuantity: batch.initialQuantity.toString(),
                                buyPrice: batch.buyPrice.toString(),
                                totalPrice: (batch.buyPrice * batch.initialQuantity).toString(),
                                stockType: batch.stockType,
                                manualDate: new Date(batch.createdAt).toISOString().split('T')[0]
                              });
                              setShowEditModal(batch);
                            }}
                            className="p-1.5 lg:p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => deleteBatch(batch.id)}
                            className="p-1.5 lg:p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] lg:rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col max-h-[500px] lg:max-h-[700px]">
          <div className="p-4 lg:p-6 border-b border-slate-50 dark:border-slate-800 flex items-center gap-3 text-slate-900 dark:text-white">
            <div className="p-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg lg:rounded-xl">
              <History size={16} />
            </div>
            <div>
              <h3 className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">Riwayat Arus Barang</h3>
              <p className="text-[7px] lg:text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Semua Pergerakan</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 lg:p-4 space-y-2 lg:space-y-3 text-slate-900 dark:text-white">
            {stockFlow.slice(0, 50).map((flow) => (
              <div key={flow.id} className="flex items-start gap-3 lg:gap-4 p-3 lg:p-4 bg-slate-50 dark:bg-slate-800 rounded-xl lg:rounded-2xl border border-slate-100 dark:border-slate-700 group hover:border-blue-200 transition-all">
                <div className={`mt-0.5 p-1.5 lg:p-2 rounded-lg lg:rounded-xl flex-shrink-0 ${
                  flow.type === 'IN' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}>
                  {flow.type === 'IN' ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] lg:text-[10px] font-black text-slate-900 dark:text-slate-200 uppercase truncate">{flow.productName}</p>
                    <span className={`text-[9px] lg:text-[10px] font-black tracking-tighter ${
                      flow.type === 'IN' ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {flow.type === 'IN' ? '+' : '-'}{formatQty(flow.quantity)}
                    </span>
                  </div>
                  <p className="text-[8px] lg:text-[9px] text-slate-500 dark:text-slate-400 font-bold uppercase mt-0.5 truncate">{flow.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Input Stock Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[1.5rem] lg:rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-5 lg:px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Input Stok Baru</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">
                <Plus className="rotate-45 text-slate-400" size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 lg:p-6 space-y-4 text-slate-900">
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Barang</label>
                <input required type="text" placeholder="MISAL: TEPUNG TERIGU" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase text-slate-900 dark:text-white font-black text-[10px] transition-all" value={formData.productName} onChange={(e) => setFormData({...formData, productName: e.target.value.toUpperCase()})} />
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Sumber Dana (Potong Kas)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFormData({...formData, paymentMethod: 'CASH'})} className={`py-2 rounded-lg border-2 transition-all font-black text-[9px] flex items-center justify-center gap-1.5 uppercase ${formData.paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><Wallet size={12} /> Tunai / Cash</button>
                  <button type="button" onClick={() => setFormData({...formData, paymentMethod: 'BANK'})} className={`py-2 rounded-lg border-2 transition-all font-black text-[9px] flex items-center justify-center gap-1.5 uppercase ${formData.paymentMethod === 'BANK' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><BankIcon size={12} /> Bank / Transfer</button>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Kuantitas</label>
                  <input required type="text" inputMode="decimal" placeholder="0.00" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-black text-[10px] transition-all" value={formData.initialQuantity} onChange={(e) => handleQuantityChange(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Tanggal Transaksi</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    <input type="date" className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-black text-[10px]" value={formData.manualDate} onChange={(e) => setFormData({...formData, manualDate: e.target.value})} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">HPP / Unit</label>
                  <input required type="text" inputMode="decimal" placeholder="Rp 0" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-black text-[10px] transition-all" value={formData.buyPrice} onChange={(e) => handleUnitPriceChange(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">Total Nota</label>
                  <input required type="text" inputMode="decimal" placeholder="Total Rp" className="w-full px-4 py-2.5 bg-blue-50/50 dark:bg-blue-500/5 border-2 border-blue-100 dark:border-blue-500/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-900 dark:text-blue-100 font-black text-[10px] transition-all" value={formData.totalPrice} onChange={(e) => handleTotalPriceChange(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Tujuan Stok</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setFormData({...formData, stockType: StockType.FOR_PRODUCTION})} className={`py-2 rounded-lg border-2 transition-all font-black text-[9px] flex items-center justify-center gap-1.5 uppercase ${formData.stockType === StockType.FOR_PRODUCTION ? 'border-amber-500 bg-amber-50 dark:bg-amber-500/10 text-amber-700' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><Layers size={12} /> Bahan Produksi</button>
                  <button type="button" onClick={() => setFormData({...formData, stockType: StockType.FOR_SALE})} className={`py-2 rounded-lg border-2 transition-all font-black text-[9px] flex items-center justify-center gap-1.5 uppercase ${formData.stockType === StockType.FOR_SALE ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><PackageCheck size={12} /> Barang Jadi</button>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors uppercase text-[9px] tracking-widest">Batal</button>
                <button type="submit" className="flex-[2] py-3 bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-500 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase text-[9px] tracking-widest">Simpan Stok</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stock Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[1.5rem] lg:rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-5 lg:px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/5">
              <div className="flex flex-col">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none">Edit & Kelola Varian</h3>
                {relatedProduction && (
                  <span className="text-[7px] font-black text-emerald-600 uppercase mt-1 tracking-widest">Hasil Produksi Terkunci</span>
                )}
              </div>
              <button onClick={() => setShowEditModal(null)} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all">
                <Plus className="rotate-45 text-slate-400" size={18} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-5 lg:p-6 space-y-6 overflow-y-auto max-h-[80vh] custom-scrollbar text-slate-900">
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Barang Utama</label>
                  <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase text-slate-900 dark:text-white font-black text-[10px] transition-all" value={editFormData.productName} onChange={(e) => setEditFormData({...editFormData, productName: e.target.value.toUpperCase()})} />
                </div>

                {editFormData.stockType === StockType.FOR_SALE && (
                  <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between">
                       <div className="flex flex-col">
                        <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Sub Kategori / Variasi</p>
                        {relatedProduction && (
                          <p className={`text-[7px] font-black uppercase mt-0.5 tracking-tighter ${isExceedingLimit ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}>
                            LIMIT PRODUKSI: {formatQty(relatedProduction.outputQuantity)}
                          </p>
                        )}
                       </div>
                       <button type="button" onClick={addVariantRow} className="text-[8px] font-black bg-blue-600 text-white px-3 py-1 rounded-lg uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition-all">
                         <Plus size={10} strokeWidth={4} /> Tambah Varian
                       </button>
                    </div>
                    
                    <div className="space-y-2">
                       {editFormData.variants.map((v, idx) => (
                         <div key={v.id} className="flex gap-2 items-center animate-in slide-in-from-left-1 duration-200">
                            <div className="flex-[2]">
                              <input required type="text" placeholder="MISAL: MERAH - XL" className="w-full px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-[9px] font-black uppercase text-slate-900 dark:text-white" value={v.label} onChange={(e) => updateVariantRow(idx, 'label', e.target.value.toUpperCase())} />
                            </div>
                            <div className="flex-1">
                              <input required type="text" inputMode="decimal" placeholder="STOK" className={`w-full px-3 py-2 bg-white dark:bg-slate-700 border rounded-lg text-[9px] font-black text-slate-900 dark:text-white ${isExceedingLimit ? 'border-rose-500' : 'border-slate-200 dark:border-slate-600'}`} value={v.quantity} onChange={(e) => updateVariantRow(idx, 'quantity', e.target.value)} />
                            </div>
                            <button type="button" onClick={() => removeVariantRow(idx)} className="p-2 text-rose-300 hover:text-rose-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                         </div>
                       ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      {editFormData.variants.length > 0 ? "Total Stok (Akumulasi)" : "Total Stok Manual"}
                    </label>
                    <input 
                      disabled={editFormData.variants.length > 0 || !!relatedProduction} 
                      required type="text" inputMode="decimal"
                      className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white font-black text-[10px] transition-all ${
                        (editFormData.variants.length > 0 || !!relatedProduction) ? 'opacity-50 cursor-not-allowed bg-blue-50/20' : ''
                      } ${isExceedingLimit ? 'text-rose-600' : ''}`} 
                      value={editFormData.variants.length > 0 ? accumulatedQty.toString() : editFormData.initialQuantity} 
                      onChange={(e) => setEditFormData({...editFormData, initialQuantity: sanitizeNumeric(e.target.value)})} 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">Tanggal</label>
                    <input type="date" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-black text-[10px]" value={editFormData.manualDate} onChange={(e) => setEditFormData({...editFormData, manualDate: e.target.value})} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-slate-500 uppercase tracking-widest ml-1">HPP / Unit</label>
                    <input required type="text" inputMode="decimal" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 dark:text-white font-black text-[10px] transition-all" value={editFormData.buyPrice} onChange={(e) => handleUnitPriceChange(e.target.value, true)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest ml-1">Total Nota</label>
                    <input required type="text" inputMode="decimal" className="w-full px-4 py-2.5 bg-blue-50/50 dark:bg-blue-500/5 border-2 border-blue-100 dark:border-blue-500/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-blue-900 dark:text-blue-100 font-black text-[10px] transition-all" value={editFormData.totalPrice} onChange={(e) => handleTotalPriceChange(e.target.value, true)} />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex gap-3 sticky bottom-0 bg-white dark:bg-slate-900 py-2 border-t dark:border-slate-800">
                <button type="button" onClick={() => setShowEditModal(null)} className="flex-1 py-3 text-slate-500 font-bold hover:bg-slate-50 rounded-xl transition-colors uppercase text-[9px] tracking-widest">Batal</button>
                <button 
                  type="submit" 
                  disabled={isExceedingLimit}
                  className={`flex-[2] py-3 text-white font-black rounded-xl shadow-lg transition-all active:scale-95 uppercase text-[9px] tracking-widest ${
                    isExceedingLimit ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
