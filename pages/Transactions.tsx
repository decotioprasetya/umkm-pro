
import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { Wallet, Search, ArrowUpCircle, ArrowDownCircle, Plus, Filter, Trash2, Coins, Package, XCircle, ChevronRight, Edit3, Calendar, HandCoins, Landmark, AlertCircle, Info, History, TrendingUp, Scale, Lock, Landmark as BankIcon, ArrowRightLeft } from 'lucide-react';
import { TransactionType, TransactionCategory, Transaction, Loan } from '../types';

const Transactions: React.FC = () => {
  const { state, addManualTransaction, updateTransaction, deleteTransaction, transferFunds, addLoan, updateLoan, repayLoan, deleteLoan } = useApp();
  const [activeTab, setActiveTab] = useState<'HISTORY' | 'LOANS'>('HISTORY');
  const [filter, setFilter] = useState<TransactionType | 'ALL'>('ALL');
  const [accountFilter, setAccountFilter] = useState<'ALL' | 'CASH' | 'BANK'>('ALL');
  const [search, setSearch] = useState('');
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  
  const [showManualModal, setShowManualModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<Transaction | null>(null);
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [showEditLoanModal, setShowEditLoanModal] = useState<Loan | null>(null);
  const [showRepayModal, setShowRepayModal] = useState<string | null>(null);

  // Manual Tx Form
  const [manualForm, setManualForm] = useState({
    type: TransactionType.CASH_OUT,
    category: '',
    amount: '' as string | number,
    description: '',
    paymentMethod: 'CASH' as 'CASH' | 'BANK',
    manualDate: new Date().toISOString().split('T')[0]
  });

  // Transfer Form
  const [transferForm, setTransferForm] = useState({
    amount: '' as string | number,
    from: 'CASH' as 'CASH' | 'BANK',
    to: 'BANK' as 'CASH' | 'BANK',
    note: '',
    manualDate: new Date().toISOString().split('T')[0]
  });

  // Edit Tx Form
  const [editForm, setEditForm] = useState({
    category: '',
    description: '',
    amount: '' as string | number,
    paymentMethod: 'CASH' as 'CASH' | 'BANK',
    manualDate: ''
  });

  // Loan Form
  const [loanForm, setLoanForm] = useState({
    source: '',
    initialAmount: '' as string | number,
    note: '',
    paymentMethod: 'CASH' as 'CASH' | 'BANK',
    manualDate: new Date().toISOString().split('T')[0]
  });

  // Repayment Form
  const [repayForm, setRepayForm] = useState({
    principal: '' as string | number,
    interest: '' as string | number,
    paymentMethod: 'CASH' as 'CASH' | 'BANK',
    manualDate: new Date().toISOString().split('T')[0]
  });

  const sanitizeNumeric = (val: string) => {
    let sanitized = val.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) sanitized = parts[0] + '.' + parts.slice(1).join('');
    return sanitized;
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const formatDateLabel = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const parseManualDate = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };

  const getSourceLabel = (t: Transaction) => {
    if (!t.relatedId) return null;
    switch (t.category) {
      case TransactionCategory.STOCK_PURCHASE: return "STOK";
      case TransactionCategory.SALES: return "PENJUALAN";
      case TransactionCategory.PRODUCTION_COST: return "PRODUKSI";
      case TransactionCategory.DEPOSIT:
      case TransactionCategory.FORFEITED_DP: return "ORDER DP";
      case TransactionCategory.LOAN_PROCEEDS:
      case TransactionCategory.LOAN_REPAYMENT: return "PINJAMAN";
      case TransactionCategory.TRANSFER: return "TRANSFER";
      default: 
        if (t.description.includes("BUNGA PINJAMAN")) return "PINJAMAN";
        return "MODUL";
    }
  };

  const totalIncome = state.transactions
    .filter(t => t.type === TransactionType.CASH_IN)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = state.transactions
    .filter(t => t.type === TransactionType.CASH_OUT)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalCash = totalIncome - totalExpense;
  const cashOnly = state.transactions
    .filter(t => t.paymentMethod === 'CASH' || !t.paymentMethod) // legacy support
    .reduce((sum, t) => t.type === TransactionType.CASH_IN ? sum + t.amount : sum - t.amount, 0);
  const bankOnly = state.transactions
    .filter(t => t.paymentMethod === 'BANK')
    .reduce((sum, t) => t.type === TransactionType.CASH_IN ? sum + t.amount : sum - t.amount, 0);

  const totalDebt = state.loans.reduce((sum, l) => sum + l.remainingAmount, 0);
  const totalInventoryValue = state.batches.reduce((sum, b) => sum + (b.currentQuantity * b.buyPrice), 0);
  const netWealth = (totalCash + totalInventoryValue) - totalDebt;

  const filteredTransactions = useMemo(() => {
    const startTs = parseManualDate(startDateStr);
    const endTs = parseManualDate(endDateStr);

    return state.transactions.filter(t => {
      if (filter !== 'ALL' && t.type !== filter) return false;
      if (accountFilter !== 'ALL' && (t.paymentMethod || 'CASH') !== accountFilter) return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      const txDate = new Date(t.createdAt);
      const txMid = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate()).getTime();
      if (startTs && txMid < startTs) return false;
      if (endTs && txMid > endTs) return false;
      return true;
    }).sort((a, b) => b.createdAt - a.createdAt);
  }, [state.transactions, filter, accountFilter, search, startDateStr, endDateStr]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(manualForm.amount);
    if (amount > 0 && manualForm.description && manualForm.category) {
      const parsedDate = parseManualDate(manualForm.manualDate);
      const customTimestamp = parsedDate || Date.now();
      addManualTransaction({
        type: manualForm.type,
        category: manualForm.category as TransactionCategory,
        amount,
        description: manualForm.description,
        paymentMethod: manualForm.paymentMethod
      }, customTimestamp);
      setShowManualModal(false);
      setManualForm({ type: TransactionType.CASH_OUT, category: '', amount: '', description: '', paymentMethod: 'CASH', manualDate: new Date().toISOString().split('T')[0] });
    }
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(transferForm.amount);
    if (amount > 0 && transferForm.from !== transferForm.to) {
      const parsedDate = parseManualDate(transferForm.manualDate);
      transferFunds(amount, transferForm.from, transferForm.to, transferForm.note, parsedDate || undefined);
      setShowTransferModal(false);
      setTransferForm({ amount: '', from: 'CASH', to: 'BANK', note: '', manualDate: new Date().toISOString().split('T')[0] });
    } else {
      alert("Akun sumber dan tujuan tidak boleh sama.");
    }
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showEditModal) {
      const amount = Number(editForm.amount);
      const parsedDate = parseManualDate(editForm.manualDate);
      const customTimestamp = parsedDate || showEditModal.createdAt;
      updateTransaction(showEditModal.id, {
        category: editForm.category as TransactionCategory,
        description: editForm.description,
        amount,
        paymentMethod: editForm.paymentMethod,
        createdAt: customTimestamp
      });
      setShowEditModal(null);
    }
  };

  const handleLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(loanForm.initialAmount);
    if (amount > 0 && loanForm.source) {
      const parsedDate = parseManualDate(loanForm.manualDate);
      const customTimestamp = parsedDate || Date.now();
      addLoan({ source: loanForm.source, initialAmount: amount, note: loanForm.note }, customTimestamp, loanForm.paymentMethod);
      setShowLoanModal(false);
      setLoanForm({ source: '', initialAmount: '', note: '', paymentMethod: 'CASH', manualDate: new Date().toISOString().split('T')[0] });
    }
  };

  const handleEditLoanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (showEditLoanModal) {
      const amount = Number(loanForm.initialAmount);
      const parsedDate = parseManualDate(loanForm.manualDate);
      const customTimestamp = parsedDate || showEditLoanModal.createdAt;
      updateLoan(showEditLoanModal.id, {
        source: loanForm.source,
        initialAmount: amount,
        note: loanForm.note
      }, loanForm.paymentMethod, customTimestamp);
      setShowEditLoanModal(null);
      setLoanForm({ source: '', initialAmount: '', note: '', paymentMethod: 'CASH', manualDate: new Date().toISOString().split('T')[0] });
    }
  };

  const handleRepaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const principal = Number(repayForm.principal);
    const interest = Number(repayForm.interest);
    if (showRepayModal && (principal > 0 || interest >= 0)) {
      if (principal <= 0 && interest <= 0) {
        alert("Nominal pembayaran harus lebih dari 0.");
        return;
      }
      const parsedDate = parseManualDate(repayForm.manualDate);
      const customTimestamp = parsedDate || Date.now();
      repayLoan(showRepayModal, principal, interest, customTimestamp, repayForm.paymentMethod);
      setShowRepayModal(null);
      setRepayForm({ principal: '', interest: '', paymentMethod: 'CASH', manualDate: new Date().toISOString().split('T')[0] });
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6 animate-in fade-in duration-500">
      
      {/* Header Stat Board */}
      <div className="bg-slate-900 text-white p-5 lg:p-8 rounded-[1.5rem] lg:rounded-[2.5rem] shadow-2xl flex flex-col gap-6 border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 lg:gap-10">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-400">
                <Coins size={28} strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-blue-300 text-[10px] font-black uppercase tracking-[0.2em] leading-none mb-1.5 text-blue-400/80">Saldo Kas Gabungan</p>
                <h2 className="text-2xl lg:text-4xl font-black tracking-tighter leading-none">{formatIDR(totalCash)}</h2>
              </div>
            </div>
            
            <div className="flex gap-4 lg:gap-8 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-800 md:pl-8">
              <div className="flex-1 lg:flex-none">
                <p className="text-slate-500 text-[8px] lg:text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                  <span className="w-1 h-1 bg-emerald-500 rounded-full"></span> Tunai (Cash)
                </p>
                <p className="text-sm lg:text-base font-black text-emerald-400 tracking-tight">{formatIDR(cashOnly)}</p>
              </div>
              <div className="flex-1 lg:flex-none">
                <p className="text-slate-500 text-[8px] lg:text-[9px] font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                  <span className="w-1 h-1 bg-blue-500 rounded-full"></span> Bank (Transfer)
                </p>
                <p className="text-sm lg:text-base font-black text-blue-400 tracking-tight">{formatIDR(bankOnly)}</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2.5 w-full lg:w-auto">
            <button 
              onClick={() => setShowManualModal(true)}
              className="flex-1 lg:flex-none bg-slate-800 hover:bg-slate-700 text-white px-5 py-3.5 rounded-xl lg:rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 text-[10px] uppercase tracking-widest border border-slate-700"
            >
              <Plus size={16} strokeWidth={3} />
              <span>Kas Manual</span>
            </button>
            <button 
              onClick={() => setShowTransferModal(true)}
              className="flex-1 lg:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3.5 rounded-xl lg:rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
            >
              <ArrowRightLeft size={16} strokeWidth={3} />
              <span>Pindah Dana</span>
            </button>
            <button 
              onClick={() => setShowLoanModal(true)}
              className="flex-1 lg:flex-none bg-blue-600 hover:bg-blue-700 text-white px-5 py-3.5 rounded-xl lg:rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-blue-500/20 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
            >
              <HandCoins size={16} strokeWidth={3} />
              <span>Pinjaman</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid Status */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"><Wallet size={16} /></div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Kas Tunai</p>
            <p className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white tracking-tight truncate">{formatIDR(totalCash)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"><Package size={16} /></div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Nilai Stok</p>
            <p className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white tracking-tight truncate">{formatIDR(totalInventoryValue)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"><Landmark size={16} /></div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 text-rose-500">Total Hutang</p>
            <p className="text-[10px] lg:text-xs font-black text-rose-600 dark:text-rose-400 tracking-tight truncate">{formatIDR(totalDebt)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><ArrowUpCircle size={16} /></div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Masuk</p>
            <p className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white tracking-tight truncate">{formatIDR(totalIncome)}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"><ArrowDownCircle size={16} /></div>
          <div className="min-w-0">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Total Keluar</p>
            <p className="text-[10px] lg:text-xs font-black text-slate-900 dark:text-white tracking-tight truncate">{formatIDR(totalExpense)}</p>
          </div>
        </div>
        <div className="bg-slate-900 dark:bg-blue-600 p-3 rounded-2xl border border-slate-800 dark:border-blue-500 shadow-lg flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/10 text-white"><Scale size={16} /></div>
          <div className="min-w-0 text-white">
            <p className="text-[8px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">Kekayaan Bersih</p>
            <p className="text-[10px] lg:text-xs font-black tracking-tight truncate">{formatIDR(netWealth)}</p>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-100 dark:border-slate-800 w-fit">
        <button 
          onClick={() => setActiveTab('HISTORY')}
          className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'HISTORY' 
            ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-lg' 
            : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Riwayat Kas
        </button>
        <button 
          onClick={() => setActiveTab('LOANS')}
          className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'LOANS' 
            ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-lg' 
            : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          Daftar Pinjaman
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden min-h-[300px]">
        {activeTab === 'HISTORY' ? (
          <>
            <div className="p-4 border-b border-slate-50 dark:border-slate-800 flex flex-col xl:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="CARI DESKRIPSI..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-[10px] uppercase text-black dark:text-white font-black transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value.toUpperCase())}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                 <div className="flex items-center gap-2">
                    <div className="flex flex-col">
                      <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-0.5">Mulai</label>
                      <input 
                        type="date" 
                        className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-[9px] font-black text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                        value={startDateStr}
                        onChange={(e) => setStartDateStr(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-0.5">Sampai</label>
                      <input 
                        type="date" 
                        className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-1.5 text-[9px] font-black text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                        value={endDateStr}
                        onChange={(e) => setEndDateStr(e.target.value)}
                      />
                    </div>
                 </div>

                 <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-3 xl:pt-0">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      {['ALL', 'CASH', 'BANK'].map(btn => (
                        <button 
                          key={btn}
                          onClick={() => setAccountFilter(btn as any)}
                          className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all ${accountFilter === btn ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm' : 'text-slate-400'}`}
                        >
                          {btn}
                        </button>
                      ))}
                    </div>
                    
                    <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1"></div>

                    {[
                      { id: 'ALL', label: 'SEMUA' },
                      { id: TransactionType.CASH_IN, label: 'MASUK' },
                      { id: TransactionType.CASH_OUT, label: 'KELUAR' }
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setFilter(btn.id as any)}
                        className={`px-4 py-2 rounded-lg text-[8px] font-black uppercase transition-all border-2 whitespace-nowrap ${
                          filter === btn.id 
                          ? 'bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-600 text-white shadow-sm' 
                          : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-800 text-slate-400'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
              </div>
            </div>

            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[8px] uppercase font-black tracking-widest border-b dark:border-slate-800">
                    <th className="px-6 py-4">Akun</th>
                    <th className="px-6 py-4">Tanggal</th>
                    <th className="px-6 py-4">Kategori</th>
                    <th className="px-6 py-4">Deskripsi</th>
                    <th className="px-6 py-4 text-right">Nominal</th>
                    <th className="px-6 py-4 text-center">Aksi / Sumber</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {filteredTransactions.map((t) => {
                    const source = getSourceLabel(t);
                    return (
                      <tr key={t.id} className="hover:bg-slate-50/30 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className={`flex items-center gap-2 px-2 py-1 rounded-lg w-fit ${
                            (t.paymentMethod || 'CASH') === 'CASH' 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : 'bg-blue-50 text-blue-600 border border-blue-100'
                          }`}>
                            {(t.paymentMethod || 'CASH') === 'CASH' ? <Wallet size={12} /> : <BankIcon size={12} />}
                            <span className="text-[8px] font-black uppercase tracking-widest">{t.paymentMethod || 'CASH'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[10px] font-black text-slate-900 dark:text-slate-200 uppercase whitespace-nowrap">
                            {formatDateLabel(t.createdAt)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded text-[7px] font-black uppercase border ${
                            t.category === TransactionCategory.SALES ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            t.category === TransactionCategory.LOAN_PROCEEDS ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            t.category === TransactionCategory.LOAN_REPAYMENT ? 'bg-orange-50 text-orange-600 border-orange-100' :
                            t.category === TransactionCategory.TRANSFER ? 'bg-slate-900 text-white border-slate-700' :
                            'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            {t.category.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[9px] font-black text-slate-900 dark:text-slate-200 uppercase leading-tight">{t.description}</p>
                          <p className="text-[7px] text-slate-400 font-bold uppercase mt-1">Ref ID: {t.id.slice(0, 8)}</p>
                        </td>
                        <td className={`px-6 py-4 text-right font-black text-[10px] tracking-tighter ${t.type === TransactionType.CASH_IN ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {t.type === TransactionType.CASH_IN ? '+' : '-'}{formatIDR(t.amount)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {source ? (
                             <div className="flex flex-col items-center gap-1">
                                <span className="bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-300 px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-widest border border-slate-700 flex items-center gap-1 shadow-sm">
                                  <Lock size={8} /> {source}
                                </span>
                             </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <button 
                                onClick={() => {
                                  setEditForm({
                                    category: t.category,
                                    description: t.description,
                                    amount: t.amount,
                                    paymentMethod: t.paymentMethod || 'CASH',
                                    manualDate: new Date(t.createdAt).toISOString().split('T')[0]
                                  });
                                  setShowEditModal(t);
                                }}
                                className="p-1.5 text-slate-300 hover:text-blue-500 transition-all"
                              >
                                <Edit3 size={16} />
                              </button>
                              <button 
                                onClick={() => deleteTransaction(t.id)}
                                className="p-1.5 text-slate-300 hover:text-rose-500 transition-all"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-16 text-center text-slate-400 opacity-30">
                        <History size={40} className="mx-auto mb-2" />
                        <p className="text-[9px] font-black uppercase tracking-widest">Data tidak ditemukan</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {state.loans.map((loan) => (
                <div key={loan.id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] p-5 space-y-3 hover:border-blue-200 transition-all group">
                  <div className="flex justify-between items-start">
                    <div className="p-2.5 bg-white dark:bg-slate-700 rounded-xl text-blue-600 shadow-sm"><Landmark size={18} /></div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          const tx = state.transactions.find(t => t.relatedId === loan.id && t.category === TransactionCategory.LOAN_PROCEEDS);
                          setLoanForm({
                            source: loan.source,
                            initialAmount: loan.initialAmount.toString(),
                            note: loan.note,
                            paymentMethod: tx?.paymentMethod || 'CASH',
                            manualDate: new Date(loan.createdAt).toISOString().split('T')[0]
                          });
                          setShowEditLoanModal(loan);
                        }}
                        className="p-1.5 text-slate-300 hover:text-blue-500 transition-all"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button 
                        onClick={() => deleteLoan(loan.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{loan.source}</h4>
                    <div className="flex justify-between items-center">
                       <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Awal: {formatIDR(loan.initialAmount)}</p>
                       <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">{formatDateLabel(loan.createdAt)}</p>
                    </div>
                  </div>

                  <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                    <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Sisa Hutang Pokok</p>
                    <p className="text-lg font-black text-rose-600 tracking-tighter">{formatIDR(loan.remainingAmount)}</p>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setRepayForm({ principal: '', interest: '', paymentMethod: 'CASH', manualDate: new Date().toISOString().split('T')[0] });
                        setShowRepayModal(loan.id);
                      }}
                      disabled={loan.remainingAmount <= 0}
                      className="flex-1 bg-slate-900 hover:bg-black text-white py-2.5 rounded-xl font-black text-[8px] uppercase tracking-widest transition-all disabled:opacity-30"
                    >
                      Bayar Cicilan
                    </button>
                  </div>
                </div>
              ))}
              
              <button 
                onClick={() => {
                  setLoanForm({ source: '', initialAmount: '', note: '', paymentMethod: 'CASH', manualDate: new Date().toISOString().split('T')[0] });
                  setShowLoanModal(true);
                }}
                className="border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[1.5rem] p-8 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-blue-500 hover:text-blue-500 transition-all"
              >
                <Plus size={24} />
                <span className="text-[9px] font-black uppercase tracking-widest">Pinjaman Baru</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Transaction Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-slate-900 dark:text-white">
            <div className="px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-base font-black uppercase tracking-tight">Catat Kas Manual</h3>
              <button onClick={() => setShowManualModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"><Plus className="rotate-45" size={20} /></button>
            </div>
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setManualForm({...manualForm, type: TransactionType.CASH_IN})} className={`py-2 rounded-xl border-2 font-black text-[9px] uppercase transition-all ${manualForm.type === TransactionType.CASH_IN ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>Masuk</button>
                <button type="button" onClick={() => setManualForm({...manualForm, type: TransactionType.CASH_OUT})} className={`py-2 rounded-xl border-2 font-black text-[9px] uppercase transition-all ${manualForm.type === TransactionType.CASH_OUT ? 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>Keluar</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setManualForm({...manualForm, paymentMethod: 'CASH'})} className={`py-2 rounded-xl border-2 font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 ${manualForm.paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-500/10' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}><Wallet size={12}/> Tunai/Cash</button>
                <button type="button" onClick={() => setManualForm({...manualForm, paymentMethod: 'BANK'})} className={`py-2 rounded-xl border-2 font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 ${manualForm.paymentMethod === 'BANK' ? 'bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-500/10' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}><BankIcon size={12}/> Bank/Transfer</button>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Kategori</label>
                <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all" value={manualForm.category} onChange={(e) => setManualForm({...manualForm, category: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Nominal</label>
                <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-lg font-black transition-all" value={manualForm.amount} onChange={(e) => setManualForm({...manualForm, amount: sanitizeNumeric(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Keterangan</label>
                <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all" value={manualForm.description} onChange={(e) => setManualForm({...manualForm, description: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Tanggal</label>
                <input type="date" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black transition-all" value={manualForm.manualDate} onChange={(e) => setManualForm({...manualForm, manualDate: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowManualModal(false)} className="flex-1 py-3 text-slate-400 font-black uppercase text-[9px]">Batal</button>
                <button type="submit" className="flex-[2] py-3 bg-slate-900 dark:bg-blue-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg transition-all active:scale-95">Simpan Data</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Fund Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-slate-900 dark:text-white">
            <div className="px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-500/5">
              <h3 className="text-base font-black uppercase tracking-tight">Pindah Dana / Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"><Plus className="rotate-45" size={20} /></button>
            </div>
            <form onSubmit={handleTransferSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase">Dari Akun</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all"
                    value={transferForm.from}
                    onChange={(e) => setTransferForm({...transferForm, from: e.target.value as any, to: e.target.value === 'CASH' ? 'BANK' : 'CASH'})}
                  >
                    <option value="CASH">TUNAI (CASH)</option>
                    <option value="BANK">BANK (TRANSFER)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black text-slate-500 uppercase">Ke Akun</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all"
                    value={transferForm.to}
                    onChange={(e) => setTransferForm({...transferForm, to: e.target.value as any, from: e.target.value === 'CASH' ? 'BANK' : 'CASH'})}
                  >
                    <option value="CASH">TUNAI (CASH)</option>
                    <option value="BANK">BANK (TRANSFER)</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Nominal Transfer</label>
                <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-lg font-black transition-all" value={transferForm.amount} onChange={(e) => setTransferForm({...transferForm, amount: sanitizeNumeric(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Catatan Transfer</label>
                <input type="text" placeholder="MISAL: SETOR TUNAI KE BANK" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all" value={transferForm.note} onChange={(e) => setTransferForm({...transferForm, note: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Tanggal</label>
                <input type="date" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black transition-all" value={transferForm.manualDate} onChange={(e) => setTransferForm({...transferForm, manualDate: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowTransferModal(false)} className="flex-1 py-3 text-slate-400 font-black uppercase text-[9px]">Batal</button>
                <button type="submit" className="flex-[2] py-3 bg-emerald-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg transition-all active:scale-95">Proses Transfer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-slate-900 dark:text-white">
            <div className="px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/5">
              <h3 className="text-base font-black uppercase tracking-tight">Edit Transaksi Kas</h3>
              <button onClick={() => setShowEditModal(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all"><Plus className="rotate-45" size={20} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setEditForm({...editForm, paymentMethod: 'CASH'})} className={`py-2 rounded-xl border-2 font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 ${editForm.paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-100 text-slate-400'}`}><Wallet size={12}/> Cash</button>
                <button type="button" onClick={() => setEditForm({...editForm, paymentMethod: 'BANK'})} className={`py-2 rounded-xl border-2 font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 ${editForm.paymentMethod === 'BANK' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-100 text-slate-400'}`}><BankIcon size={12}/> Bank</button>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Kategori</label>
                <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all" value={editForm.category} onChange={(e) => setEditForm({...editForm, category: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Nominal</label>
                <input required type="text" inputMode="decimal" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-lg font-black transition-all" value={editForm.amount} onChange={(e) => setEditForm({...editForm, amount: sanitizeNumeric(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Keterangan</label>
                <input required type="text" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all" value={editForm.description} onChange={(e) => setEditForm({...editForm, description: e.target.value.toUpperCase()})} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-slate-500 uppercase">Tanggal</label>
                <input type="date" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black transition-all" value={editForm.manualDate} onChange={(e) => setEditForm({...editForm, manualDate: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowEditModal(null)} className="flex-1 py-3 text-slate-400 font-black uppercase text-[9px]">Batal</button>
                <button type="submit" className="flex-[2] py-3 bg-blue-600 text-white font-black rounded-xl uppercase text-[9px] shadow-lg transition-all active:scale-95">Update Data</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan Modal (New & Edit) */}
      {(showLoanModal || showEditLoanModal) && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-slate-900 dark:text-white">
            <div className="px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between bg-blue-50/50 dark:bg-blue-500/5">
              <h3 className="text-base font-black uppercase tracking-tight">{showEditLoanModal ? 'Edit Pinjaman' : 'Catat Pinjaman Baru'}</h3>
              <button onClick={() => { setShowLoanModal(false); setShowEditLoanModal(null); }} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all text-slate-400"><Plus className="rotate-45" size={20} /></button>
            </div>
            <form onSubmit={showEditLoanModal ? handleEditLoanSubmit : handleLoanSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setLoanForm({...loanForm, paymentMethod: 'CASH'})} className={`py-2 rounded-xl border-2 font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 ${loanForm.paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}><Wallet size={12}/> Tunai</button>
                <button type="button" onClick={() => setLoanForm({...loanForm, paymentMethod: 'BANK'})} className={`py-2 rounded-xl border-2 font-black text-[9px] uppercase transition-all flex items-center justify-center gap-2 ${loanForm.paymentMethod === 'BANK' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}><BankIcon size={12}/> Bank</button>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest ml-1">Sumber Pinjaman</label>
                <input required type="text" placeholder="MISAL: BANK MANDIRI, KOLEGA..." className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all" value={loanForm.source} onChange={(e) => setLoanForm({...loanForm, source: e.target.value.toUpperCase()})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest ml-1">Nilai Awal (Pokok)</label>
                  <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-lg font-black transition-all" value={loanForm.initialAmount} onChange={(e) => setLoanForm({...loanForm, initialAmount: sanitizeNumeric(e.target.value)})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] font-black uppercase tracking-widest ml-1">Tanggal</label>
                  <input type="date" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black transition-all" value={loanForm.manualDate} onChange={(e) => setLoanForm({...loanForm, manualDate: e.target.value})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest ml-1">Catatan</label>
                <input type="text" placeholder="..." className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black uppercase transition-all" value={loanForm.note} onChange={(e) => setLoanForm({...loanForm, note: e.target.value.toUpperCase()})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowLoanModal(false); setShowEditLoanModal(null); }} className="flex-1 py-3 text-slate-400 font-black uppercase text-[9px]">Batal</button>
                <button type="submit" className="flex-[2] py-3 bg-blue-600 text-white font-black rounded-xl shadow-lg uppercase text-[9px] transition-all active:scale-95">{showEditLoanModal ? 'Simpan Perubahan' : 'Terima Dana'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {showRepayModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in duration-200 text-slate-900 dark:text-white">
            <div className="px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between bg-orange-50/50 dark:bg-orange-500/5">
              <h3 className="text-base font-black uppercase tracking-tight">Bayar Cicilan / Pelunasan</h3>
              <button onClick={() => setShowRepayModal(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-all text-slate-400"><Plus className="rotate-45" size={20} /></button>
            </div>
            <form onSubmit={handleRepaySubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setRepayForm({...repayForm, paymentMethod: 'CASH'})} className={`py-2 rounded-xl border-2 font-black text-[9px] uppercase transition-all ${repayForm.paymentMethod === 'CASH' ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'border-slate-100 text-slate-400'}`}>Potong Cash</button>
                <button type="button" onClick={() => setRepayForm({...repayForm, paymentMethod: 'BANK'})} className={`py-2 rounded-xl border-2 font-black text-[9px] uppercase transition-all ${repayForm.paymentMethod === 'BANK' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-slate-100 text-slate-400'}`}>Potong Bank</button>
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest ml-1">Bayar Pokok</label>
                <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black transition-all" value={repayForm.principal} onChange={(e) => setRepayForm({...repayForm, principal: sanitizeNumeric(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black text-rose-600 uppercase tracking-widest ml-1">Bunga</label>
                <input required type="text" inputMode="decimal" placeholder="0" className="w-full px-4 py-2.5 bg-rose-50/50 dark:bg-rose-500/10 border-2 border-rose-100 dark:border-rose-500/20 rounded-xl text-[10px] font-black transition-all" value={repayForm.interest} onChange={(e) => setRepayForm({...repayForm, interest: sanitizeNumeric(e.target.value)})} />
              </div>
              <div className="space-y-1">
                <label className="text-[8px] font-black uppercase tracking-widest ml-1">Tanggal</label>
                <input type="date" className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] font-black transition-all" value={repayForm.manualDate} onChange={(e) => setRepayForm({...repayForm, manualDate: e.target.value})} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowRepayModal(null)} className="flex-1 py-3 text-slate-400 font-black uppercase text-[9px]">Batal</button>
                <button type="submit" className="flex-[2] py-3 bg-orange-600 text-white font-black rounded-xl shadow-lg uppercase text-[9px] transition-all active:scale-95">Konfirmasi Bayar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
