
import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { 
  ShoppingCart, Plus, Trash2, Search, Info, Calendar, 
  CheckCircle2, XCircle, Clock, User, Package, Wallet, 
  ChevronRight, CircleDollarSign, History, AlertTriangle, Edit3, Landmark as BankIcon
} from 'lucide-react';
import { StockType, DPStatus, SaleRecord, DPOrder } from '../types';

const Sales: React.FC = () => {
  const { state, runSale, updateSale, deleteSale, addDPOrder, updateDPOrder, completeDPOrder, cancelDPOrder, deleteDPOrder } = useApp();
  const [activeTab, setActiveTab] = useState<'DIRECT' | 'DP_ORDERS'>('DIRECT');
  const [showDirectModal, setShowDirectModal] = useState(false);
  const [showEditSaleModal, setShowEditSaleModal] = useState<SaleRecord | null>(null);
  const [showDPModal, setShowDPModal] = useState(false);
  const [showEditDPModal, setShowEditDPModal] = useState<DPOrder | null>(null);
  const [showCompleteDPModal, setShowCompleteDPModal] = useState<DPOrder | null>(null);
  const [search, setSearch] = useState('');

  // Direct Sale Form State
  const [saleForm, setSaleForm] = useState({
    productName: '',
    variantLabel: '', 
    quantity: '' as string | number,
    price: '' as string | number,
    totalPrice: '' as string | number,
    paymentMethod: 'CASH' as 'CASH' | 'BANK',
    manualDate: ''
  });

  // DP Order Form State
  const [dpForm, setDpForm] = useState({
    customerName: '',
    productName: '',
    quantity: '' as string | number,
    totalAmount: '' as string | number,
    dpAmount: '' as string | number,
    paymentMethod: 'CASH' as 'CASH' | 'BANK',
    manualDate: ''
  });

  // Complete DP Form State (untuk pelunasan sisa)
  const [completeDPAccount, setCompleteDPAccount] = useState<'CASH' | 'BANK'>('CASH');

  const sanitizeNumeric = (val: string) => {
    let sanitized = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) sanitized = parts[0] + '.' + parts.slice(1).join('');
    return sanitized;
  };

  const handleSaleFormChange = (field: string, val: any) => {
    setSaleForm(prev => {
      let finalVal = val;
      if (['quantity', 'price', 'totalPrice'].includes(field)) {
        finalVal = sanitizeNumeric(val.toString());
      }
      const updated = { ...prev, [field]: finalVal };
      
      const q = Number(updated.quantity);
      const p = Number(updated.price);
      const t = Number(updated.totalPrice);

      if (field === 'price' || field === 'quantity') {
        updated.totalPrice = q * p > 0 ? (q * p).toString() : '';
      } else if (field === 'totalPrice') {
        updated.price = q > 0 ? (t / q).toString() : '';
      }
      return updated;
    });
  };

  const handleDPFormChange = (field: string, val: any) => {
    let finalVal = val;
    if (['quantity', 'totalAmount', 'dpAmount'].includes(field)) {
      finalVal = sanitizeNumeric(val.toString());
    }
    setDpForm(prev => ({ ...prev, [field]: finalVal }));
  };

  const availableToSellItems = useMemo(() => {
    const itemsMap: Record<string, { name: string, sub: string, total: number }> = {};
    
    state.batches
      .filter(b => b.stockType === StockType.FOR_SALE && b.currentQuantity > 0)
      .forEach(b => {
        if (b.variants && b.variants.length > 0) {
          b.variants.forEach(v => {
            const key = `${b.productName}|||${v.label}`;
            if (!itemsMap[key]) {
              itemsMap[key] = { name: b.productName, sub: v.label, total: 0 };
            }
            itemsMap[key].total += v.quantity;
          });
        } else {
          const key = `${b.productName}|||${b.subCategory || ''}`;
          if (!itemsMap[key]) {
            itemsMap[key] = { name: b.productName, sub: b.subCategory || '', total: 0 };
          }
          itemsMap[key].total += b.currentQuantity;
        }
      });
    return Object.values(itemsMap).filter(i => i.total > 0);
  }, [state.batches]);

  const handleSubmitDirect = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(saleForm.quantity);
    const price = Number(saleForm.price);

    if (saleForm.productName && qty > 0 && price > 0) {
      const [name, sub] = saleForm.productName.split('|||');
      const selectedItem = availableToSellItems.find(i => i.name === name && i.sub === (sub || ''));
      
      if (!selectedItem || qty > selectedItem.total) {
        alert("JUMLAH PENJUALAN MELEBIHI STOK TERSEDIA!");
        return;
      }

      const customTimestamp = saleForm.manualDate ? new Date(saleForm.manualDate).getTime() : undefined;
      runSale(selectedItem.name, qty, price, customTimestamp, selectedItem.sub, saleForm.paymentMethod);
      setShowDirectModal(false);
      resetSaleForm();
    }
  };

  const handleEditSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showEditSaleModal) {
      const qty = Number(saleForm.quantity);
      const price = Number(saleForm.price);
      const total = Number(saleForm.totalPrice);
      const customTimestamp = saleForm.manualDate ? new Date(saleForm.manualDate).getTime() : showEditSaleModal.createdAt;
      
      updateSale(showEditSaleModal.id, {
        productName: saleForm.productName,
        quantity: qty,
        salePrice: price,
        totalRevenue: total,
        createdAt: customTimestamp
      });
      setShowEditSaleModal(null);
    }
  };

  const handleSubmitDP = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Number(dpForm.quantity);
    const total = Number(dpForm.totalAmount);
    const dp = Number(dpForm.dpAmount);

    if (dpForm.customerName && dpForm.productName && qty > 0 && total > 0 && dp > 0) {
      const customTimestamp = dpForm.manualDate ? new Date(dpForm.manualDate).getTime() : undefined;
      addDPOrder({
        customerName: dpForm.customerName,
        productName: dpForm.productName,
        quantity: qty,
        totalAmount: total,
        dpAmount: dp
      }, customTimestamp, dpForm.paymentMethod);
      setShowDPModal(false);
      resetDPForm();
    }
  };

  const handleEditDPSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showEditDPModal) {
      const qty = Number(dpForm.quantity);
      const total = Number(dpForm.totalAmount);
      const dp = Number(dpForm.dpAmount);
      const customTimestamp = dpForm.manualDate ? new Date(dpForm.manualDate).getTime() : showEditDPModal.createdAt;
      
      updateDPOrder(showEditDPModal.id, {
        customerName: dpForm.customerName,
        productName: dpForm.productName,
        quantity: qty,
        totalAmount: total,
        dpAmount: dp,
        createdAt: customTimestamp
      });
      setShowEditDPModal(null);
    }
  };

  const handleCompleteDPSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showCompleteDPModal) {
      completeDPOrder(showCompleteDPModal.id, undefined, completeDPAccount);
      setShowCompleteDPModal(null);
    }
  };

  const resetSaleForm = () => {
    setSaleForm({ productName: '', variantLabel: '', quantity: '', price: '', totalPrice: '', paymentMethod: 'CASH', manualDate: '' });
  };

  const resetDPForm = () => {
    setDpForm({ customerName: '', productName: '', quantity: '', totalAmount: '', dpAmount: '', paymentMethod: 'CASH', manualDate: '' });
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const formatQty = (val: number) => {
    return val.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const filteredSales = state.sales.filter(s => 
    s.productName.toLowerCase().includes(search.toLowerCase()) ||
    (s.variantLabel && s.variantLabel.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredDP = state.dpOrders.filter(o => 
    o.customerName.toLowerCase().includes(search.toLowerCase()) || 
    o.productName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Manajemen Penjualan</h2>
          <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Pelacakan Pendapatan & Order DP</p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'DIRECT' ? (
            <button 
              onClick={() => { resetSaleForm(); setShowDirectModal(true); }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-500/20 active:scale-95 text-xs uppercase tracking-widest"
            >
              <Plus size={20} strokeWidth={3} />
              <span>Input Penjualan</span>
            </button>
          ) : (
            <button 
              onClick={() => { resetDPForm(); setShowDPModal(true); }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-500/20 active:scale-95 text-xs uppercase tracking-widest"
            >
              <Plus size={20} strokeWidth={3} />
              <span>Buka Order DP</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-100 dark:border-slate-800 w-fit">
        <button 
          onClick={() => setActiveTab('DIRECT')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'DIRECT' 
            ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-lg' 
            : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShoppingCart size={14} />
          Langsung ({state.sales.length})
        </button>
        <button 
          onClick={() => setActiveTab('DP_ORDERS')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === 'DP_ORDERS' 
            ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-lg' 
            : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          <Clock size={14} />
          Order DP ({state.dpOrders.filter(o => o.status === DPStatus.PENDING).length})
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center gap-4">
           <div className="relative flex-1 text-white">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="CARI DATA..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all uppercase text-black dark:text-white font-black"
              value={search}
              onChange={(e) => setSearch(e.target.value.toUpperCase())}
            />
          </div>
        </div>

        {activeTab === 'DIRECT' ? (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[9px] uppercase font-black tracking-widest border-b dark:border-slate-800">
                  <th className="px-8 py-5">Produk & Varian</th>
                  <th className="px-8 py-5">Qty</th>
                  <th className="px-8 py-5">Harga</th>
                  <th className="px-8 py-5">Total Omset</th>
                  <th className="px-8 py-5">Profit (FIFO)</th>
                  <th className="px-8 py-5">Tanggal</th>
                  <th className="px-8 py-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredSales
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <p className="font-black text-slate-900 dark:text-white uppercase text-[11px] leading-tight">
                          {sale.productName}
                        </p>
                        {sale.variantLabel && (
                          <span className="text-[8px] text-blue-500 font-black uppercase mt-0.5">{sale.variantLabel}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-[11px] font-bold text-slate-600 dark:text-slate-400">{formatQty(sale.quantity)} Unit</td>
                    <td className="px-8 py-5 text-[11px] font-bold text-slate-900 dark:text-white">{formatIDR(sale.salePrice)}</td>
                    <td className="px-8 py-5 text-[11px] font-black text-emerald-600 dark:text-emerald-400">{formatIDR(sale.totalRevenue)}</td>
                    <td className="px-8 py-5">
                      <div className="flex flex-col">
                        <span className="text-blue-600 dark:text-blue-400 font-black text-[11px]">+{formatIDR(sale.totalRevenue - sale.totalCOGS)}</span>
                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">HPP: {formatIDR(sale.totalCOGS)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-[10px] text-slate-400 font-bold">
                      {new Date(sale.createdAt).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-8 py-5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => {
                            setSaleForm({
                              productName: sale.productName,
                              variantLabel: sale.variantLabel || '',
                              quantity: sale.quantity.toString(),
                              price: sale.salePrice.toString(),
                              totalPrice: sale.totalRevenue.toString(),
                              paymentMethod: 'CASH', 
                              manualDate: new Date(sale.createdAt).toISOString().split('T')[0]
                            });
                            setShowEditSaleModal(sale);
                          }}
                          className="p-2.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all"
                        >
                          <Edit3 size={18} />
                        </button>
                        <button 
                          onClick={() => deleteSale(sale.id)}
                          className="p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[9px] uppercase font-black tracking-widest border-b dark:border-slate-800">
                  <th className="px-8 py-5">Customer</th>
                  <th className="px-8 py-5">Pesanan</th>
                  <th className="px-8 py-5">Nilai Order</th>
                  <th className="px-8 py-5 text-center">Kesiapan Stok</th>
                  <th className="px-8 py-5">DP & Kurang</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5 text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredDP
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((order) => {
                    const isPending = order.status === DPStatus.PENDING;
                    const totalAvailable = state.batches
                      .filter(b => b.productName === order.productName && b.stockType === StockType.FOR_SALE)
                      .reduce((s, b) => s + b.currentQuantity, 0);
                    const isStockReady = totalAvailable >= order.quantity;
                    const shortage = Math.max(0, order.quantity - totalAvailable);

                    return (
                      <tr key={order.id} className={`hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors ${!isPending ? 'opacity-60' : ''}`}>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400">
                              <User size={14} />
                            </div>
                            <div>
                              <p className="font-black text-slate-900 dark:text-white uppercase text-[11px] leading-none">{order.customerName}</p>
                              <p className="text-[8px] text-slate-400 font-bold uppercase mt-1 tracking-widest">{new Date(order.createdAt).toLocaleDateString('id-ID')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <p className="font-black text-slate-700 dark:text-slate-300 uppercase text-[10px] leading-tight">{order.productName}</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5">{formatQty(order.quantity)} UNIT</p>
                        </td>
                        <td className="px-8 py-5 font-black text-slate-900 dark:text-white text-[11px]">{formatIDR(order.totalAmount)}</td>
                        <td className="px-8 py-5 text-center">
                          {isPending ? (
                            <div className="flex flex-col items-center">
                              {isStockReady ? (
                                <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg text-[8px] font-black border border-emerald-100 dark:border-emerald-500/20 uppercase">
                                  Siap Dikirim
                                </span>
                              ) : (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-1 rounded-lg text-[8px] font-black border border-rose-100 dark:border-rose-500/20 uppercase">
                                    Stok Kurang
                                  </span>
                                  <span className="text-[7px] text-rose-500 font-bold uppercase tracking-tighter">-{formatQty(shortage)} UNIT</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-black uppercase opacity-40">-</span>
                          )}
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col">
                            <span className="text-emerald-600 dark:text-emerald-400 font-black text-[10px]">DP: {formatIDR(order.dpAmount)}</span>
                            {isPending && (
                               <span className="text-rose-600 dark:text-rose-400 font-black text-[9px] mt-0.5 tracking-tighter">SISA: {formatIDR(order.totalAmount - order.dpAmount)}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                            order.status === DPStatus.PENDING ? 'bg-amber-50 text-amber-600 border-amber-100' :
                            order.status === DPStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            'bg-rose-50 text-rose-600 border-rose-100'
                          }`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {isPending && (
                              <>
                                <button 
                                  onClick={() => {
                                    setDpForm({
                                      customerName: order.customerName,
                                      productName: order.productName,
                                      quantity: order.quantity.toString(),
                                      totalAmount: order.totalAmount.toString(),
                                      dpAmount: order.dpAmount.toString(),
                                      paymentMethod: 'CASH',
                                      manualDate: new Date(order.createdAt).toISOString().split('T')[0]
                                    });
                                    setShowEditDPModal(order);
                                  }}
                                  className="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button 
                                  onClick={() => setShowCompleteDPModal(order)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-lg shadow-md transition-all active:scale-95 disabled:opacity-30 disabled:grayscale"
                                  title="Pelunasan & Keluar Stok"
                                  disabled={!isStockReady}
                                >
                                  <CheckCircle2 size={16} />
                                </button>
                                <button 
                                  onClick={() => cancelDPOrder(order.id)}
                                  className="bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-lg shadow-md transition-all active:scale-95"
                                  title="Batalkan (DP Hangus)"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                            {order.status !== DPStatus.COMPLETED ? (
                                <button 
                                    onClick={() => deleteDPOrder(order.id)}
                                    className="p-2 text-slate-300 hover:text-rose-500 rounded-lg transition-all"
                                >
                                    <Trash2 size={16} />
                                </button>
                            ) : (
                                <span className="text-[7px] text-slate-400 font-black uppercase tracking-widest opacity-40 px-2">Selesai</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sale Modal */}
      {(showDirectModal || showEditSaleModal) && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-5 border-b dark:border-slate-800 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-500/5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {showEditSaleModal ? 'Edit Penjualan' : 'Input Penjualan Langsung'}
              </h3>
              <button onClick={() => { setShowDirectModal(false); setShowEditSaleModal(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                <Plus className="rotate-45 text-slate-400" size={24} />
              </button>
            </div>
            <form onSubmit={showEditSaleModal ? handleEditSaleSubmit : handleSubmitDirect} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Produk {showEditSaleModal ? '' : '& Varian'}</label>
                {showEditSaleModal ? (
                   <div className="space-y-2">
                     <input disabled type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-xs font-black text-slate-400 uppercase" value={saleForm.productName} />
                     {saleForm.variantLabel && <p className="text-[9px] font-black text-blue-500 ml-1 uppercase">Varian: {saleForm.variantLabel}</p>}
                   </div>
                ) : (
                  <select
                    required
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900 dark:text-white font-black uppercase"
                    value={saleForm.productName}
                    onChange={(e) => handleSaleFormChange('productName', e.target.value)}
                  >
                    <option value="">-- PILIH BARANG & VARIAN --</option>
                    {availableToSellItems.map(i => {
                      const label = i.sub ? `${i.name} (${i.sub})` : i.name;
                      const value = `${i.name}|||${i.sub}`;
                      return (
                        <option key={value} value={value}>{label} (STOK: {formatQty(i.total)})</option>
                      );
                    })}
                  </select>
                )}
              </div>

              {!showEditSaleModal && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Terima Pembayaran Ke</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleSaleFormChange('paymentMethod', 'CASH')} className={`py-2 rounded-xl border-2 transition-all font-black text-[9px] flex items-center justify-center gap-1.5 uppercase ${saleForm.paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><Wallet size={12} /> Tunai</button>
                    <button type="button" onClick={() => handleSaleFormChange('paymentMethod', 'BANK')} className={`py-2 rounded-xl border-2 transition-all font-black text-[9px] flex items-center justify-center gap-1.5 uppercase ${saleForm.paymentMethod === 'BANK' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><BankIcon size={12} /> Bank</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Jumlah</label>
                  <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-black text-slate-900 dark:text-white" value={saleForm.quantity} onChange={(e) => handleSaleFormChange('quantity', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tanggal</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[10px] font-black text-slate-900 dark:text-white" value={saleForm.manualDate} onChange={(e) => handleSaleFormChange('manualDate', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Harga Satuan</label>
                  <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-black text-slate-900 dark:text-white" value={saleForm.price} onChange={(e) => handleSaleFormChange('price', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-emerald-600 uppercase tracking-widest ml-1">Total Pendapatan</label>
                  <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-3 bg-emerald-50/50 dark:bg-emerald-500/10 border-2 border-emerald-100 dark:border-emerald-500/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs font-black text-emerald-900 dark:text-emerald-100" value={saleForm.totalPrice} onChange={(e) => handleSaleFormChange('totalPrice', e.target.value)} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowDirectModal(false); setShowEditSaleModal(null); }} className="flex-1 py-4 text-slate-500 font-black hover:bg-slate-100 rounded-2xl transition-all uppercase text-[10px] tracking-widest">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase text-[10px] tracking-widest">
                  {showEditSaleModal ? 'Update Penjualan' : 'Simpan Penjualan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pelunasan DP Akun Modal */}
      {showCompleteDPModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-6 py-4 border-b dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-500/5">
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Pilih Akun Pelunasan</h3>
            </div>
            <form onSubmit={handleCompleteDPSubmit} className="p-6 space-y-4">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center">
                Sisa tagihan sebesar <span className="text-emerald-600 font-black">{formatIDR(showCompleteDPModal.totalAmount - showCompleteDPModal.dpAmount)}</span> dibayarkan melalui akun mana?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setCompleteDPAccount('CASH')} className={`py-3 rounded-xl border-2 transition-all font-black text-[9px] flex flex-col items-center gap-2 uppercase ${completeDPAccount === 'CASH' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                  <Wallet size={20} />
                  Tunai
                </button>
                <button type="button" onClick={() => setCompleteDPAccount('BANK')} className={`py-3 rounded-xl border-2 transition-all font-black text-[9px] flex flex-col items-center gap-2 uppercase ${completeDPAccount === 'BANK' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                  <BankIcon size={20} />
                  Bank
                </button>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCompleteDPModal(null)} className="flex-1 py-3 text-slate-400 font-black uppercase text-[9px]">Batal</button>
                <button type="submit" className="flex-[2] py-3 bg-emerald-600 text-white font-black rounded-xl shadow-lg uppercase text-[9px] transition-all">Konfirmasi Lunas</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Modal */}
      {(showDPModal || showEditDPModal) && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="px-8 py-5 border-b dark:border-slate-800 flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {showEditDPModal ? 'Edit Order Pre-Order' : 'Buka Order Baru (PO)'}
              </h3>
              <button onClick={() => { setShowDPModal(false); setShowEditDPModal(null); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                <Plus className="rotate-45 text-slate-400" size={24} />
              </button>
            </div>
            <form onSubmit={showEditDPModal ? handleEditDPSubmit : handleSubmitDP} className="p-8 space-y-5">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Customer</label>
                <input required type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-black text-slate-900 dark:text-white uppercase" value={dpForm.customerName} onChange={(e) => handleDPFormChange('customerName', e.target.value.toUpperCase())} />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Barang Yang Dipesan</label>
                <input required type="text" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-black text-slate-900 dark:text-white uppercase" value={dpForm.productName} onChange={(e) => handleDPFormChange('productName', e.target.value.toUpperCase())} />
              </div>

              {!showEditDPModal && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Simpan DP Ke Akun</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleDPFormChange('paymentMethod', 'CASH')} className={`py-2 rounded-xl border-2 transition-all font-black text-[9px] flex items-center justify-center gap-1.5 uppercase ${dpForm.paymentMethod === 'CASH' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><Wallet size={12} /> Tunai</button>
                    <button type="button" onClick={() => handleDPFormChange('paymentMethod', 'BANK')} className={`py-2 rounded-xl border-2 transition-all font-black text-[9px] flex items-center justify-center gap-1.5 uppercase ${dpForm.paymentMethod === 'BANK' ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700' : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-400'}`}><BankIcon size={12} /> Bank</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Qty</label>
                  <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-black text-slate-900 dark:text-white" value={dpForm.quantity} onChange={(e) => handleDPFormChange('quantity', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Tanggal</label>
                  <input type="date" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-[10px] font-black text-slate-900 dark:text-white" value={dpForm.manualDate} onChange={(e) => handleDPFormChange('manualDate', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Total Nilai Order</label>
                  <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-black text-slate-900 dark:text-white" value={dpForm.totalAmount} onChange={(e) => handleDPFormChange('totalAmount', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-blue-600 uppercase tracking-widest ml-1">DP Masuk</label>
                  <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-3 bg-blue-50/50 dark:bg-blue-500/10 border-2 border-blue-100 dark:border-blue-500/20 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs font-black text-blue-900 dark:text-blue-100" value={dpForm.dpAmount} onChange={(e) => handleDPFormChange('dpAmount', e.target.value)} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowDPModal(false); setShowEditDPModal(null); }} className="flex-1 py-4 text-slate-500 font-black hover:bg-slate-100 rounded-2xl transition-all uppercase text-[10px] tracking-widest">Batal</button>
                <button type="submit" className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95 uppercase text-[10px] tracking-widest">
                  {showEditDPModal ? 'Update Order' : 'Buka Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sales;
