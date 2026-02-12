
import React, { createContext, useContext, useState, useEffect } from 'react';
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
  updateSettings: (settings: Partial<AppSettings>) => void;
  syncLocalToCloud: () => Promise<void>;
  signIn: (email: string, pass: string) => Promise<string | null>;
  signUp: (email: string, pass: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const STORAGE_KEY = 'umkm_pro_data_v3';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
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
        useCloud: false
      }
    };
    return { ...initialData, isSyncing: false, user: null };
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, isSyncing: false, user: null }));
    if (state.settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state]);

  useEffect(() => {
    if (!isCloudReady) return;
    (supabase.auth as any).getSession().then(({ data }: any) => {
      setState(prev => ({ ...prev, user: data?.session?.user ?? null }));
    });
    const { data: { subscription } } = (supabase.auth as any).onAuthStateChange((_event: any, session: any) => {
      setState(prev => ({ ...prev, user: session?.user ?? null }));
    });
    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, pass: string) => {
    if (!isCloudReady) return "Konfigurasi Cloud belum lengkap.";
    const { error } = await (supabase.auth as any).signInWithPassword({ email, password: pass });
    if (error) return error.message;
    return null;
  };

  const signUp = async (email: string, pass: string) => {
    if (!isCloudReady) return "Konfigurasi Cloud belum lengkap.";
    const { error } = await (supabase.auth as any).signUp({ email, password: pass });
    if (error) return error.message;
    return null;
  };

  const logout = async () => {
    if (isCloudReady) await (supabase.auth as any).signOut();
    setState(prev => ({ ...prev, user: null }));
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setState(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }));
  };

  const syncLocalToCloud = async () => {
    if (!isCloudReady || !state.user) return alert("Harus login untuk sinkronisasi cloud.");
    setState(prev => ({ ...prev, isSyncing: true }));
    try {
      await Promise.all([
        supabase.from('batches').upsert(state.batches.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('productions').upsert(state.productions.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('production_usages').upsert(state.productionUsages.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('sales').upsert(state.sales.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('dp_orders').upsert(state.dpOrders.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('loans').upsert(state.loans.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('transactions').upsert(state.transactions.map(i => ({...i, user_id: state.user.id})))
      ]);
      alert("Sinkronisasi Berhasil!");
    } catch (e) {
      alert("Gagal Sinkronisasi.");
    } finally {
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
    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('batches').insert({...newBatch, user_id: state.user.id}),
        supabase.from('transactions').insert({...newTransaction, user_id: state.user.id})
      ]);
    }
    setState(prev => ({ ...prev, batches: [...prev.batches, newBatch], transactions: [...prev.transactions, newTransaction] }));
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
    let updatedTransactions = [...state.transactions];

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

    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('batches').update({ ...data }).eq('id', id),
        supabase.from('transactions').upsert(updatedTransactions.filter(t => t.relatedId === id).map(t => ({...t, user_id: state.user.id})))
      ]);
    }
    setState(prev => ({ ...prev, batches: updatedBatches, transactions: updatedTransactions }));
  };

  const deleteBatch = async (id: string) => {
    const isUsed = state.productionUsages.some(u => u.batchId === id);
    if (isUsed) return alert("STOK INI SUDAH PERNAH DIGUNAKAN.");
    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('batches').delete().eq('id', id),
        supabase.from('transactions').delete().eq('relatedId', id)
      ]);
    }
    setState(prev => ({ ...prev, batches: prev.batches.filter(b => b.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
  };

  const runProduction = async (productName: string, quantity: number, ingredients: { productName: string, quantity: number }[], operationalCosts: { amount: number, description: string, paymentMethod: 'CASH' | 'BANK' }[], customDate?: number) => {
    const timestamp = customDate || Date.now();
    const productionId = crypto.randomUUID();
    
    // Alur baru: Tidak memotong stok bahan baku di awal, hanya mencatat rencana (planned ingredients).
    // Hal ini memungkinkan input 0 di awal dan pengisian riil di akhir.
    const totalOpCost = operationalCosts.reduce((sum, c) => sum + c.amount, 0);
    
    const production: ProductionRecord = { 
      id: productionId, 
      outputProductName: productName, 
      outputQuantity: quantity, 
      totalHPP: totalOpCost, // HPP awal hanya biaya operasional
      createdAt: timestamp, 
      status: ProductionStatus.IN_PROGRESS,
      ingredients: ingredients // Simpan rencana bahan
    };
    
    const newTx = operationalCosts.filter(c => c.amount > 0).map(c => ({
      id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.PRODUCTION_COST,
      amount: c.amount, description: `PRODUKSI ${productName} (${c.description})`, createdAt: timestamp, relatedId: productionId, paymentMethod: c.paymentMethod
    }));

    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('productions').insert({...production, user_id: state.user.id}),
        supabase.from('transactions').insert(newTx.map(i => ({...i, user_id: state.user.id})))
      ]);
    }
    setState(prev => ({ 
      ...prev, 
      productions: [...prev.productions, production], 
      transactions: [...prev.transactions, ...newTx] 
    }));
  };

  const updateProduction = async (id: string, data: Partial<ProductionRecord>) => {
    const updatedProductions = state.productions.map(p => p.id === id ? { ...p, ...data } : p);
    if (isCloudReady && state.user && state.settings.useCloud) {
      await supabase.from('productions').update({ ...data }).eq('id', id);
    }
    setState(prev => ({ ...prev, productions: updatedProductions }));
  };

  const completeProduction = async (id: string, actualQuantity: number, actualIngredients: ProductionIngredient[], variants?: BatchVariant[]) => {
    const prod = state.productions.find(p => p.id === id);
    if (!prod || prod.status === ProductionStatus.COMPLETED) return;
    
    const timestamp = Date.now();
    let updatedBatches = [...state.batches];
    let totalMaterialCost = 0;
    const usages: ProductionUsage[] = [];

    // Validasi & Potong Stok Bahan Baku Sekarang (FIFO)
    for (const ingredient of actualIngredients) {
      let needed = ingredient.quantity;
      if (needed <= 0) continue;

      const relevant = updatedBatches.filter(b => b.productName === ingredient.productName && b.stockType === StockType.FOR_PRODUCTION && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);
      
      const totalAvail = relevant.reduce((s, b) => s + b.currentQuantity, 0);
      if (totalAvail < needed) {
        throw new Error(`Stok ${ingredient.productName} tidak mencukupi. Tersedia: ${totalAvail}, Dibutuhkan: ${needed}`);
      }

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
      id: crypto.randomUUID(), 
      productName: prod.outputProductName, 
      initialQuantity: actualQuantity, 
      currentQuantity: actualQuantity, 
      buyPrice: unitPrice, 
      stockType: StockType.FOR_SALE, 
      createdAt: timestamp,
      variants: variants || []
    };

    const updatedProductions = state.productions.map(p => 
      p.id === id ? { 
        ...p, 
        status: ProductionStatus.COMPLETED, 
        completedAt: timestamp, 
        batchIdCreated: resultBatch.id,
        outputQuantity: actualQuantity,
        totalHPP: finalTotalHPP
      } : p
    );

    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('batches').upsert(updatedBatches.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('productions').update({ 
          status: ProductionStatus.COMPLETED, 
          completedAt: timestamp, 
          batchIdCreated: resultBatch.id,
          outputQuantity: actualQuantity,
          totalHPP: finalTotalHPP
        }).eq('id', id),
        supabase.from('production_usages').insert(usages.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('batches').insert({ ...resultBatch, user_id: state.user.id })
      ]);
    }

    setState(prev => ({
      ...prev,
      batches: [...updatedBatches, resultBatch],
      productions: updatedProductions,
      productionUsages: [...prev.productionUsages, ...usages]
    }));
  };

  const deleteProduction = async (id: string) => {
    const prod = state.productions.find(p => p.id === id);
    if (!prod) return;
    
    if (prod.status === ProductionStatus.COMPLETED && prod.batchIdCreated) {
      const resultBatch = state.batches.find(b => b.id === prod.batchIdCreated);
      if (resultBatch && resultBatch.currentQuantity < resultBatch.initialQuantity) return alert("PRODUK SUDAH TERJUAL.");
    }

    const prodUsages = state.productionUsages.filter(u => u.productionId === id);
    let updatedBatches = [...state.batches];
    prodUsages.forEach(usage => {
      const idx = updatedBatches.findIndex(b => b.id === usage.batchId);
      if (idx !== -1) updatedBatches[idx].currentQuantity += usage.quantityUsed;
    });

    if (prod.batchIdCreated) {
      updatedBatches = updatedBatches.filter(b => b.id !== prod.batchIdCreated);
    }

    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('batches').upsert(updatedBatches.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('productions').delete().eq('id', id),
        supabase.from('production_usages').delete().eq('productionId', id),
        supabase.from('transactions').delete().eq('relatedId', id)
      ]);
    }
    setState(prev => ({ 
      ...prev, 
      batches: updatedBatches, 
      productions: prev.productions.filter(p => p.id !== id), 
      productionUsages: prev.productionUsages.filter(u => u.productionId !== id), 
      transactions: prev.transactions.filter(t => t.relatedId !== id) 
    }));
  };

  const runSale = async (productName: string, quantity: number, pricePerUnit: number, customDate?: number, variantLabel?: string, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    let needed = quantity;
    let totalCOGS = 0;
    let updatedBatches = [...state.batches];
    
    const relevant = updatedBatches.filter(b => 
      b.productName === productName && 
      b.stockType === StockType.FOR_SALE && 
      b.currentQuantity > 0
    ).sort((a, b) => a.createdAt - b.createdAt);

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
    const sale: SaleRecord = { 
      id: saleId, productName, variantLabel, quantity, salePrice: pricePerUnit, totalRevenue: quantity * pricePerUnit, totalCOGS, createdAt: timestamp 
    };
    const tx: Transaction = { 
      id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.SALES, 
      amount: sale.totalRevenue, description: `PENJUALAN: ${productName}${variantLabel ? ` (${variantLabel})` : ''}`, 
      createdAt: timestamp, relatedId: saleId, paymentMethod
    };

    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('batches').upsert(updatedBatches.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('sales').insert({...sale, user_id: state.user.id}),
        supabase.from('transactions').insert({...tx, user_id: state.user.id})
      ]);
    }
    setState(prev => ({ ...prev, batches: updatedBatches, sales: [...prev.sales, sale], transactions: [...prev.transactions, tx] }));
  };

  const updateSale = async (id: string, data: Partial<SaleRecord>) => {
    const oldSale = state.sales.find(s => s.id === id);
    if (!oldSale) return;

    let updatedBatches = [...state.batches];

    // 1. "Undo" Penjualan Lama (Kembalikan Stok)
    let toRestore = oldSale.quantity;
    const sameProductBatches = updatedBatches
      .filter(b => b.productName === oldSale.productName && b.stockType === StockType.FOR_SALE)
      .sort((a, b) => b.createdAt - a.createdAt); // LIFO restoration to preserve FIFO integrity

    for (const batch of sameProductBatches) {
      if (toRestore <= 0) break;
      const bIdx = updatedBatches.findIndex(b => b.id === batch.id);
      
      if (oldSale.variantLabel && updatedBatches[bIdx].variants) {
        const vIdx = updatedBatches[bIdx].variants!.findIndex(v => v.label === oldSale.variantLabel);
        if (vIdx !== -1) {
          updatedBatches[bIdx].variants![vIdx].quantity += toRestore;
          updatedBatches[bIdx].currentQuantity += toRestore;
          toRestore = 0;
          break;
        }
      } else {
        const space = batch.initialQuantity - batch.currentQuantity;
        const amount = Math.min(space, toRestore);
        updatedBatches[bIdx].currentQuantity += amount;
        toRestore -= amount;
      }
    }

    // 2. "Redo" Penjualan dengan Data Baru (Gunakan FIFO Kembali)
    const newQty = data.quantity ?? oldSale.quantity;
    const newPrice = data.salePrice ?? oldSale.salePrice;
    const newVariant = data.variantLabel ?? oldSale.variantLabel;
    const newProduct = data.productName ?? oldSale.productName;
    const newTotalRevenue = newQty * newPrice;
    
    let needed = newQty;
    let totalCOGS = 0;
    const relevantBatches = updatedBatches
      .filter(b => b.productName === newProduct && b.stockType === StockType.FOR_SALE && b.currentQuantity > 0)
      .sort((a, b) => a.createdAt - b.createdAt); // FIFO

    // Cek kecukupan stok setelah undo
    const totalAvail = relevantBatches.reduce((sum, b) => {
      if (newVariant && b.variants) {
        return sum + (b.variants.find(v => v.label === newVariant)?.quantity || 0);
      }
      return sum + b.currentQuantity;
    }, 0);

    if (needed > totalAvail) {
      alert(`Stok tidak mencukupi untuk jumlah editan baru. Tersedia: ${totalAvail} Unit`);
      return;
    }

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
        const vIdx = updatedBatches[bIdx].variants!.findIndex(v => v.label === variantLabel);
        if (vIdx !== -1) updatedBatches[bIdx].variants![vIdx].quantity -= take;
      }
      needed -= take;
      totalCOGS += take * batch.buyPrice;
    }

    // 3. Update Record Penjualan & Transaksi Keuangan
    const updatedSale: SaleRecord = { 
      ...oldSale, 
      ...data, 
      totalCOGS, 
      quantity: newQty, 
      salePrice: newPrice, 
      totalRevenue: newTotalRevenue 
    };
    
    const updatedSales = state.sales.map(s => s.id === id ? updatedSale : s);
    const updatedTransactions = state.transactions.map(t => {
      if (t.relatedId === id && t.category === TransactionCategory.SALES) {
        return {
          ...t,
          amount: newTotalRevenue,
          description: `PENJUALAN: ${updatedSale.productName}${updatedSale.variantLabel ? ` (${updatedSale.variantLabel})` : ''}`,
          createdAt: updatedSale.createdAt || t.createdAt
        };
      }
      if (oldSale.related_order_id && t.relatedId === oldSale.related_order_id && t.category === TransactionCategory.SALES && t.description.includes("PELUNASAN SISA ORDER")) {
         const order = state.dpOrders.find(o => o.id === oldSale.related_order_id);
         if (order) {
            const newRemainingAmount = newTotalRevenue - order.dpAmount;
            return {
              ...t,
              amount: newRemainingAmount,
              description: `PELUNASAN SISA ORDER: ${order.customerName} (${updatedSale.productName})`
            };
         }
      }
      return t;
    });

    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('batches').upsert(updatedBatches.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('sales').update({ ...updatedSale }).eq('id', id),
        supabase.from('transactions').upsert(updatedTransactions.filter(t => t.relatedId === id || (oldSale.related_order_id && t.relatedId === oldSale.related_order_id)).map(t => ({...t, user_id: state.user.id})))
      ]);
    }
    setState(prev => ({ 
      ...prev, 
      batches: updatedBatches, 
      sales: updatedSales, 
      transactions: updatedTransactions 
    }));
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
        if (vIdx !== -1) {
            updatedBatches[bIdx].variants![vIdx].quantity += toRestore;
            updatedBatches[bIdx].currentQuantity += toRestore;
            toRestore = 0;
            break;
        }
      }
      const space = batch.initialQuantity - batch.currentQuantity;
      const amount = Math.min(space, toRestore);
      updatedBatches[bIdx].currentQuantity += amount;
      toRestore -= amount;
    }

    let updatedOrders = [...state.dpOrders];
    let updatedTransactions = [...state.transactions];

    if (sale.related_order_id) {
      const orderIdx = updatedOrders.findIndex(o => o.id === sale.related_order_id);
      if (orderIdx !== -1) {
        updatedOrders[orderIdx] = { ...updatedOrders[orderIdx], status: DPStatus.PENDING, completedAt: undefined };
        updatedTransactions = updatedTransactions.filter(t => !(t.relatedId === sale.related_order_id && t.description.includes("PELUNASAN SISA ORDER")));
        updatedTransactions = updatedTransactions.map(t => (t.relatedId === sale.related_order_id && t.category === TransactionCategory.SALES && t.description.includes("PELUNASAN DP")) ? { ...t, category: TransactionCategory.DEPOSIT, description: `DP ORDER: ${updatedOrders[orderIdx].customerName} (${updatedOrders[orderIdx].productName})` } : t);
      }
    }

    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('batches').upsert(updatedBatches.map(i => ({...i, user_id: state.user.id}))),
        supabase.from('sales').delete().eq('id', id),
        supabase.from('dp_orders').update({ status: DPStatus.PENDING, completedAt: null }).eq('id', sale.related_order_id || ''),
        supabase.from('transactions').upsert(updatedTransactions.map(t => ({...t, user_id: state.user.id})))
      ]);
    }
    setState(prev => ({ ...prev, batches: updatedBatches, sales: prev.sales.filter(s => s.id !== id), dpOrders: updatedOrders, transactions: updatedTransactions }));
  };

  const addDPOrder = async (data: Omit<DPOrder, 'id' | 'createdAt' | 'status'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newOrder: DPOrder = { ...data, id: crypto.randomUUID(), createdAt: timestamp, status: DPStatus.PENDING };
    const tx: Transaction = { 
      id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.DEPOSIT, 
      amount: data.dpAmount, description: `DP ORDER: ${data.customerName} (${data.productName})`, 
      createdAt: timestamp, relatedId: newOrder.id, paymentMethod
    };
    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('dp_orders').insert({...newOrder, user_id: state.user.id}),
        supabase.from('transactions').insert({...tx, user_id: state.user.id})
      ]);
    }
    setState(prev => ({ ...prev, dpOrders: [...prev.dpOrders, newOrder], transactions: [...prev.transactions, tx] }));
  };

  const updateDPOrder = async (id: string, data: Partial<DPOrder>) => {
    const updatedOrders = state.dpOrders.map(o => o.id === id ? { ...o, ...data } : o);
    const updatedOrder = updatedOrders.find(o => o.id === id);
    let updatedTransactions = [...state.transactions];
    if (updatedOrder) {
      updatedTransactions = updatedTransactions.map(t => {
        if (t.relatedId === id && t.category === TransactionCategory.DEPOSIT) {
          return { ...t, amount: updatedOrder.dpAmount, description: `DP ORDER: ${updatedOrder.customerName} (${updatedOrder.productName})`, createdAt: updatedOrder.createdAt || t.createdAt };
        }
        return t;
      });
    }
    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('dp_orders').update({ ...data }).eq('id', id),
        supabase.from('transactions').upsert(updatedTransactions.filter(t => t.relatedId === id).map(t => ({...t, user_id: state.user.id})))
      ]);
    }
    setState(prev => ({ ...prev, dpOrders: updatedOrders, transactions: updatedTransactions }));
  };

  const completeDPOrder = async (id: string, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const order = state.dpOrders.find(o => o.id === id);
    if (!order || order.status !== DPStatus.PENDING) return;
    const timestamp = customDate || Date.now();
    const remainingBalance = order.totalAmount - order.dpAmount;
    let updatedTransactions = state.transactions.map(t => t.relatedId === order.id && t.category === TransactionCategory.DEPOSIT ? { ...t, category: TransactionCategory.SALES, description: `PELUNASAN DP: ${order.customerName} (${order.productName})` } : t);
    const pelunasanTx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.SALES, amount: remainingBalance, description: `PELUNASAN SISA ORDER: ${order.customerName} (${order.productName})`, createdAt: timestamp, relatedId: order.id, paymentMethod };
    updatedTransactions.push(pelunasanTx);
    let needed = order.quantity;
    let totalCOGS = 0;
    let updatedBatches = [...state.batches];
    const relevant = updatedBatches.filter(b => b.productName === order.productName && b.stockType === StockType.FOR_SALE && b.currentQuantity > 0).sort((a, b) => a.createdAt - b.createdAt);
    if (relevant.length === 0 || relevant.reduce((s, b) => s + b.currentQuantity, 0) < needed) return alert(`Stok ${order.productName} tidak mencukupi untuk menyelesaikan order ini.`);
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
    const updatedOrders = state.dpOrders.map(o => o.id === id ? { ...o, status: DPStatus.COMPLETED, completedAt: timestamp } : o);
    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('dp_orders').update({ status: DPStatus.COMPLETED, completedAt: timestamp }).eq('id', id),
        supabase.from('sales').insert({...sale, user_id: state.user.id}),
        supabase.from('transactions').upsert(updatedTransactions.map(t => ({...t, user_id: state.user.id}))),
        supabase.from('batches').upsert(updatedBatches.map(i => ({...i, user_id: state.user.id})))
      ]);
    }
    setState(prev => ({ ...prev, dpOrders: updatedOrders, sales: [...prev.sales, sale], transactions: updatedTransactions, batches: updatedBatches }));
  };

  const cancelDPOrder = async (id: string, customDate?: number) => {
    const order = state.dpOrders.find(o => o.id === id);
    if (!order || order.status !== DPStatus.PENDING) return;
    const timestamp = customDate || Date.now();
    const updatedTransactions = state.transactions.map(t => t.relatedId === order.id && t.category === TransactionCategory.DEPOSIT ? { ...t, category: TransactionCategory.FORFEITED_DP, description: `DP HANGUS: ${order.customerName} (${order.productName})` } : t);
    const updatedOrders = state.dpOrders.map(o => o.id === id ? { ...o, status: DPStatus.CANCELLED, completedAt: timestamp } : o);
    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('dp_orders').update({ status: DPStatus.CANCELLED, completedAt: timestamp }).eq('id', id),
        supabase.from('transactions').upsert(updatedTransactions.map(t => ({...t, user_id: state.user.id})))
      ]);
    }
    setState(prev => ({ ...prev, dpOrders: updatedOrders, transactions: updatedTransactions }));
  };

  const deleteDPOrder = async (id: string) => {
    const order = state.dpOrders.find(o => o.id === id);
    if (!order) return;
    if (order.status === DPStatus.COMPLETED) return alert("Gunakan menu Penjualan untuk membatalkan order yang sudah SELESAI agar stok dan omset kembali otomatis.");
    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('dp_orders').delete().eq('id', id),
        supabase.from('transactions').delete().eq('relatedId', id)
      ]);
    }
    setState(prev => ({ ...prev, dpOrders: prev.dpOrders.filter(o => o.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
  };

  const addManualTransaction = async (data: Omit<Transaction, 'id' | 'createdAt'>, customDate?: number) => {
    const timestamp = customDate || Date.now();
    const newTx: Transaction = { ...data, id: crypto.randomUUID(), createdAt: timestamp };
    if (isCloudReady && state.user && state.settings.useCloud) await supabase.from('transactions').insert({...newTx, user_id: state.user.id});
    setState(prev => ({ ...prev, transactions: [...prev.transactions, newTx] }));
  };

  const updateTransaction = async (id: string, data: Partial<Transaction>) => {
    const updatedTransactions = state.transactions.map(t => t.id === id ? { ...t, ...data } : t);
    if (isCloudReady && state.user && state.settings.useCloud) await supabase.from('transactions').update({ ...data }).eq('id', id);
    setState(prev => ({ ...prev, transactions: updatedTransactions }));
  };

  const deleteTransaction = async (id: string) => {
    const tx = state.transactions.find(t => t.id === id);
    if (!tx) return;
    if (tx.relatedId) {
      let sourceModule = "Modul Terkait";
      if (tx.category === TransactionCategory.STOCK_PURCHASE) sourceModule = "STOK";
      if (tx.category === TransactionCategory.SALES) sourceModule = "PENJUALAN";
      if (tx.category === TransactionCategory.PRODUCTION_COST) sourceModule = "PRODUKSI";
      if (tx.category === TransactionCategory.DEPOSIT || tx.category === TransactionCategory.FORFEITED_DP) sourceModule = "ORDER DP";
      if (tx.category === TransactionCategory.LOAN_PROCEEDS || tx.category === TransactionCategory.LOAN_REPAYMENT) sourceModule = "PINJAMAN";
      if (tx.description.includes("BUNGA PINJAMAN")) sourceModule = "PINJAMAN";
      
      return alert(`Transaksi ini otomatis dibuat oleh modul [${sourceModule}]. Silahkan hapus dari menu [${sourceModule}] agar data stok dan keuangan tetap sinkron.`);
    }
    if (isCloudReady && state.user && state.settings.useCloud) await supabase.from('transactions').delete().eq('id', id);
    setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
  };

  const transferFunds = async (amount: number, from: 'CASH' | 'BANK', to: 'CASH' | 'BANK', note: string, customDate?: number) => {
    const timestamp = customDate || Date.now();
    const transferGroupId = crypto.randomUUID();

    const outTx: Transaction = {
      id: crypto.randomUUID(),
      type: TransactionType.CASH_OUT,
      category: TransactionCategory.TRANSFER,
      amount,
      description: `TRANSFER: ${from} -> ${to}${note ? ` (${note})` : ''}`,
      createdAt: timestamp,
      paymentMethod: from,
      relatedId: transferGroupId
    };

    const inTx: Transaction = {
      id: crypto.randomUUID(),
      type: TransactionType.CASH_IN,
      category: TransactionCategory.TRANSFER,
      amount,
      description: `TERIMA TRANSFER DARI ${from}${note ? ` (${note})` : ''}`,
      createdAt: timestamp,
      paymentMethod: to,
      relatedId: transferGroupId
    };

    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('transactions').insert({...outTx, user_id: state.user.id}),
        supabase.from('transactions').insert({...inTx, user_id: state.user.id})
      ]);
    }
    setState(prev => ({ ...prev, transactions: [...prev.transactions, outTx, inTx] }));
  };

  const addLoan = async (data: Omit<Loan, 'id' | 'createdAt' | 'remainingAmount'>, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const timestamp = customDate || Date.now();
    const newLoan: Loan = { ...data, id: crypto.randomUUID(), remainingAmount: data.initialAmount, createdAt: timestamp };
    const tx: Transaction = { id: crypto.randomUUID(), type: TransactionType.CASH_IN, category: TransactionCategory.LOAN_PROCEEDS, amount: data.initialAmount, description: `PENCAIRAN PINJAMAN: ${data.source}`, createdAt: timestamp, relatedId: newLoan.id, paymentMethod };
    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('loans').insert({...newLoan, user_id: state.user.id}),
        supabase.from('transactions').insert({...tx, user_id: state.user.id})
      ]);
    }
    setState(prev => ({ ...prev, loans: [...prev.loans, newLoan], transactions: [...prev.transactions, tx] }));
  };

  const updateLoan = async (id: string, data: Partial<Loan>, paymentMethod?: 'CASH' | 'BANK', customDate?: number) => {
    const oldLoan = state.loans.find(l => l.id === id);
    if (!oldLoan) return;

    const newInitial = data.initialAmount !== undefined ? data.initialAmount : oldLoan.initialAmount;
    const diff = newInitial - oldLoan.initialAmount;
    const newRemaining = oldLoan.remainingAmount + diff;
    const newTimestamp = customDate || oldLoan.createdAt;

    const updatedLoans = state.loans.map(l => l.id === id ? { 
      ...l, 
      ...data, 
      remainingAmount: newRemaining,
      createdAt: newTimestamp 
    } : l);
    
    const updatedTransactions = state.transactions.map(t => {
      if (t.relatedId === id && t.category === TransactionCategory.LOAN_PROCEEDS) {
        return {
          ...t,
          amount: newInitial,
          description: `PENCAIRAN PINJAMAN: ${data.source || oldLoan.source}`,
          createdAt: newTimestamp,
          paymentMethod: paymentMethod || t.paymentMethod
        };
      }
      return t;
    });

    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('loans').update({ 
          ...data, 
          remainingAmount: newRemaining,
          createdAt: newTimestamp 
        }).eq('id', id),
        supabase.from('transactions').update({ 
          amount: newInitial, 
          description: `PENCAIRAN PINJAMAN: ${data.source || oldLoan.source}`,
          createdAt: newTimestamp,
          paymentMethod: paymentMethod || 'CASH'
        }).eq('relatedId', id).eq('category', TransactionCategory.LOAN_PROCEEDS)
      ]);
    }

    setState(prev => ({ ...prev, loans: updatedLoans, transactions: updatedTransactions }));
  };

  const repayLoan = async (loanId: string, principal: number, interest: number, customDate?: number, paymentMethod: 'CASH' | 'BANK' = 'CASH') => {
    const loan = state.loans.find(l => l.id === loanId);
    if (!loan) return;
    const timestamp = customDate || Date.now();
    const newTransactions: Transaction[] = [];
    if (principal > 0) newTransactions.push({ id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.LOAN_REPAYMENT, amount: principal, description: `PELUNASAN POKOK: ${loan.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod });
    if (interest > 0) newTransactions.push({ id: crypto.randomUUID(), type: TransactionType.CASH_OUT, category: TransactionCategory.OPERATIONAL, amount: interest, description: `BUNGA PINJAMAN: ${loan.source}`, createdAt: timestamp, relatedId: loan.id, paymentMethod });
    const updatedLoans = state.loans.map(l => l.id === loanId ? { ...l, remainingAmount: Math.max(0, l.remainingAmount - principal) } : l);
    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('loans').update({ remainingAmount: loan.remainingAmount - principal }).eq('id', loanId),
        supabase.from('transactions').insert(newTransactions.map(t => ({...t, user_id: state.user.id})))
      ]);
    }
    setState(prev => ({ ...prev, loans: updatedLoans, transactions: [...prev.transactions, ...newTransactions] }));
  };

  const deleteLoan = async (id: string) => {
    const loan = state.loans.find(l => l.id === id);
    if (!loan) return;
    if (loan.remainingAmount < loan.initialAmount) return alert("Hutang yang sudah ada cicilan tidak bisa dihapus langsung. Hapus cicilan di riwayat terlebih dahulu.");
    if (isCloudReady && state.user && state.settings.useCloud) {
      await Promise.all([
        supabase.from('loans').delete().eq('id', id),
        supabase.from('transactions').delete().eq('relatedId', id)
      ]);
    }
    setState(prev => ({ ...prev, loans: prev.loans.filter(l => l.id !== id), transactions: prev.transactions.filter(t => t.relatedId !== id) }));
  };

  return (
    <AppContext.Provider value={{ 
      state, addBatch, updateBatch, deleteBatch, runProduction, updateProduction, completeProduction,
      deleteProduction, runSale, updateSale, deleteSale, addManualTransaction, updateTransaction, 
      deleteTransaction, transferFunds, updateSettings, syncLocalToCloud,
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
