
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
      const [
        { data: b }, { data: p }, { data: u }, 
        { data: s }, { data: d }, { data: l }, 
        { data: t }, { data: profile }
      ] = await Promise.all([
        supabase.from('batches').select('*'),
        supabase.from('productions').select('*'),
        supabase.from('production_usages').select('*'),
        supabase.from('sales').select('*'),
        supabase.from('dp_orders').select('*'),
        supabase.from('loans').select('*'),
        supabase.from('transactions').select('*'),
        supabase.from('profiles').select('*').limit(1)
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

  // Sync to SessionStorage and Theme
  useEffect(() => {
    const { user, isSyncing, lastSyncTime, ...persistentState } = state;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistentState));
    
    if (state.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.batches, state.productions, state.productionUsages, state.sales, state.dpOrders, state.loans, state.transactions, state.settings]);

  // AUTO-SYNC LOGIC (DEBOUNCED)
  useEffect(() => {
    if (!isCloudReady || !state.user || !state.settings.useCloud) return;

    const timeout = setTimeout(() => {
      syncLocalToCloud(true);
    }, 2500); // 2.5 seconds debounce

    return () => clearTimeout(timeout);
  }, [
    state.batches, 
    state.productions, 
    state.productionUsages, 
    state.sales, 
    state.dpOrders, 
    state.loans, 
    state.transactions,
    state.settings.businessName,
    state.settings.theme
  ]);

  // Handle Auth Changes
  useEffect(() => {
    if (!isCloudReady) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setState(prev => {
        if (prev.user?.id === user?.id) return prev;
        return { ...prev, user };
      });
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) {
        setState(prev => ({ ...prev, user: data.session.user }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch data when user is ready
  useEffect(() => {
    if (state.user) {
      fetchFromCloud();
    }
  }, [state.user, fetchFromCloud]);

  const signIn = async (email: string, pass: string) => {
    if (!isCloudReady) return "Konfigurasi Cloud belum lengkap.";
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return error.message;
      return null;
    } catch (e: any) {
      return e.message;
    }
  };

  const signUp = async (email: string, pass: string) => {
    if (!isCloudReady) return "Konfigurasi Cloud belum lengkap.";
    try {
      const { error } = await supabase.auth.signUp({ email, password: pass });
      if (error) return error.message;
      return null;
    } catch (e: any) {
      return e.message;
    }
  };

  const logout = async () => {
    try {
      if (isCloudReady) await supabase.auth.signOut();
    } catch (e) {
      console.error("Logout error (cloud):", e);
    } finally {
      setState(prev => ({ 
        ...prev, 
        user: null,
        batches: [],
        productions: [],
        productionUsages: [],
        sales: [],
        dpOrders: [],
        loans: [],
        transactions: [],
        lastSyncTime: undefined
      }));
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }));
  };

  /**
   * Sync Local State to Cloud Independently
   * Wraps each table in a try-catch to ensure one failure doesn't block the rest.
   */
  const syncLocalToCloud = async (silent: boolean = false) => {
    if (!isCloudReady || !stateRef.current.user) return;
    
    setState(prev => ({ ...prev, isSyncing: true }));
    const user_id = stateRef.current.user.id;
    const current = stateRef.current;
    
    // Helper to log and sync individual tables
    const syncTable = async (tableName: string, data: any[]) => {
      if (data.length === 0 && tableName !== 'profiles') return;
      try {
        let result;
        if (tableName === 'profiles') {
          result = await supabase.from('profiles').upsert({
            id: user_id,
            business_name: current.settings.businessName,
            theme: current.settings.theme,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });
        } else {
          result = await supabase.from(tableName).upsert(
            data.map(i => ({ ...i, user_id })), 
            { onConflict: 'id' }
          );
        }
        
        if (result.error) {
          console.error(`Sync error on [${tableName}]:`, result.error.message);
          return false;
        }
        return true;
      } catch (err: any) {
        console.error(`Exception on [${tableName}]:`, err.message);
        return false;
      }
    };

    try {
      // Menjalankan semua sinkronisasi secara paralel agar lebih cepat dan tidak saling mengunci
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

      const anyFailed = results.some(r => r === false);
      const allSucceeded = results.every(r => r === true);

      setState(prev => ({ 
        ...prev, 
        isSyncing: false, 
        lastSyncTime: allSucceeded ? Date.now() : prev.lastSyncTime 
      }));

      if (!silent) {
        if (allSucceeded) alert("Sinkronisasi Cloud Berhasil!");
        else if (anyFailed) alert("Sebagian data gagal disinkronkan. Cek konsol browser untuk detail.");
      }
    } catch (e: any) {
      console.error("Global Sync Exception:", e);
      setState(prev => ({ ...prev, isSyncing: false }));
    }
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
    const updatedBatches = stateRef.current.batches.map(b => {
      if (b.id === id) {
        const base = { ...b, ...data };
        if (base.variants && base.variants.length > 0) {
          const totalFromVariants = base.variants.reduce((sum, v) => sum + v.quantity, 0);
          base.currentQuantity = totalFromVariants;
          base.initialQuantity = totalFromVariants; 
        }
        return base;
      }
      return b;
    });
    
    const updatedBatch = updatedBatches.find(b => b.id === id);
    let updatedTransactions = [...stateRef.current.transactions];

    if (updatedBatch) {
      updatedTransactions = updatedTransactions.map(t => {
        if (t.relatedId === id && t.category === TransactionCategory.STOCK_PURCHASE) {
          return {
            ...t,
            amount: (updatedBatch.buyPrice || 0) * (updatedBatch.initialQuantity || 0),
            description: `Beli Stok: ${updatedBatch.productName}`,
            createdAt: updatedBatch.createdAt || t.createdAt
          };
        }
        return t;
      });
    }

    setState(prev => ({ ...prev, batches: updatedBatches, transactions: updatedTransactions }));
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
      id: productionId, 
      outputProductName: productName, 
      outputQuantity: quantity, 
      totalHPP: totalOpCost, 
      createdAt: timestamp, 
      status: ProductionStatus.IN_PROGRESS,
      ingredients: ingredients
    };
    const newTx = operationalCosts.filter(c => c.amount > 0).map(c => ({
      id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.PRODUCTION_COST,
      amount: c.amount, description: `PRODUKSI ${productName} (${c.description})`, createdAt: timestamp, relatedId: productionId, paymentMethod: c.paymentMethod
    }));
    setState(prev => ({ ...prev, productions: [...prev.productions, production], transactions: [...prev.transactions, ...newTx] }));
  };

  const updateProduction = async (id: string, data: Partial<ProductionRecord>) => {
    const updatedProductions = stateRef.current.productions.map(p => p.id === id ? { ...p, ...data } : p);
    setState(prev => ({ ...prev, productions: updatedProductions }));
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
      if (needed <= 0) continue;
      const relevant = updatedBatches.filter(b => b.productName === ingredient.productName && b.stockType === StockType.FOR_PRODUCTION && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);
      const totalAvail = relevant.reduce((s, b) => s + b.currentQuantity, 0);
      if (totalAvail < needed) throw new Error(`Stok ${ingredient.productName} tidak mencukupi. Tersedia: ${totalAvail}, Dibutuhkan: ${needed}`);

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
    const unitPrice = actualQuantity > 0 ? (finalTotalHPP / actualQuantity) : 0;
    const resultBatch: Batch = { 
      id: crypto.randomUUID(), productName: prod.outputProductName, initialQuantity: actualQuantity, currentQuantity: actualQuantity, buyPrice: unitPrice, stockType: StockType.FOR_SALE, createdAt: timestamp, variants: variants || []
    };
    const updatedProductions = stateRef.current.productions.map(p => p.id === id ? { ...p, status: ProductionStatus.COMPLETED, completedAt: timestamp, batchIdCreated: resultBatch.id, outputQuantity: actualQuantity, totalHPP: finalTotalHPP } : p);
    setState(prev => ({ ...prev, batches: [...updatedBatches, resultBatch], productions: updatedProductions, productionUsages: [...prev.productionUsages, ...usages] }));
  };

  const deleteProduction = async (id: string) => {
    const prod = stateRef.current.productions.find(p => p.id === id);
    if (!prod) return;
    if (prod.status === ProductionStatus.COMPLETED && prod.batchIdCreated) {
      const resultBatch = stateRef.current.batches.find(b => b.id === prod.batchIdCreated);
      if (resultBatch && resultBatch.currentQuantity < resultBatch.initialQuantity) return alert("PRODUK SUDAH TERJUAL.");
    }
    const prodUsages = stateRef.current.productionUsages.filter(u => u.productionId === id);
    let updatedBatches = [...stateRef.current.batches];
    prodUsages.forEach(usage => {
      const idx = updatedBatches.findIndex(b => b.id === usage.batchId);
      if (idx !== -1) updatedBatches[idx].currentQuantity += usage.quantityUsed;
    });
    if (prod.batchIdCreated) updatedBatches = updatedBatches.filter(b => b.id !== prod.batchIdCreated);
    setState(prev => ({ ...prev, batches: updatedBatches, productions: prev.productions.filter(p => p.id !== id), productionUsages: prev.productionUsages.filter(u => u.productionId !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
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
      if (variantLabel && batch.variants && batch.variants.length > 0) {
        const vIdx = batch.variants.findIndex(v => v.label === variantLabel);
        if (vIdx === -1 || batch.variants[vIdx].quantity <= 0) continue;
        availableInThisBatch = batch.variants[vIdx].quantity;
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
    const oldSale = stateRef.current.sales.find(s => s.id === id);
    if (!oldSale) return;
    let updatedBatches = [...stateRef.current.batches];
    let toRestore = oldSale.quantity;
    const sameProductBatches = updatedBatches.filter(b => b.productName === oldSale.productName && b.stockType === StockType.FOR_SALE).sort((a, b) => b.createdAt - a.createdAt); 

    for (const batch of sameProductBatches) {
      if (toRestore <= 0) break;
      const bIdx = updatedBatches.findIndex(b => b.id === batch.id);
      if (oldSale.variantLabel && updatedBatches[bIdx].variants) {
        const vIdx = updatedBatches[bIdx].variants!.findIndex(v => v.label === oldSale.variantLabel);
        if (vIdx !== -1) {
          updatedBatches[bIdx].variants![vIdx].quantity += toRestore;
          updatedBatches[bIdx].currentQuantity += toRestore;
          toRestore = 0; break;
        }
      } else {
        const space = batch.initialQuantity - batch.currentQuantity;
        const amount = Math.min(space, toRestore);
        updatedBatches[bIdx].currentQuantity += amount;
        toRestore -= amount;
      }
    }

    const newQty = data.quantity ?? oldSale.quantity;
    const newPrice = data.salePrice ?? oldSale.salePrice;
    const newVariant = data.variantLabel ?? oldSale.variantLabel;
    const newProduct = data.productName ?? oldSale.productName;
    const newTotalRevenue = newQty * newPrice;
    let needed = newQty;
    let totalCOGS = 0;
    const relevantBatches = updatedBatches.filter(b => b.productName === newProduct && b.stockType === StockType.FOR_SALE && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt); 
    const totalAvail = relevantBatches.reduce((sum, b) => (newVariant && b.variants) ? sum + (b.variants.find(v => v.label === newVariant)?.quantity || 0) : sum + b.currentQuantity, 0);

    if (needed > totalAvail) return alert(`Stok tidak mencukupi untuk jumlah editan baru. Tersedia: ${totalAvail} Unit`);

    for (const batch of relevantBatches) {
      if (needed <= 0) break;
      let availableInThisBatch = batch.currentQuantity;
      if (newVariant && batch.variants) {
        const v = batch.variants.find(v => v.label === newVariant);
        if (!v || v.quantity <= 0) continue;
        availableInThisBatch = v.quantity;
      }
      const take = Math.min(availableInThisBatch, needed);
      if (take <= 0) continue;
      const bIdx = updatedBatches.findIndex(b => b.id === batch.id);
      updatedBatches[bIdx].currentQuantity -= take;
      if (newVariant && updatedBatches[bIdx].variants) {
        const vIdx = updatedBatches[bIdx].variants!.findIndex(v => v.label === newVariant);
        if (vIdx !== -1) updatedBatches[bIdx].variants![vIdx].quantity -= take;
      }
      needed -= take;
      totalCOGS += take * batch.buyPrice;
    }

    const updatedSale: SaleRecord = { ...oldSale, ...data, totalCOGS, quantity: newQty, salePrice: newPrice, totalRevenue: newTotalRevenue };
    const updatedSales = stateRef.current.sales.map(s => s.id === id ? updatedSale : s);
    const updatedTransactions = stateRef.current.transactions.map(t => {
      if (t.relatedId === id && t.category === TransactionCategory.SALES) return { ...t, amount: newTotalRevenue, description: `PENJUALAN: ${updatedSale.productName}${updatedSale.variantLabel ? ` (${updatedSale.variantLabel})` : ''}`, createdAt: updatedSale.createdAt || t.createdAt };
      if (oldSale.related_order_id && t.relatedId === oldSale.related_order_id && t.category === TransactionCategory.SALES && t.description.includes("PELUNASAN SISA ORDER")) {
         const order = stateRef.current.dpOrders.find(o => o.id === oldSale.related_order_id);
         if (order) return { ...t, amount: newTotalRevenue - order.dpAmount, description: `PELUNASAN SISA ORDER: ${order.customerName} (${updatedSale.productName})` };
      }
      return t;
    });
    setState(prev => ({ ...prev, batches: updatedBatches, sales: updatedSales, transactions: updatedTransactions }));
  };

  const deleteSale = async (id: string) => {
    const sale = stateRef.current.sales.find(s => s.id === id);
    if (!sale) return;
    let updatedBatches = [...stateRef.current.batches];
    let toRestore = sale.quantity;
    const sameItems = updatedBatches.filter(b => b.productName === sale.productName && b.stockType === StockType.FOR_SALE).sort((a, b) => b.createdAt - a.createdAt);
    for (const batch of sameItems) {
      if (toRestore <= 0) break;
      const bIdx = updatedBatches.findIndex(b => b.id === batch.id);
      if (sale.variantLabel && updatedBatches[bIdx].variants) {
        const vIdx = updatedBatches[bIdx].variants!.findIndex(v => v.label === sale.variantLabel);
        if (vIdx !== -1) { updatedBatches[bIdx].variants![vIdx].quantity += toRestore; updatedBatches[bIdx].currentQuantity += toRestore; toRestore = 0; break; }
      }
      const space = batch.initialQuantity - batch.currentQuantity;
      const amount = Math.min(space, toRestore);
      updatedBatches[bIdx].currentQuantity += amount;
      toRestore -= amount;
    }
    let updatedOrders = [...stateRef.current.dpOrders];
    let updatedTransactions = stateRef.current.transactions.filter(t => !(t.relatedId === sale.related_order_id && t.description.includes("PELUNASAN SISA ORDER")));
    if (sale.related_order_id) {
      const oIdx = updatedOrders.findIndex(o => o.id === sale.related_order_id);
      if (oIdx !== -1) {
        updatedOrders[oIdx] = { ...updatedOrders[oIdx], status: DPStatus.PENDING, completedAt: undefined };
        updatedTransactions = updatedTransactions.map(t => (t.relatedId === sale.related_order_id && t.category === TransactionCategory.SALES && t.description.includes("PELUNASAN DP")) ? { ...t, category: TransactionCategory.DEPOSIT, description: `DP ORDER: ${updatedOrders[oIdx].customerName} (${updatedOrders[oIdx].productName})` } : t);
      }
    }
    setState(prev => ({ ...prev, batches: updatedBatches, sales: prev.sales.filter(s => s.id !== id), dpOrders: updatedOrders, transactions: updatedTransactions }));
  };

  const addDPOrder = async (data: Omit<DPOrder, 'id' | 'createdAt' | 'status'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newOrder: DPOrder = { ...data, id: crypto.randomUUID(), createdAt: timestamp, status: DPStatus.PENDING };
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.DEPOSIT, amount: data.dpAmount, description: `DP ORDER: ${data.customerName} (${data.productName})`, createdAt: timestamp, relatedId: newOrder.id, paymentMethod };
    setState(prev => ({ ...prev, dpOrders: [...prev.dpOrders, newOrder], transactions: [...prev.transactions, tx] }));
  };

  const updateDPOrder = async (id: string, data: Partial<DPOrder>) => {
    const updatedOrders = stateRef.current.dpOrders.map(o => o.id === id ? { ...o, ...data } : o);
    const updatedOrder = updatedOrders.find(o => o.id === id);
    let updatedTransactions = stateRef.current.transactions.map(t => (updatedOrder && t.relatedId === id && t.category === TransactionCategory.DEPOSIT) ? { ...t, amount: updatedOrder.dpAmount, description: `DP ORDER: ${updatedOrder.customerName} (${updatedOrder.productName})`, createdAt: updatedOrder.createdAt || t.createdAt } : t);
    setState(prev => ({ ...prev, dpOrders: updatedOrders, transactions: updatedTransactions }));
  };

  const completeDPOrder = async (id: string, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const order = stateRef.current.dpOrders.find(o => o.id === id);
    if (!order || order.status !== DPStatus.PENDING) return;
    const timestamp = customDate || Date.now();
    let updatedTransactions = stateRef.current.transactions.map(t => t.relatedId === order.id && t.category === TransactionCategory.DEPOSIT ? { ...t, category: TransactionCategory.SALES, description: `PELUNASAN DP: ${order.customerName} (${order.productName})` } : t);
    updatedTransactions.push({ id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.SALES, amount: order.totalAmount - order.dpAmount, description: `PELUNASAN SISA ORDER: ${order.customerName} (${order.productName})`, createdAt: timestamp, relatedId: order.id, paymentMethod });
    let needed = order.quantity;
    let totalCOGS = 0;
    let updatedBatches = [...stateRef.current.batches];
    const relevant = updatedBatches.filter(b => b.productName === order.productName && b.stockType === StockType.FOR_SALE && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);
    if (relevant.reduce((s, b) => s + b.currentQuantity, 0) < needed) return alert(`Stok ${order.productName} tidak mencukupi.`);
    
    for (const batch of relevant) {
      if (needed <= 0) break;
      const take = Math.min(batch.currentQuantity, needed);
      const idx = updatedBatches.findIndex(b => b.id === batch.id);
      updatedBatches[idx].currentQuantity -= take;
      needed -= take; totalCOGS += take * batch.buyPrice;
    }
    const saleId = crypto.randomUUID();
    const sale: SaleRecord = { id: saleId, productName: order.productName, quantity: order.quantity, salePrice: order.totalAmount / order.quantity, totalRevenue: order.totalAmount, totalCOGS, createdAt: timestamp, related_order_id: order.id };
    const updatedOrders = stateRef.current.dpOrders.map(o => o.id === id ? { ...o, status: DPStatus.COMPLETED, completedAt: timestamp } : o);
    setState(prev => ({ ...prev, dpOrders: updatedOrders, sales: [...prev.sales, sale], transactions: updatedTransactions, batches: updatedBatches }));
  };

  const cancelDPOrder = async (id: string, customDate?: number) => {
    const order = stateRef.current.dpOrders.find(o => o.id === id);
    if (!order || order.status !== DPStatus.PENDING) return;
    const updatedTransactions = stateRef.current.transactions.map(t => t.relatedId === order.id && t.category === TransactionCategory.DEPOSIT ? { ...t, category: TransactionCategory.FORFEITED_DP, description: `DP HANGUS: ${order.customerName} (${order.productName})` } : t);
    const updatedOrders = stateRef.current.dpOrders.map(o => o.id === id ? { ...o, status: DPStatus.CANCELLED, completedAt: customDate || Date.now() } : o);
    setState(prev => ({ ...prev, dpOrders: updatedOrders, transactions: updatedTransactions }));
  };

  const deleteDPOrder = async (id: string) => {
    const order = stateRef.current.dpOrders.find(o => o.id === id);
    if (!order || order.status === DPStatus.COMPLETED) return;
    setState(prev => ({ ...prev, dpOrders: prev.dpOrders.filter(o => o.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
  };

  const addManualTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>, customDate?: number) => {
    setState(prev => ({ ...prev, transactions: [...prev.transactions, { ...data, id: crypto.randomUUID(), createdAt: customDate || Date.now() }] }));
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    setState(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === id ? { ...t, ...data } : t) }));
  };

  const deleteTransaction = async (id: string) => {
    const tx = stateRef.current.transactions.find(t => t.id === id);
    if (!tx || tx.relatedId) return alert("Hapus melalui modul terkait.");
    setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
  };

  const transferFunds = async (amount: number, from: 'CASH' | 'BANK', to: 'CASH' | 'BANK', note: string, customDate?: number) => {
    const timestamp = customDate || Date.now();
    const gid = crypto.randomUUID();
    const txs: Transaction[] = [
      { id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.TRANSFER, amount, description: `TRANSFER: ${from} -> ${to}${note ? ` (${note})` : ''}`, createdAt: timestamp, paymentMethod: from, relatedId: gid },
      { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.TRANSFER, amount, description: `TERIMA TRANSFER DARI ${from}${note ? ` (${note})` : ''}`, createdAt: timestamp, paymentMethod: to, relatedId: gid }
    ];
    setState(prev => ({ ...prev, transactions: [...prev.transactions, ...txs] }));
  };

  const addLoan = async (data: Omit<Loan, 'id' | 'createdAt' | 'remainingAmount'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newLoan: Loan = { ...data, id: crypto.randomUUID(), remainingAmount: data.initialAmount, createdAt: timestamp };
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.LOAN_PROCEEDS, amount: data.initialAmount, description: `PENCAIRAN PINJAMAN: ${data.source}`, createdAt: timestamp, relatedId: newLoan.id, paymentMethod };
    setState(prev => ({ ...prev, loans: [...prev.loans, newLoan], transactions: [...prev.transactions, tx] }));
  };

  const updateLoan = async (id: string, data: Partial<Loan>, paymentMethod?: 'CASH' | 'BANK', customDate?: number) => {
    const old = stateRef.current.loans.find(l => l.id === id);
    if (!old) return;
    const newInitial = data.initialAmount ?? old.initialAmount;
    const newRemaining = old.remainingAmount + (newInitial - old.initialAmount);
    const newTimestamp = customDate || old.createdAt;
    const updatedLoans = stateRef.current.loans.map(l => l.id === id ? { ...l, ...data, remainingAmount: newRemaining, createdAt: newTimestamp } : l);
    const updatedTransactions = stateRef.current.transactions.map(t => (t.relatedId === id && t.category === TransactionCategory.LOAN_PROCEEDS) ? { ...t, amount: newInitial, description: `PENCAIRAN PINJAMAN: ${data.source || old.source}`, createdAt: newTimestamp, paymentMethod: paymentMethod || t.paymentMethod } : t);
    setState(prev => ({ ...prev, loans: updatedLoans, transactions: updatedTransactions }));
  };

  const repayLoan = async (loanId: string, principal: number, interest: number, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const loan = stateRef.current.loans.find(l => l.id === loanId);
    if (!loan) return;
    const timestamp = customDate || Date.now();
    const txs: Transaction[] = [];
    if (principal > 0) txs.push({ id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.LOAN_REPAYMENT, amount: principal, description: `PELUNASAN POKOK: ${loan.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod });
    if (interest > 0) txs.push({ id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.OPERATIONAL, amount: interest, description: `BUNGA PINJAMAN: ${loan.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod });
    const updatedLoans = stateRef.current.loans.map(l => l.id === loanId ? { ...l, remainingAmount: Math.max(0, l.remainingAmount - principal) } : l);
    setState(prev => ({ ...prev, loans: updatedLoans, transactions: [...prev.transactions, ...txs] }));
  };

  const deleteLoan = async (id: string) => {
    const loan = stateRef.current.loans.find(l => l.id === id);
    if (!loan || loan.remainingAmount < loan.initialAmount) return alert("Hapus cicilan di riwayat terlebih dahulu.");
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
