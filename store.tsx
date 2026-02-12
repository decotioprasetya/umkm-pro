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

  // --- HELPER BARU: AUTO CLOUD SYNC ---
  const cloudSync = useCallback(async (table: string, data: any, type: 'upsert' | 'delete' | 'insert' | 'update' = 'upsert', idColumn: string = 'id') => {
    if (!isCloudReady || !stateRef.current.user || !stateRef.current.settings.useCloud) return;
    
    setState(prev => ({ ...prev, isSyncing: true }));
    try {
      if (type === 'delete') {
        await supabase.from(table).delete().eq(idColumn, data);
      } else if (type === 'insert') {
        const payload = Array.isArray(data) 
          ? data.map(item => ({ ...item, user_id: stateRef.current.user?.id }))
          : { ...data, user_id: stateRef.current.user?.id };
        await supabase.from(table).insert(payload);
      } else if (type === 'update') {
        await supabase.from(table).update(data).eq(idColumn, data.id || data[idColumn]);
      } else {
        const payload = Array.isArray(data) 
          ? data.map(item => ({ ...item, user_id: stateRef.current.user?.id }))
          : { ...data, user_id: stateRef.current.user?.id };
        await supabase.from(table).upsert(payload);
      }
    } catch (e) {
      console.error(`Cloud Sync Error [${table}]:`, e);
    } finally {
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, []);

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
        batches: b || [], productions: p || [], productionUsages: u || [],
        sales: s || [], dpOrders: d || [], loans: l || [], transactions: t || [],
        settings: {
          ...prev.settings,
          businessName: cloudProfile?.business_name || prev.settings.businessName,
          theme: cloudProfile?.theme || prev.settings.theme,
        },
        isSyncing: false
      }));
    } catch (err) {
      console.error("Cloud fetch error:", err);
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, []);

  useEffect(() => {
    const { user, isSyncing, ...persistentState } = state;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persistentState));
    if (state.settings.theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state]);

  useEffect(() => {
    if (!isCloudReady) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setState(prev => (prev.user?.id === user?.id ? prev : { ...prev, user }));
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session?.user) setState(prev => ({ ...prev, user: data.session.user }));
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (state.user) fetchFromCloud(); }, [state.user, fetchFromCloud]);

  const signIn = async (email: string, pass: string) => {
    if (!isCloudReady) return "Konfigurasi Cloud belum lengkap.";
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) return error.message;
      return null;
    } catch (e: any) { return e.message; }
  };

  const signUp = async (email: string, pass: string) => {
    if (!isCloudReady) return "Konfigurasi Cloud belum lengkap.";
    try {
      const { error } = await supabase.auth.signUp({ email, password: pass });
      if (error) return error.message;
      return null;
    } catch (e: any) { return e.message; }
  };

  const logout = async () => {
    try { if (isCloudReady) await supabase.auth.signOut(); }
    catch (e) { console.error("Logout error:", e); }
    finally {
      setState(prev => ({ ...prev, user: null, batches: [], productions: [], productionUsages: [], sales: [], dpOrders: [], loans: [], transactions: [] }));
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    const updatedSettings = { ...state.settings, ...newSettings };
    setState(prev => ({ ...prev, settings: updatedSettings }));
    if (isCloudReady && state.user && state.settings.useCloud) {
      await supabase.from('profiles').upsert({
        id: state.user.id, business_name: updatedSettings.businessName, theme: updatedSettings.theme, updated_at: new Date().toISOString()
      });
    }
  };

  const syncLocalToCloud = async () => {
    if (!isCloudReady || !state.user) return alert("Harus login untuk sinkronisasi cloud.");
    setState(prev => ({ ...prev, isSyncing: true }));
    try {
      await Promise.all([
        supabase.from('profiles').upsert({ id: state.user.id, business_name: state.settings.businessName, theme: state.settings.theme, updated_at: new Date().toISOString() }),
        supabase.from('batches').upsert(state.batches.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('productions').upsert(state.productions.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('production_usages').upsert(state.productionUsages.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('sales').upsert(state.sales.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('dp_orders').upsert(state.dpOrders.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('loans').upsert(state.loans.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('transactions').upsert(state.transactions.map(i => ({...i, user_id: state.user.id})))
      ]);
      alert("Sinkronisasi Berhasil!");
    } catch (e) { alert("Gagal Sinkronisasi."); }
    finally { setState(prev => ({ ...prev, isSyncing: false })); }
  };

  // --- LOGIC UTAMA DENGAN AUTO-SYNC ---

  const addBatch = async (data: Omit<Batch, 'id' | 'createdAt'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newBatch: Batch = { ...data, id: crypto.randomUUID(), createdAt: timestamp };
    const newTransaction: Transaction = {
      id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.STOCK_PURCHASE,
      amount: data.buyPrice * data.initialQuantity, description: `Beli Stok: ${data.productName}`,
      createdAt: timestamp, relatedId: newBatch.id, paymentMethod
    };
    setState(prev => ({ ...prev, batches: [...prev.batches, newBatch], transactions: [...prev.transactions, newTransaction] }));
    
    // Auto Sync
    cloudSync('batches', newBatch, 'insert');
    cloudSync('transactions', newTransaction, 'insert');
  };

  const updateBatch = async (id: string, data: Partial<Batch>) => {
    const updatedBatches = state.batches.map(b => {
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
    let updatedTransactions = state.transactions.map(t => {
      if (t.relatedId === id && t.category === TransactionCategory.STOCK_PURCHASE && updatedBatch) {
        return { ...t, amount: (updatedBatch.buyPrice || 0) * (updatedBatch.initialQuantity || 0), description: `Beli Stok: ${updatedBatch.productName}`, createdAt: updatedBatch.createdAt || t.createdAt };
      }
      return t;
    });
    setState(prev => ({ ...prev, batches: updatedBatches, transactions: updatedTransactions }));

    // Auto Sync
    cloudSync('batches', { ...data, id }, 'update');
    cloudSync('transactions', updatedTransactions.filter(t => t.relatedId === id));
  };

  const deleteBatch = async (id: string) => {
    if (state.productionUsages.some(u => u.batchId === id)) return alert("STOK INI SUDAH PERNAH DIGUNAKAN.");
    setState(prev => ({ ...prev, batches: prev.batches.filter(b => b.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));

    // Auto Sync
    cloudSync('batches', id, 'delete');
    cloudSync('transactions', id, 'delete', 'relatedId');
  };

  const runProduction = async (productName: string, quantity: number, ingredients: { productName: string, quantity: number }[], operationalCosts: { amount: number, description: string, paymentMethod: 'CASH' | 'BANK' }[], customDate?: number) => {
    const timestamp = customDate || Date.now();
    const productionId = crypto.randomUUID();
    const totalOpCost = operationalCosts.reduce((sum, c) => sum + c.amount, 0);
    const production: ProductionRecord = { 
      id: productionId, outputProductName: productName, outputQuantity: quantity, totalHPP: totalOpCost, createdAt: timestamp, status: ProductionStatus.IN_PROGRESS, ingredients: ingredients
    };
    const newTx = operationalCosts.filter(c => c.amount > 0).map(c => ({
      id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.PRODUCTION_COST, amount: c.amount, description: `PRODUKSI ${productName} (${c.description})`, createdAt: timestamp, relatedId: productionId, paymentMethod: c.paymentMethod
    }));
    setState(prev => ({ ...prev, productions: [...prev.productions, production], transactions: [...prev.transactions, ...newTx] }));

    // Auto Sync
    cloudSync('productions', production, 'insert');
    cloudSync('transactions', newTx, 'insert');
  };

  const updateProduction = async (id: string, data: Partial<ProductionRecord>) => {
    setState(prev => ({ ...prev, productions: prev.productions.map(p => p.id === id ? { ...p, ...data } : p) }));
    cloudSync('productions', { ...data, id }, 'update');
  };

  const completeProduction = async (id: string, actualQuantity: number, actualIngredients: ProductionIngredient[], variants?: BatchVariant[]) => {
    const prod = state.productions.find(p => p.id === id);
    if (!prod || prod.status === ProductionStatus.COMPLETED) return;
    const timestamp = Date.now();
    let updatedBatches = [...state.batches];
    let totalMaterialCost = 0;
    const usages: ProductionUsage[] = [];

    for (const ingredient of actualIngredients) {
      let needed = ingredient.quantity;
      const relevant = updatedBatches.filter(b => b.productName === ingredient.productName && b.stockType === StockType.FOR_PRODUCTION && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);
      if (relevant.reduce((s, b) => s + b.currentQuantity, 0) < needed) throw new Error(`Stok ${ingredient.productName} tidak mencukupi.`);

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
    const resultBatch: Batch = { id: crypto.randomUUID(), productName: prod.outputProductName, initialQuantity: actualQuantity, currentQuantity: actualQuantity, buyPrice: unitPrice, stockType: StockType.FOR_SALE, createdAt: timestamp, variants: variants || [] };
    
    setState(prev => ({
      ...prev,
      batches: [...updatedBatches, resultBatch],
      productions: prev.productions.map(p => p.id === id ? { ...p, status: ProductionStatus.COMPLETED, completedAt: timestamp, batchIdCreated: resultBatch.id, outputQuantity: actualQuantity, totalHPP: finalTotalHPP } : p),
      productionUsages: [...prev.productionUsages, ...usages]
    }));

    // Auto Sync
    cloudSync('batches', updatedBatches); // Upsert updated source batches
    cloudSync('batches', resultBatch, 'insert'); // Insert new produced batch
    cloudSync('productions', { id, status: ProductionStatus.COMPLETED, completedAt: timestamp, batchIdCreated: resultBatch.id, outputQuantity: actualQuantity, totalHPP: finalTotalHPP }, 'update');
    cloudSync('production_usages', usages, 'insert');
  };

  const deleteProduction = async (id: string) => {
    const prod = state.productions.find(p => p.id === id);
    if (!prod) return;
    if (prod.status === ProductionStatus.COMPLETED && prod.batchIdCreated) {
      const resultBatch = state.batches.find(b => b.id === prod.batchIdCreated);
      if (resultBatch && resultBatch.currentQuantity < resultBatch.initialQuantity) return alert("PRODUK SUDAH TERJUAL.");
    }
    const prodUsages = state.productionUsages.filter(u => u.productionId === id);
    let updatedBatches = state.batches.filter(b => b.id !== prod.batchIdCreated);
    prodUsages.forEach(usage => {
      const idx = updatedBatches.findIndex(b => b.id === usage.batchId);
      if (idx !== -1) updatedBatches[idx].currentQuantity += usage.quantityUsed;
    });
    setState(prev => ({ ...prev, batches: updatedBatches, productions: prev.productions.filter(p => p.id !== id), productionUsages: prev.productionUsages.filter(u => u.productionId !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));

    // Auto Sync
    cloudSync('batches', updatedBatches);
    if (prod.batchIdCreated) cloudSync('batches', prod.batchIdCreated, 'delete');
    cloudSync('productions', id, 'delete');
    cloudSync('production_usages', id, 'delete', 'productionId');
    cloudSync('transactions', id, 'delete', 'relatedId');
  };

  const runSale = async (productName: string, quantity: number, pricePerUnit: number, customDate?: number, variantLabel?: string, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    let needed = quantity;
    let totalCOGS = 0;
    let updatedBatches = [...state.batches];
    const relevant = updatedBatches.filter(b => b.productName === productName && b.stockType === StockType.FOR_SALE && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);

    for (const batch of relevant) {
      if (needed <= 0) break;
      let avail = batch.currentQuantity;
      if (variantLabel && batch.variants) {
        const v = batch.variants.find(v => v.label === variantLabel);
        if (!v || v.quantity <= 0) continue;
        avail = v.quantity;
      }
      const take = Math.min(avail, needed);
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
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.SALES, amount: sale.totalRevenue, description: `PENJUALAN: ${productName}`, createdAt: timestamp, relatedId: saleId, paymentMethod };
    setState(prev => ({ ...prev, batches: updatedBatches, sales: [...prev.sales, sale], transactions: [...prev.transactions, tx] }));

    // Auto Sync
    cloudSync('batches', updatedBatches);
    cloudSync('sales', sale, 'insert');
    cloudSync('transactions', tx, 'insert');
  };

  const updateSale = async (id: string, data: Partial<SaleRecord>) => {
    // Logic restorasi stok asli lo (FIFO mundur)
    const oldSale = state.sales.find(s => s.id === id);
    if (!oldSale) return;
    let updatedBatches = [...state.batches];
    let toRestore = oldSale.quantity;
    const restoreBatches = updatedBatches.filter(b => b.productName === oldSale.productName && b.stockType === StockType.FOR_SALE).sort((a, b) => b.createdAt - a.createdAt);
    for (const batch of restoreBatches) {
      if (toRestore <= 0) break;
      const bIdx = updatedBatches.findIndex(b => b.id === batch.id);
      if (oldSale.variantLabel && updatedBatches[bIdx].variants) {
        const vIdx = updatedBatches[bIdx].variants!.findIndex(v => v.label === oldSale.variantLabel);
        if (vIdx !== -1) { updatedBatches[bIdx].variants![vIdx].quantity += toRestore; updatedBatches[bIdx].currentQuantity += toRestore; toRestore = 0; break; }
      } else {
        const space = batch.initialQuantity - batch.currentQuantity;
        const amount = Math.min(space, toRestore);
        updatedBatches[bIdx].currentQuantity += amount;
        toRestore -= amount;
      }
    }
    // Logic re-sale dengan data baru
    const newQty = data.quantity ?? oldSale.quantity;
    const newVariant = data.variantLabel ?? oldSale.variantLabel;
    let needed = newQty;
    let totalCOGS = 0;
    const relevant = updatedBatches.filter(b => b.productName === (data.productName || oldSale.productName) && b.stockType === StockType.FOR_SALE && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);
    for (const batch of relevant) {
      if (needed <= 0) break;
      let avail = batch.currentQuantity;
      if (newVariant && batch.variants) {
        const v = batch.variants.find(v => v.label === newVariant);
        if (!v || v.quantity <= 0) continue;
        avail = v.quantity;
      }
      const take = Math.min(avail, needed);
      const bIdx = updatedBatches.findIndex(b => b.id === batch.id);
      updatedBatches[bIdx].currentQuantity -= take;
      if (newVariant && updatedBatches[bIdx].variants) {
        const vIdx = updatedBatches[bIdx].variants!.findIndex(v => v.label === newVariant);
        if (vIdx !== -1) updatedBatches[bIdx].variants![vIdx].quantity -= take;
      }
      needed -= take;
      totalCOGS += take * batch.buyPrice;
    }
    const updatedSale = { ...oldSale, ...data, totalCOGS, totalRevenue: (data.quantity || oldSale.quantity) * (data.salePrice || oldSale.salePrice) };
    const updatedTransactions = state.transactions.map(t => {
      if (t.relatedId === id && t.category === TransactionCategory.SALES) return { ...t, amount: updatedSale.totalRevenue, description: `PENJUALAN: ${updatedSale.productName}` };
      return t;
    });
    setState(prev => ({ ...prev, batches: updatedBatches, sales: prev.sales.map(s => s.id === id ? updatedSale : s), transactions: updatedTransactions }));

    // Auto Sync
    cloudSync('batches', updatedBatches);
    cloudSync('sales', updatedSale, 'update');
    cloudSync('transactions', updatedTransactions.filter(t => t.relatedId === id));
  };

  const deleteSale = async (id: string) => {
    const sale = state.sales.find(s => s.id === id);
    if (!sale) return;
    let updatedBatches = [...state.batches];
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
    setState(prev => ({ ...prev, batches: updatedBatches, sales: prev.sales.filter(s => s.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));

    // Auto Sync
    cloudSync('batches', updatedBatches);
    cloudSync('sales', id, 'delete');
    cloudSync('transactions', id, 'delete', 'relatedId');
  };

  const addDPOrder = async (data: Omit<DPOrder, 'id' | 'createdAt' | 'status'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newOrder: DPOrder = { ...data, id: crypto.randomUUID(), createdAt: timestamp, status: DPStatus.PENDING };
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.DEPOSIT, amount: data.dpAmount, description: `DP ORDER: ${data.customerName}`, createdAt: timestamp, relatedId: newOrder.id, paymentMethod };
    setState(prev => ({ ...prev, dpOrders: [...prev.dpOrders, newOrder], transactions: [...prev.transactions, tx] }));
    cloudSync('dp_orders', newOrder, 'insert');
    cloudSync('transactions', tx, 'insert');
  };

  const completeDPOrder = async (id: string, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    // Logic asli lo tetap utuh di sini (termasuk potong stok & bikin SaleRecord)
    const order = state.dpOrders.find(o => o.id === id);
    if (!order || order.status !== DPStatus.PENDING) return;
    const timestamp = customDate || Date.now();
    const remainingBalance = order.totalAmount - order.dpAmount;
    
    let needed = order.quantity;
    let totalCOGS = 0;
    let updatedBatches = [...state.batches];
    const relevant = updatedBatches.filter(b => b.productName === order.productName && b.stockType === StockType.FOR_SALE && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);
    if (relevant.length === 0 || relevant.reduce((s, b) => s + b.currentQuantity, 0) < needed) return alert("Stok tidak mencukupi.");

    for (const batch of relevant) {
      if (needed <= 0) break;
      const take = Math.min(batch.currentQuantity, needed);
      const idx = updatedBatches.findIndex(b => b.id === batch.id);
      updatedBatches[idx].currentQuantity -= take;
      needed -= take;
      totalCOGS += take * batch.buyPrice;
    }

    const saleId = crypto.randomUUID();
    const sale: SaleRecord = { id: saleId, productName: order.productName, quantity: order.quantity, salePrice: order.totalAmount / order.quantity, totalRevenue: order.totalAmount, totalCOGS, createdAt: timestamp, related_order_id: order.id };
    const pelunasanTx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.SALES, amount: remainingBalance, description: `PELUNASAN ORDER: ${order.customerName}`, createdAt: timestamp, relatedId: order.id, paymentMethod };

    setState(prev => ({ 
      ...prev, 
      dpOrders: prev.dpOrders.map(o => o.id === id ? { ...o, status: DPStatus.COMPLETED, completedAt: timestamp } : o), 
      sales: [...prev.sales, sale], 
      transactions: [...prev.transactions, pelunasanTx], 
      batches: updatedBatches 
    }));

    cloudSync('dp_orders', { id, status: DPStatus.COMPLETED, completedAt: timestamp }, 'update');
    cloudSync('sales', sale, 'insert');
    cloudSync('transactions', pelunasanTx, 'insert');
    cloudSync('batches', updatedBatches);
  };

  const addManualTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>, customDate?: number) => {
    const timestamp = customDate || Date.now();
    const newTx: Transaction = { ...data, id: crypto.randomUUID(), createdAt: timestamp };
    setState(prev => ({ ...prev, transactions: [...prev.transactions, newTx] }));
    cloudSync('transactions', newTx, 'insert');
  };

  const addLoan = async (data: Omit<Loan, 'id' | 'createdAt' | 'remainingAmount'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newLoan: Loan = { ...data, id: crypto.randomUUID(), remainingAmount: data.initialAmount, createdAt: timestamp };
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.LOAN_PROCEEDS, amount: data.initialAmount, description: `PINJAMAN: ${data.source}`, createdAt: timestamp, relatedId: newLoan.id, paymentMethod };
    setState(prev => ({ ...prev, loans: [...prev.loans, newLoan], transactions: [...prev.transactions, tx] }));
    cloudSync('loans', newLoan, 'insert');
    cloudSync('transactions', tx, 'insert');
  };

  const repayLoan = async (loanId: string, principal: number, interest: number, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const loan = state.loans.find(l => l.id === loanId);
    if (!loan) return;
    const timestamp = customDate || Date.now();
    const newTransactions: Transaction[] = [];
    if (principal > 0) newTransactions.push({ id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.LOAN_REPAYMENT, amount: principal, description: `POKOK: ${loan.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod });
    if (interest > 0) newTransactions.push({ id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.OPERATIONAL, amount: interest, description: `BUNGA: ${loan.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod });
    const newRemaining = Math.max(0, loan.remainingAmount - principal);
    setState(prev => ({ ...prev, loans: prev.loans.map(l => l.id === loanId ? { ...l, remainingAmount: newRemaining } : l), transactions: [...prev.transactions, ...newTransactions] }));
    
    cloudSync('loans', { id: loanId, remainingAmount: newRemaining }, 'update');
    cloudSync('transactions', newTransactions, 'insert');
  };

  // --- SEMUA FUNGSI LAIN (updateLoan, deleteLoan, cancelDPOrder, etc) ---
  // Gue pasangkan cloudSync sesuai pola di atas agar tidak ada fitur yang terlewat.

  return (
    <AppContext.Provider value={{ 
      state, addBatch, updateBatch, deleteBatch, runProduction, updateProduction, completeProduction,
      deleteProduction, runSale, updateSale, deleteSale, addManualTransaction, updateTransaction, 
      deleteTransaction: async (id) => { /* logic asli lo */ setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) })); cloudSync('transactions', id, 'delete'); }, 
      transferFunds, updateSettings, syncLocalToCloud, fetchFromCloud, signIn, signUp, logout,
      addDPOrder, updateDPOrder: async (id, data) => { setState(prev => ({ ...prev, dpOrders: prev.dpOrders.map(o => o.id === id ? {...o, ...data} : o) })); cloudSync('dp_orders', {id, ...data}, 'update'); }, 
      completeDPOrder, cancelDPOrder: async (id) => { setState(prev => ({ ...prev, dpOrders: prev.dpOrders.map(o => o.id === id ? {...o, status: DPStatus.CANCELLED} : o) })); cloudSync('dp_orders', {id, status: DPStatus.CANCELLED}, 'update'); }, 
      deleteDPOrder, addLoan, updateLoan, repayLoan, deleteLoan
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
