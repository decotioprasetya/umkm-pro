
import React from 'react';
import { useApp } from '../store';
import { Wallet, Package, ShoppingBag, TrendingUp, History } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TransactionType, TransactionCategory } from '../types';

const Dashboard: React.FC = () => {
  const { state } = useApp();

  // Calculations
  const totalCash = state.transactions.reduce((sum, t) => 
    t.type === TransactionType.CASH_IN ? sum + t.amount : sum - t.amount, 0
  );

  const totalSales = state.sales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalInventoryValue = state.batches.reduce((sum, b) => sum + (b.currentQuantity * b.buyPrice), 0);
  const totalWealth = totalCash + totalInventoryValue;

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  const formatQty = (val: number) => {
    return val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Recent data for chart
  const recentTransactions = [...state.transactions]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 7)
    .map(t => ({
      name: new Date(t.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      amount: t.amount,
      type: t.type
    }));

  const stats = [
    { label: 'Sisa Kas', value: formatIDR(totalCash), icon: Wallet, color: 'bg-emerald-100 text-emerald-600' },
    { label: 'Total Penjualan', value: formatIDR(totalSales), icon: ShoppingBag, color: 'bg-blue-100 text-blue-600' },
    { label: 'Nilai Aset Stok', value: formatIDR(totalInventoryValue), icon: Package, color: 'bg-orange-100 text-orange-600' },
    { label: 'Total Aset', value: formatIDR(totalWealth), icon: TrendingUp, color: 'bg-purple-100 text-purple-600' },
  ];

  return (
    <div className="space-y-5 lg:space-y-8 animate-in fade-in duration-500">
      {/* Metric Grid - Ultra Compact on Mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white dark:bg-slate-900 p-3 lg:p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-2 lg:mb-4">
                <div className={`p-1 lg:p-3 rounded-xl ${stat.color}`}>
                  <Icon size={12} className="lg:w-6 lg:h-6" />
                </div>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-[8px] lg:text-xs font-black uppercase tracking-widest leading-none">{stat.label}</p>
              <h3 className="text-xs lg:text-xl font-black text-slate-800 dark:text-white mt-1.5 tracking-tight truncate leading-none">
                {stat.value}
              </h3>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Growth Chart Section */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-base lg:text-lg font-black text-slate-800 dark:text-white mb-6 uppercase tracking-tight">Grafik Pertumbuhan</h3>
          <div className="h-64 lg:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recentTransactions}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} 
                />
                <YAxis axisLine={false} tickLine={false} hide />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '11px',
                    fontWeight: '900',
                    textTransform: 'uppercase'
                  }}
                  formatter={(val: number) => formatIDR(val)}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} barSize={32}>
                  {recentTransactions.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.type === TransactionType.CASH_IN ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white dark:bg-slate-900 p-6 lg:p-8 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <h3 className="text-base lg:text-lg font-black text-rose-600 mb-6 uppercase tracking-tight">Stok Menipis</h3>
          <div className="space-y-3">
            {state.batches
              .filter(b => b.currentQuantity < 5 && b.currentQuantity > 0)
              .slice(0, 5)
              .map((batch, i) => (
                <div key={i} className="flex items-center justify-between p-3 lg:p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl">
                  <div className="min-w-0">
                    <p className="font-black text-rose-900 dark:text-rose-400 text-[10px] lg:text-xs uppercase truncate">{batch.productName}</p>
                    <p className="text-[9px] text-rose-600 dark:text-rose-500 font-bold uppercase tracking-wider">Sisa {formatQty(batch.currentQuantity)} unit</p>
                  </div>
                  <div className="text-rose-400 shrink-0">
                    <Package size={18} />
                  </div>
                </div>
              ))}
            {state.batches.filter(b => b.currentQuantity < 5 && b.currentQuantity > 0).length === 0 && (
              <div className="text-center py-12">
                <div className="bg-slate-50 dark:bg-slate-800 w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Package className="text-slate-300" size={20} />
                </div>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Semua stok aman</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent History Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-6 lg:p-8 flex items-center justify-between border-b border-slate-50 dark:border-slate-800">
          <h3 className="text-base lg:text-lg font-black text-slate-800 dark:text-white uppercase tracking-tight">Riwayat Kas</h3>
        </div>
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-[9px] uppercase font-black tracking-widest">
                <th className="px-6 lg:px-8 py-4">Kategori</th>
                <th className="px-6 lg:px-8 py-4">Deskripsi</th>
                <th className="px-6 lg:px-8 py-4 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {state.transactions
                .sort((a, b) => b.createdAt - a.createdAt)
                .slice(0, 5)
                .map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 lg:px-8 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${
                        t.category === TransactionCategory.SALES ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                        t.category === TransactionCategory.STOCK_PURCHASE ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {t.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 lg:px-8 py-4">
                      <p className="text-[10px] lg:text-xs font-black text-slate-700 dark:text-slate-200 uppercase leading-tight">{t.description}</p>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter mt-1">{new Date(t.createdAt).toLocaleDateString('id-ID')}</p>
                    </td>
                    <td className={`px-6 lg:px-8 py-4 text-[11px] lg:text-sm font-black text-right tracking-tighter ${
                      t.type === TransactionType.CASH_IN ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {t.type === TransactionType.CASH_IN ? '+' : '-'}{formatIDR(t.amount)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
