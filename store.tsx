
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
  syncLocalToCloud: () => Promise<void>;
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
    return { ...initialData, isSyncing: false, user: null };
  });

  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Sync to SessionStorage
  useEffect(() => {
    const { user, isSyncing, ...persistentState } = state;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistentState));
    if (state.settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state.batches, state.productions, state.productionUsages, state.sales, state.dpOrders, state.loans, state.transactions, state.settings]);

  // Handle Auth & Initial Session
  useEffect(() => {
    if (!isCloudReady) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null;
      if (newUser?.id !== stateRef.current.user?.id) {
        setState(prev => ({ ...prev, user: newUser }));
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) setState(prev => ({ ...prev, user: data.session.user }));
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchFromCloud = useCallback(async () => {
    if (!isCloudReady || !stateRef.current.user) return;
    setState(prev => ({ ...prev, isSyncing: true }));
    try {
      const [b, p, u, s, d, l, t, profile] = await Promise.all([
        supabase.from('batches').select('*'),
        supabase.from('productions').select('*'),
        supabase.from('production_usages').select('*'),
        supabase.from('sales').select('*'),
        supabase.from('dp_orders').select('*'),
        supabase.from('loans').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('profiles').select('*').limit(1)
      ]);
      const cloudProfile = profile.data?.[0] || null;
      setState(prev => ({
        ...prev,
        batches: b.data || [],
        productions: p.data || [],
        productionUsages: u.data || [],
        sales: s.data || [],
        dpOrders: d.data || [],
        loans: l.data || [],
        transactions: t.data || [],
        settings: {
          ...prev.settings,
          businessName: cloudProfile?.business_name || prev.settings.businessName,
          theme: cloudProfile?.theme || prev.settings.theme,
        },
        isSyncing: false
      }));
    } catch (err) {
      console.error("Initial Cloud Fetch Failed:", err);
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, []);

  // --- REALTIME SYNC LOGIC ---
  useEffect(() => {
    if (!isCloudReady || !state.user || !state.settings.useCloud) return;

    fetchFromCloud(); // Initial fetch

    // Setup Realtime Channel
    const channel = supabase.channel('realtime_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'batches' }, (payload) => {
        handleRealtimeEvent('batches', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
        handleRealtimeEvent('sales', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productions' }, (payload) => {
        handleRealtimeEvent('productions', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, (payload) => {
        handleRealtimeEvent('transactions', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dp_orders' }, (payload) => {
        // Fix: Use correct AppState key 'dpOrders' instead of database table name 'dp_orders'
        handleRealtimeEvent('dpOrders', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loans' }, (payload) => {
        handleRealtimeEvent('loans', payload);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'production_usages' }, (payload) => {
        handleRealtimeEvent('productionUsages', payload);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [state.user, state.settings.useCloud]);

  const handleRealtimeEvent = (key: keyof AppState, payload: any) => {
    setState(prev => {
      const existingData = (prev[key] as any[]) || [];
      const { eventType, new: newRecord, old: oldRecord } = payload;

      // Jangan proses jika record bukan milik user ini (Filter RLS di client side tambahan)
      if (newRecord && newRecord.user_id && newRecord.user_id !== stateRef.current.user?.id) return prev;

      let newData = [...existingData];

      if (eventType === 'INSERT') {
        if (!newData.some(r => r.id === newRecord.id)) {
          newData.push(newRecord);
        }
      } else if (eventType === 'UPDATE') {
        newData = newData.map(r => r.id === newRecord.id ? { ...r, ...newRecord } : r);
      } else if (eventType === 'DELETE') {
        newData = newData.filter(r => r.id !== oldRecord.id);
      }

      return { ...prev, [key]: newData };
    });
  };

  // Helper for REAL-TIME Auto Push (Optimistic UI)
  const autoCloudSync = async (table: string, data: any, operation: 'insert' | 'update' | 'upsert' | 'delete' = 'insert', idField: string = 'id', idValue?: string) => {
    if (!isCloudReady || !stateRef.current.user || !stateRef.current.settings.useCloud) return;
    
    setState(prev => ({ ...prev, isSyncing: true }));
    try {
      const userId = stateRef.current.user.id;
      const query = supabase.from(table);
      
      if (operation === 'insert') {
        const payload = Array.isArray(data) ? data.map(item => ({ ...item, user_id: userId })) : { ...data, user_id: userId };
        await query.insert(payload);
      } else if (operation === 'update') {
        await query.update(data).eq(idField, idValue);
      } else if (operation === 'upsert') {
        const payload = Array.isArray(data) ? data.map(item => ({ ...item, user_id: userId })) : { ...data, user_id: userId };
        await query.upsert(payload);
      } else if (operation === 'delete') {
        await query.delete().eq(idField, idValue);
      }
    } catch (e) {
      console.error(`Auto Sync Failed [${table}]:`, e);
    } finally {
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  };

  const addBatch = async (data: Omit<Batch, 'id' | 'createdAt'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newBatch: Batch = { ...data, id: crypto.randomUUID(), createdAt: timestamp };
    const newTx: Transaction = {
      id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.STOCK_PURCHASE,
      amount: data.buyPrice * data.initialQuantity, description: `Beli Stok: ${data.productName}`,
      createdAt: timestamp, relatedId: newBatch.id, paymentMethod
    };
    
    setState(prev => ({ ...prev, batches: [...prev.batches, newBatch], transactions: [...prev.transactions, newTx] }));
    await Promise.all([
      autoCloudSync('batches', newBatch),
      autoCloudSync('transactions', newTx)
    ]);
  };

  const updateBatch = async (id: string, data: Partial<Batch>) => {
    let updatedBatch: Batch | undefined;
    setState(prev => {
      const updatedBatches = prev.batches.map(b => {
        if (b.id === id) {
          updatedBatch = { ...b, ...data };
          return updatedBatch;
        }
        return b;
      });
      return { ...prev, batches: updatedBatches };
    });
    if (updatedBatch) autoCloudSync('batches', updatedBatch, 'upsert');
  };

  const deleteBatch = async (id: string) => {
    const isUsed = stateRef.current.productionUsages.some(u => u.batchId === id);
    if (isUsed) return alert("STOK INI SUDAH PERNAH DIGUNAKAN.");
    setState(prev => ({ ...prev, batches: prev.batches.filter(b => b.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
    autoCloudSync('batches', id, 'delete', 'id', id);
    autoCloudSync('transactions', id, 'delete', 'relatedId', id);
  };

  const runProduction = async (productName: string, quantity: number, ingredients: { productName: string, quantity: number }[], operationalCosts: { amount: number, description: string, paymentMethod: 'CASH' | 'BANK' }[], customDate?: number) => {
    const timestamp = customDate || Date.now();
    const productionId = crypto.randomUUID();
    const totalOpCost = operationalCosts.reduce((sum, c) => sum + c.amount, 0);
    const production: ProductionRecord = { 
      id: productionId, outputProductName: productName, outputQuantity: quantity, 
      totalHPP: totalOpCost, createdAt: timestamp, status: ProductionStatus.IN_PROGRESS, ingredients
    };
    const newTxs = operationalCosts.filter(c => c.amount > 0).map(c => ({
      id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.PRODUCTION_COST,
      amount: c.amount, description: `PRODUKSI ${productName} (${c.description})`, createdAt: timestamp, relatedId: productionId, paymentMethod: c.paymentMethod
    }));
    setState(prev => ({ ...prev, productions: [...prev.productions, production], transactions: [...prev.transactions, ...newTxs] }));
    autoCloudSync('productions', production);
    autoCloudSync('transactions', newTxs);
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
    const finalHPP = prod.totalHPP + totalMaterialCost;
    const resultBatch: Batch = { 
      id: crypto.randomUUID(), productName: prod.outputProductName, 
      initialQuantity: actualQuantity, currentQuantity: actualQuantity, 
      buyPrice: actualQuantity > 0 ? (finalHPP / actualQuantity) : 0, 
      stockType: StockType.FOR_SALE, createdAt: timestamp, variants: variants || [] 
    };
    
    const updatedProd = { ...prod, status: ProductionStatus.COMPLETED, completedAt: timestamp, batchIdCreated: resultBatch.id, outputQuantity: actualQuantity, totalHPP: finalHPP };

    setState(prev => ({
      ...prev,
      batches: [...updatedBatches, resultBatch],
      productions: prev.productions.map(p => p.id === id ? updatedProd : p),
      productionUsages: [...prev.productionUsages, ...usages]
    }));
    
    await Promise.all([
      autoCloudSync('batches', updatedBatches, 'upsert'),
      autoCloudSync('batches', resultBatch),
      autoCloudSync('productions', updatedProd, 'upsert'),
      autoCloudSync('production_usages', usages)
    ]);
  };

  const deleteProduction = async (id: string) => {
    setState(prev => ({ 
      ...prev, 
      productions: prev.productions.filter(p => p.id !== id),
      transactions: prev.transactions.filter(t => t.relatedId !== id)
    }));
    autoCloudSync('productions', id, 'delete', 'id', id);
    autoCloudSync('transactions', id, 'delete', 'relatedId', id);
  };

  const runSale = async (productName: string, quantity: number, pricePerUnit: number, customDate?: number, variantLabel?: string, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    let needed = quantity;
    let totalCOGS = 0;
    let updatedBatches = [...stateRef.current.batches];
    const relevant = updatedBatches.filter(b => b.productName === productName && b.stockType === StockType.FOR_SALE && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);
    
    for (const batch of relevant) {
      if (needed <= 0) break;
      let avail = batch.currentQuantity;
      if (variantLabel && batch.variants) {
        const v = batch.variants.find(v => v.label === variantLabel);
        avail = v ? v.quantity : 0;
      }
      const take = Math.min(avail, needed);
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
    await Promise.all([
      autoCloudSync('batches', updatedBatches, 'upsert'),
      autoCloudSync('sales', sale),
      autoCloudSync('transactions', tx)
    ]);
  };

  const deleteSale = async (id: string) => {
    setState(prev => ({ ...prev, sales: prev.sales.filter(s => s.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
    autoCloudSync('sales', id, 'delete', 'id', id);
    autoCloudSync('transactions', id, 'delete', 'relatedId', id);
  };

  const addManualTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>, customDate?: number) => {
    const timestamp = customDate || Date.now();
    const newTx: Transaction = { ...data, id: crypto.randomUUID(), createdAt: timestamp };
    setState(prev => ({ ...prev, transactions: [...prev.transactions, newTx] }));
    autoCloudSync('transactions', newTx);
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    let updatedTx: Transaction | undefined;
    setState(prev => {
      const updatedTxs = prev.transactions.map(t => {
        if (t.id === id) {
          updatedTx = { ...t, ...data };
          return updatedTx;
        }
        return t;
      });
      return { ...prev, transactions: updatedTxs };
    });
    if (updatedTx) autoCloudSync('transactions', updatedTx, 'upsert');
  };

  const deleteTransaction = async (id: string) => {
    const tx = stateRef.current.transactions.find(t => t.id === id);
    if (tx?.relatedId) return alert("Transaksi otomatis tidak bisa dihapus langsung.");
    setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
    autoCloudSync('transactions', id, 'delete', 'id', id);
  };

  const transferFunds = async (amount: number, from: 'CASH' | 'BANK', to: 'CASH' | 'BANK', note: string, customDate?: number) => {
    const timestamp = customDate || Date.now();
    const gid = crypto.randomUUID();
    const txs: Transaction[] = [
      { id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.TRANSFER, amount, description: `TRANSFER OUT: ${from}->${to} (${note})`, createdAt: timestamp, paymentMethod: from, relatedId: gid },
      { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.TRANSFER, amount, description: `TRANSFER IN: ${from}->${to} (${note})`, createdAt: timestamp, paymentMethod: to, relatedId: gid }
    ];
    setState(prev => ({ ...prev, transactions: [...prev.transactions, ...txs] }));
    autoCloudSync('transactions', txs);
  };

  const addLoan = async (data: Omit<Loan, 'id' | 'createdAt' | 'remainingAmount'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const loan: Loan = { ...data, id: crypto.randomUUID(), remainingAmount: data.initialAmount, createdAt: timestamp };
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.LOAN_PROCEEDS, amount: data.initialAmount, description: `PINJAMAN: ${data.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod };
    setState(prev => ({ ...prev, loans: [...prev.loans, loan], transactions: [...prev.transactions, tx] }));
    autoCloudSync('loans', loan);
    autoCloudSync('transactions', tx);
  };

  const repayLoan = async (loanId: string, principal: number, interest: number, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const loan = stateRef.current.loans.find(l => l.id === loanId);
    if (!loan) return;
    const timestamp = customDate || Date.now();
    const txs: Transaction[] = [];
    if (principal > 0) txs.push({ id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.LOAN_REPAYMENT, amount: principal, description: `BAYAR POKOK: ${loan.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod });
    if (interest > 0) txs.push({ id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.OPERATIONAL, amount: interest, description: `BUNGA PINJAMAN: ${loan.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod });
    
    const updatedLoan = { ...loan, remainingAmount: Math.max(0, loan.remainingAmount - principal) };
    setState(prev => ({ 
      ...prev, 
      loans: prev.loans.map(l => l.id === loanId ? updatedLoan : l), 
      transactions: [...prev.transactions, ...txs] 
    }));
    autoCloudSync('loans', updatedLoan, 'upsert');
    autoCloudSync('transactions', txs);
  };

  const deleteLoan = async (id: string) => {
    setState(prev => ({ ...prev, loans: prev.loans.filter(l => l.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
    autoCloudSync('loans', id, 'delete', 'id', id);
    autoCloudSync('transactions', id, 'delete', 'relatedId', id);
  };

  const addDPOrder = async (data: Omit<DPOrder, 'id' | 'createdAt' | 'status'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const order: DPOrder = { ...data, id: crypto.randomUUID(), createdAt: timestamp, status: DPStatus.PENDING };
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.DEPOSIT, amount: data.dpAmount, description: `DP: ${data.customerName} (${data.productName})`, createdAt: timestamp, relatedId: order.id, paymentMethod };
    setState(prev => ({ ...prev, dpOrders: [...prev.dpOrders, order], transactions: [...prev.transactions, tx] }));
    autoCloudSync('dp_orders', order);
    autoCloudSync('transactions', tx);
  };

  const completeDPOrder = async (id: string, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const order = stateRef.current.dpOrders.find(o => o.id === id);
    if (!order) return;
    const timestamp = customDate || Date.now();
    const remaining = order.totalAmount - order.dpAmount;
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.SALES, amount: remaining, description: `LUNAS DP: ${order.customerName}`, createdAt: timestamp, relatedId: order.id, paymentMethod };
    const updatedOrder = { ...order, status: DPStatus.COMPLETED, completedAt: timestamp };
    const sale: SaleRecord = { id: crypto.randomUUID(), productName: order.productName, quantity: order.quantity, salePrice: order.totalAmount / order.quantity, totalRevenue: order.totalAmount, totalCOGS: 0, createdAt: timestamp, related_order_id: order.id };
    
    setState(prev => ({ 
      ...prev, 
      dpOrders: prev.dpOrders.map(o => o.id === id ? updatedOrder : o),
      transactions: [...prev.transactions, tx],
      sales: [...prev.sales, sale]
    }));
    await Promise.all([
      autoCloudSync('dp_orders', updatedOrder, 'upsert'),
      autoCloudSync('transactions', tx),
      autoCloudSync('sales', sale)
    ]);
  };

  const cancelDPOrder = async (id: string, customDate?: number) => {
    const order = stateRef.current.dpOrders.find(o => o.id === id);
    if (!order) return;
    const updatedOrder = { ...order, status: DPStatus.CANCELLED, completedAt: customDate || Date.now() };
    setState(prev => ({ ...prev, dpOrders: prev.dpOrders.map(o => o.id === id ? updatedOrder : o) }));
    autoCloudSync('dp_orders', updatedOrder, 'upsert');
  };

  const deleteDPOrder = async (id: string) => {
    setState(prev => ({ ...prev, dpOrders: prev.dpOrders.filter(o => o.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
    autoCloudSync('dp_orders', id, 'delete', 'id', id);
    autoCloudSync('transactions', id, 'delete', 'relatedId', id);
  };

  const signIn = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return error.message;
      return null;
    } catch (e: any) { return e.message; }
  };

  const signUp = async (email: string, pass: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password: pass });
      if (error) return error.message;
      return null;
    } catch (e: any) { return e.message; }
  };

  const logout = async () => {
    try { if (isCloudReady) await supabase.auth.signOut(); } finally {
      setState(prev => ({ ...prev, user: null, batches: [], productions: [], productionUsages: [], sales: [], dpOrders: [], loans: [], transactions: [] }));
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = { ...state.settings, ...newSettings };
    setState(prev => ({ ...prev, settings: updated }));
    if (state.user) autoCloudSync('profiles', { id: state.user.id, business_name: updated.businessName, theme: updated.theme }, 'upsert', 'id', state.user.id);
  };

  const syncLocalToCloud = async () => {
    if (!state.user) return alert("Harus login.");
    setState(prev => ({ ...prev, isSyncing: true }));
    try {
      await Promise.all([
        autoCloudSync('batches', state.batches, 'upsert'),
        autoCloudSync('productions', state.productions, 'upsert'),
        autoCloudSync('production_usages', state.productionUsages, 'upsert'),
        autoCloudSync('sales', state.sales, 'upsert'),
        autoCloudSync('dp_orders', state.dpOrders, 'upsert'),
        autoCloudSync('loans', state.loans, 'upsert'),
        autoCloudSync('transactions', state.transactions, 'upsert')
      ]);
      alert("Manual Sync Berhasil!");
    } finally { setState(prev => ({ ...prev, isSyncing: false })); }
  };

  const updateProduction = async (id: string, data: Partial<ProductionRecord>) => {
    let updated: ProductionRecord | undefined;
    setState(prev => {
      const prods = prev.productions.map(p => {
        if (p.id === id) {
          updated = { ...p, ...data };
          return updated;
        }
        return p;
      });
      return { ...prev, productions: prods };
    });
    if (updated) autoCloudSync('productions', updated, 'upsert');
  };

  const updateSale = async (id: string, data: Partial<SaleRecord>) => {
    let updated: SaleRecord | undefined;
    setState(prev => {
      const sls = prev.sales.map(s => {
        if (s.id === id) {
          updated = { ...s, ...data };
          return updated;
        }
        return s;
      });
      return { ...prev, sales: sls };
    });
    if (updated) autoCloudSync('sales', updated, 'upsert');
  };

  const updateDPOrder = async (id: string, data: Partial<DPOrder>) => {
    let updated: DPOrder | undefined;
    setState(prev => {
      const ords = prev.dpOrders.map(o => {
        if (o.id === id) {
          updated = { ...o, ...data };
          return updated;
        }
        return o;
      });
      return { ...prev, dpOrders: ords };
    });
    if (updated) autoCloudSync('dp_orders', updated, 'upsert');
  };

  const updateLoan = async (id: string, data: Partial<Loan>) => {
    let updated: Loan | undefined;
    setState(prev => {
      const lns = prev.loans.map(l => {
        if (l.id === id) {
          updated = { ...l, ...data };
          return updated;
        }
        return l;
      });
      return { ...prev, loans: lns };
    });
    if (updated) autoCloudSync('loans', updated, 'upsert');
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
