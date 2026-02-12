
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase, isCloudReady } from './supabase';
import { 
  AppState, Batch, ProductionRecord, SaleRecord, Transaction, 
  StockType, TransactionType, TransactionCategory, ProductionUsage, AppSettings, ProductionStatus,
  DPOrder, DPStatus, Loan, BatchVariant, ProductionIngredient
} from './types';

interface AppContextType {
  state: AppState;
  addBatch: (data: Omit<Batch, 'id' | 'createdAt'>, customDate?: number, paymentMethod?: 'CASH' | 'BANK') => Promise<void>;
  updateBatch: (id: string, data: Partial<Batch>) => Promise<void>;
  deleteBatch: (id: string) => Promise<void>;
  runProduction: (
    productName: string, 
    quantity: number, 
    ingredients: { productName: string, quantity: number }[],
    operationalCosts: { amount: number, description: string, paymentMethod: 'CASH' | 'BANK' }[],
    customDate?: number
  ) => Promise<void>;
  updateProduction: (id: string, data: Partial<ProductionRecord>) => Promise<void>;
  completeProduction: (id: string, actualQuantity: number, ingredients: ProductionIngredient[], variants?: BatchVariant[]) => Promise<void>;
  deleteProduction: (id: string) => Promise<void>;
  runSale: (productName: string, quantity: number, pricePerUnit: number, customDate?: number, variantLabel?: string, paymentMethod?: 'CASH' | 'BANK') => Promise<void>;
  updateSale: (id: string, data: Partial<SaleRecord>) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  addDPOrder: (data: Omit<DPOrder, 'id' | 'createdAt' | 'status'>, customDate?: number, paymentMethod?: 'CASH' | 'BANK') => Promise<void>;
  updateDPOrder: (id: string, data: Partial<DPOrder>) => Promise<void>;
  completeDPOrder: (id: string, customDate?: number, paymentMethod?: 'CASH' | 'BANK') => Promise<void>;
  cancelDPOrder: (id: string, customDate?: number) => Promise<void>;
  deleteDPOrder: (id: string) => Promise<void>;
  addManualTransaction: (data: Omit<Transaction, 'id' | 'createdAt'>, customDate?: number) => Promise<void>;
  updateTransaction: (id: string, data: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  transferFunds: (amount: number, from: 'CASH' | 'BANK', to: 'CASH' | 'BANK', note: string, customDate?: number) => Promise<void>;
  addLoan: (data: Omit<Loan, 'id' | 'createdAt' | 'remainingAmount'>, customDate?: number, paymentMethod?: 'CASH' | 'BANK') => Promise<void>;
  updateLoan: (id: string, data: Partial<Loan>, paymentMethod?: 'CASH' | 'BANK', customDate?: number) => Promise<void>;
  repayLoan: (loanId: string, principal: number, interest: number, customDate?: number, paymentMethod?: 'CASH' | 'BANK') => Promise<void>;
  deleteLoan: (id: string) => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  syncLocalToCloud: (silent?: boolean) => Promise<void>;
  fetchFromCloud: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<string | null>;
  signUp: (email: string, pass: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const STORAGE_KEY = 'umkm_pro_session_data';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    const initialData = saved ? JSON.parse(saved) : {
      batches: [],
      productions: [],
      productionUsages: [],
      sales: [],
      dpOrders: [],
      loans: [],
      transactions: [],
      settings: {
        businessName: 'UMKM KELUARGA',
        theme: 'light',
        supabaseUrl: '',
        supabaseAnonKey: '',
        useCloud: true 
      }
    };
    return { ...initialData, isSyncing: false, user: null, lastSyncTime: undefined };
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const fetchFromCloud = useCallback(async () => {
    if (!isCloudReady || !stateRef.current.user) return;
    
    setState(prev => ({ ...prev, isSyncing: true }));
    try {
      const user_id = stateRef.current.user.id;
      const [
        { data: b }, { data: p }, { data: u }, 
        { data: s }, { data: d }, { data: l }, 
        { data: t }, { data: profile }
      ] = await Promise.all([
        supabase.from('batches').select('*').eq('user_id', user_id),
        supabase.from('productions').select('*').eq('user_id', user_id),
        supabase.from('production_usages').select('*').eq('user_id', user_id),
        supabase.from('sales').select('*').eq('user_id', user_id),
        supabase.from('dp_orders').select('*').eq('user_id', user_id),
        supabase.from('loans').select('*').eq('user_id', user_id),
        supabase.from('transactions').select('*').eq('user_id', user_id),
        supabase.from('profiles').select('*').eq('id', user_id).limit(1)
      ]);

      const cloudProfile = profile && profile.length > 0 ? profile[0] : null;

      setState(prev => ({
        ...prev,
        batches: b || [],
        productions: p || [],
        productionUsages: u || [],
        sales: s || [],
        dpOrders: d || [],
        loans: l || [],
        transactions: t || [],
        settings: {
          ...prev.settings,
          businessName: cloudProfile?.business_name || prev.settings.businessName,
          theme: cloudProfile?.theme || prev.settings.theme,
        },
        isSyncing: false,
        lastSyncTime: Date.now()
      }));
    } catch (err) {
      console.error("Cloud fetch error:", err);
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, []);

  useEffect(() => {
    const { user, isSyncing, lastSyncTime, ...persistentState } = state;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistentState));
    if (state.settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state.batches, state.productions, state.productionUsages, state.sales, state.dpOrders, state.loans, state.transactions, state.settings]);

  // AUTO-SYNC (DEBOUNCED)
  useEffect(() => {
    if (!isCloudReady || !state.user || !state.settings.useCloud) return;
    const timeout = setTimeout(() => syncLocalToCloud(true), 2500);
    return () => clearTimeout(timeout);
  }, [
    state.batches, state.productions, state.productionUsages, 
    state.sales, state.dpOrders, state.loans, state.transactions,
    state.settings.businessName, state.settings.theme
  ]);

  useEffect(() => {
    if (!isCloudReady) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setState(prev => ({ ...prev, user }));
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) setState(prev => ({ ...prev, user: data.session.user }));
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (state.user) fetchFromCloud();
  }, [state.user, fetchFromCloud]);

  const signIn = async (email: string, pass: string) => {
    if (!isCloudReady) return "Cloud tidak siap.";
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    return error ? error.message : null;
  };

  const signUp = async (email: string, pass: string) => {
    if (!isCloudReady) return "Cloud tidak siap.";
    const { error } = await supabase.auth.signUp({ email, password: pass });
    return error ? error.message : null;
  };

  const logout = async () => {
    if (isCloudReady) await supabase.auth.signOut();
    setState(prev => ({ 
      ...prev, user: null, batches: [], productions: [], productionUsages: [], 
      sales: [], dpOrders: [], loans: [], transactions: [], lastSyncTime: undefined 
    }));
    sessionStorage.removeItem(STORAGE_KEY);
  };

  const syncLocalToCloud = async (silent: boolean = false) => {
    if (!isCloudReady || !stateRef.current.user) return;
    setState(prev => ({ ...prev, isSyncing: true }));
    const user_id = stateRef.current.user.id;
    const current = stateRef.current;

    const syncTable = async (tableName: string, data: any[]) => {
      try {
        let result;
        if (tableName === 'profiles') {
          result = await supabase.from('profiles').upsert({
            id: user_id, business_name: current.settings.businessName,
            theme: current.settings.theme, updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } else {
          // Hanya sync data jika ada, atau kosongkan di cloud jika lokal kosong
          const payload = data.map(item => ({ ...item, user_id }));
          result = await supabase.from(tableName).upsert(payload, { onConflict: 'id' });
        }
        if (result.error) {
          console.error(`Sync fail [${tableName}]:`, result.error.message);
          return false;
        }
        return true;
      } catch (err: any) {
        console.error(`Exception [${tableName}]:`, err.message);
        return false;
      }
    };

    const results = await Promise.all([
      syncTable('profiles', []),
      syncTable('batches', current.batches),
      syncTable('productions', current.productions),
      syncTable('production_usages', current.productionUsages),
      syncTable('sales', current.sales),
      syncTable('dp_orders', current.dpOrders),
      syncTable('loans', current.loans),
      syncTable('transactions', current.transactions)
    ]);

    const success = results.every(r => r === true);
    setState(prev => ({ ...prev, isSyncing: false, lastSyncTime: success ? Date.now() : prev.lastSyncTime }));
    if (!silent && success) alert("Sinkronisasi Berhasil!");
    if (!silent && !success) alert("Beberapa data gagal disinkronkan. Periksa koneksi atau database.");
  };

  const addManualTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>, customDate?: number) => {
    const newTx: Transaction = { ...data, id: crypto.randomUUID(), createdAt: customDate || Date.now() };
    setState(prev => ({ ...prev, transactions: [...prev.transactions, newTx] }));
  };

  // Sisa fungsi helper lainnya (addBatch, runProduction, dll) tetap sama karena hanya memodifikasi state lokal
  // yang nantinya akan dipicu oleh useEffect Auto-Sync di atas.
  
  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }));
  };

  const addBatch = async (data: Omit<Batch, 'id' | 'createdAt'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newBatch: Batch = { ...data, id: crypto.randomUUID(), createdAt: timestamp };
    const newTransaction: Transaction = {
      id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.STOCK_PURCHASE,
      amount: data.buyPrice * data.initialQuantity, description: `Beli Stok: ${data.productName}`,
      createdAt: timestamp, relatedId: newBatch.id, paymentMethod
    };
    setState(prev => ({ ...prev, batches: [...prev.batches, newBatch], transactions: [...prev.transactions, newTransaction] }));
  };

  const updateBatch = async (id: string, data: Partial<Batch>) => {
    const updatedBatches = stateRef.current.batches.map(b => b.id === id ? { ...b, ...data } : b);
    setState(prev => ({ ...prev, batches: updatedBatches }));
  };

  const deleteBatch = async (id: string) => {
    const isUsed = stateRef.current.productionUsages.some(u => u.batchId === id);
    if (isUsed) return alert("STOK INI SUDAH PERNAH DIGUNAKAN.");
    setState(prev => ({ ...prev, batches: prev.batches.filter(b => b.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
  };

  const runProduction = async (productName: string, quantity: number, ingredients: { productName: string, quantity: number }[], operationalCosts: { amount: number, description: string, paymentMethod: 'CASH' | 'BANK' }[], customDate?: number) => {
    const timestamp = customDate || Date.now();
    const productionId = crypto.randomUUID();
    const totalOpCost = operationalCosts.reduce((sum, c) => sum + c.amount, 0);
    const production: ProductionRecord = { 
      id: productionId, outputProductName: productName, outputQuantity: quantity, 
      totalHPP: totalOpCost, createdAt: timestamp, status: ProductionStatus.IN_PROGRESS, ingredients
    };
    const newTx = operationalCosts.filter(c => c.amount > 0).map(c => ({
      id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.PRODUCTION_COST,
      amount: c.amount, description: `PRODUKSI ${productName} (${c.description})`, createdAt: timestamp, relatedId: productionId, paymentMethod: c.paymentMethod
    }));
    setState(prev => ({ ...prev, productions: [...prev.productions, production], transactions: [...prev.transactions, ...newTx] }));
  };

  const updateProduction = async (id: string, data: Partial<ProductionRecord>) => {
    setState(prev => ({ ...prev, productions: prev.productions.map(p => p.id === id ? { ...p, ...data } : p) }));
  };

  const completeProduction = async (id: string, actualQuantity: number, actualIngredients: ProductionIngredient[], variants?: BatchVariant[]) => {
    const prod = stateRef.current.productions.find(p => p.id === id);
    if (!prod || prod.status === ProductionStatus.COMPLETED) return;
    const timestamp = Date.now();
    let updatedBatches = [...stateRef.current.batches];
    let totalMaterialCost = 0;
    const usages: ProductionUsage[] = [];

    for (const ingredient of actualIngredients) {
      let needed = ingredient.quantity;
      const relevant = updatedBatches.filter(b => b.productName === ingredient.productName && b.stockType === StockType.FOR_PRODUCTION && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);
      for (const batch of relevant) {
        if (needed <= 0) break;
        const take = Math.min(batch.currentQuantity, needed);
        const idx = updatedBatches.findIndex(b => b.id === batch.id);
        updatedBatches[idx].currentQuantity -= take;
        totalMaterialCost += take * batch.buyPrice;
        needed -= take;
        usages.push({ id: crypto.randomUUID(), productionId: prod.id, batchId: batch.id, quantityUsed: take, costPerUnit: batch.buyPrice });
      }
    }

    const finalTotalHPP = prod.totalHPP + totalMaterialCost;
    const resultBatch: Batch = { 
      id: crypto.randomUUID(), productName: prod.outputProductName, initialQuantity: actualQuantity, currentQuantity: actualQuantity, 
      buyPrice: actualQuantity > 0 ? (finalTotalHPP / actualQuantity) : 0, stockType: StockType.FOR_SALE, createdAt: timestamp, variants: variants || []
    };
    setState(prev => ({ 
      ...prev, batches: [...updatedBatches, resultBatch], 
      productions: prev.productions.map(p => p.id === id ? { ...p, status: ProductionStatus.COMPLETED, completedAt: timestamp, batchIdCreated: resultBatch.id, outputQuantity: actualQuantity, totalHPP: finalTotalHPP } : p),
      productionUsages: [...prev.productionUsages, ...usages]
    }));
  };

  const deleteProduction = async (id: string) => {
    const prod = stateRef.current.productions.find(p => p.id === id);
    if (!prod) return;
    const prodUsages = stateRef.current.productionUsages.filter(u => u.productionId === id);
    let updatedBatches = [...stateRef.current.batches];
    prodUsages.forEach(usage => {
      const idx = updatedBatches.findIndex(b => b.id === usage.batchId);
      if (idx !== -1) updatedBatches[idx].currentQuantity += usage.quantityUsed;
    });
    if (prod.batchIdCreated) updatedBatches = updatedBatches.filter(b => b.id !== prod.batchIdCreated);
    setState(prev => ({ 
      ...prev, batches: updatedBatches, productions: prev.productions.filter(p => p.id !== id), 
      productionUsages: prev.productionUsages.filter(u => u.productionId !== id), 
      transactions: prev.transactions.filter(t => t.relatedId !== id) 
    }));
  };

  const runSale = async (productName: string, quantity: number, pricePerUnit: number, customDate?: number, variantLabel?: string, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    let needed = quantity;
    let totalCOGS = 0;
    let updatedBatches = [...stateRef.current.batches];
    const relevant = updatedBatches.filter(b => b.productName === productName && b.stockType === StockType.FOR_SALE && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);

    for (const batch of relevant) {
      if (needed <= 0) break;
      let availableInThisBatch = batch.currentQuantity;
      if (variantLabel && batch.variants) {
        const v = batch.variants.find(v => v.label === variantLabel);
        if (v) availableInThisBatch = v.quantity;
      }
      const take = Math.min(availableInThisBatch, needed);
      if (take <= 0) continue;
      const bIdx = updatedBatches.findIndex(b => b.id === batch.id);
      updatedBatches[bIdx].currentQuantity -= take;
      if (variantLabel && updatedBatches[bIdx].variants) {
        const vIdx = updatedBatches[bIdx].variants!.findIndex(v => v.label === variantLabel);
        if (vIdx !== -1) updatedBatches[bIdx].variants![vIdx].quantity -= take;
      }
      needed -= take;
      totalCOGS += take * batch.buyPrice;
    }

    const saleId = crypto.randomUUID();
    const sale: SaleRecord = { id: saleId, productName, variantLabel, quantity, salePrice: pricePerUnit, totalRevenue: quantity * pricePerUnit, totalCOGS, createdAt: timestamp };
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.SALES, amount: sale.totalRevenue, description: `PENJUALAN: ${productName}${variantLabel ? ` (${variantLabel})` : ''}`, createdAt: timestamp, relatedId: saleId, paymentMethod };
    setState(prev => ({ ...prev, batches: updatedBatches, sales: [...prev.sales, sale], transactions: [...prev.transactions, tx] }));
  };

  const updateSale = async (id: string, data: Partial<SaleRecord>) => {
    setState(prev => ({ ...prev, sales: prev.sales.map(s => s.id === id ? { ...s, ...data } : s) }));
  };

  const deleteSale = async (id: string) => {
    const sale = stateRef.current.sales.find(s => s.id === id);
    if (!sale) return;
    setState(prev => ({ 
      ...prev, sales: prev.sales.filter(s => s.id !== id), 
      transactions: prev.transactions.filter(t => t.relatedId !== id) 
    }));
  };

  const addDPOrder = async (data: Omit<DPOrder, 'id' | 'createdAt' | 'status'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newOrder: DPOrder = { ...data, id: crypto.randomUUID(), createdAt: timestamp, status: DPStatus.PENDING };
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.DEPOSIT, amount: data.dpAmount, description: `DP ORDER: ${data.customerName} (${data.productName})`, createdAt: timestamp, relatedId: newOrder.id, paymentMethod };
    setState(prev => ({ ...prev, dpOrders: [...prev.dpOrders, newOrder], transactions: [...prev.transactions, tx] }));
  };

  const updateDPOrder = async (id: string, data: Partial<DPOrder>) => {
    setState(prev => ({ ...prev, dpOrders: prev.dpOrders.map(o => o.id === id ? { ...o, ...data } : o) }));
  };

  const completeDPOrder = async (id: string, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const order = stateRef.current.dpOrders.find(o => o.id === id);
    if (!order) return;
    const timestamp = customDate || Date.now();
    const sisa = order.totalAmount - order.dpAmount;
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.SALES, amount: sisa, description: `PELUNASAN SISA ORDER: ${order.customerName}`, createdAt: timestamp, relatedId: order.id, paymentMethod };
    setState(prev => ({ 
      ...prev, dpOrders: prev.dpOrders.map(o => o.id === id ? { ...o, status: DPStatus.COMPLETED, completedAt: timestamp } : o),
      transactions: [...prev.transactions, tx]
    }));
  };

  const cancelDPOrder = async (id: string, customDate?: number) => {
    setState(prev => ({ ...prev, dpOrders: prev.dpOrders.map(o => o.id === id ? { ...o, status: DPStatus.CANCELLED, completedAt: customDate || Date.now() } : o) }));
  };

  const deleteDPOrder = async (id: string) => {
    setState(prev => ({ ...prev, dpOrders: prev.dpOrders.filter(o => o.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    setState(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === id ? { ...t, ...data } : t) }));
  };

  const deleteTransaction = async (id: string) => {
    setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
  };

  const transferFunds = async (amount: number, from: 'CASH' | 'BANK', to: 'CASH' | 'BANK', note: string, customDate?: number) => {
    const timestamp = customDate || Date.now();
    const gid = crypto.randomUUID();
    const txs: Transaction[] = [
      { id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.TRANSFER, amount, description: `TRANSFER KELUAR: ${note}`, createdAt: timestamp, paymentMethod: from, relatedId: gid },
      { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.TRANSFER, amount, description: `TRANSFER MASUK: ${note}`, createdAt: timestamp, paymentMethod: to, relatedId: gid }
    ];
    setState(prev => ({ ...prev, transactions: [...prev.transactions, ...txs] }));
  };

  const addLoan = async (data: Omit<Loan, 'id' | 'createdAt' | 'remainingAmount'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newLoan: Loan = { ...data, id: crypto.randomUUID(), remainingAmount: data.initialAmount, createdAt: timestamp };
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.LOAN_PROCEEDS, amount: data.initialAmount, description: `PINJAMAN: ${data.source}`, createdAt: timestamp, relatedId: newLoan.id, paymentMethod };
    setState(prev => ({ ...prev, loans: [...prev.loans, newLoan], transactions: [...prev.transactions, tx] }));
  };

  const updateLoan = async (id: string, data: Partial<Loan>, paymentMethod?: 'CASH' | 'BANK', customDate?: number) => {
    setState(prev => ({ ...prev, loans: prev.loans.map(l => l.id === id ? { ...l, ...data } : l) }));
  };

  const repayLoan = async (loanId: string, principal: number, interest: number, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const loan = stateRef.current.loans.find(l => l.id === loanId);
    if (!loan) return;
    const timestamp = customDate || Date.now();
    const txs: Transaction[] = [];
    if (principal > 0) txs.push({ id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.LOAN_REPAYMENT, amount: principal, description: `CICILAN POKOK: ${loan.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod });
    if (interest > 0) txs.push({ id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.OPERATIONAL, amount: interest, description: `BUNGA PINJAMAN: ${loan.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod });
    setState(prev => ({ 
      ...prev, loans: prev.loans.map(l => l.id === loanId ? { ...l, remainingAmount: Math.max(0, l.remainingAmount - principal) } : l),
      transactions: [...prev.transactions, ...txs]
    }));
  };

  const deleteLoan = async (id: string) => {
    setState(prev => ({ ...prev, loans: prev.loans.filter(l => l.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
  };

  return (
    <AppContext.Provider value={{ 
      state, addBatch, updateBatch, deleteBatch, runProduction, updateProduction, completeProduction,
      deleteProduction, runSale, updateSale, deleteSale, addManualTransaction, updateTransaction, 
      deleteTransaction, transferFunds, updateSettings, syncLocalToCloud, fetchFromCloud,
      signIn, signUp, logout,
      addDPOrder, updateDPOrder, completeDPOrder, cancelDPOrder, deleteDPOrder,
      addLoan, updateLoan, repayLoan, deleteLoan
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
