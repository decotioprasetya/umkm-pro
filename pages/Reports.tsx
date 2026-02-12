
import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { FileSpreadsheet, Download, TrendingUp, TrendingDown, Scale, Info, Box, FileText, PiggyBank, History, Wallet, Package, ArrowRightLeft, Factory, ShoppingCart, Landmark } from 'lucide-react';
import { TransactionType, TransactionCategory, StockType, ProductionStatus, DPStatus } from '../types';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const Reports: React.FC = () => {
  const { state } = useApp();
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');

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

  const formatFullTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const parseManualDate = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  };

  const dateRange = useMemo(() => {
    const start = parseManualDate(startDateStr) || -Infinity;
    const end = parseManualDate(endDateStr) || Infinity;
    return { start, end };
  }, [startDateStr, endDateStr]);

  // Data Filtering for Reports
  const filteredData = useMemo(() => {
    const filterByDate = (items: any[]) => items.filter(item => {
      const d = new Date(item.createdAt);
      const mid = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      return mid >= dateRange.start && mid <= dateRange.end;
    }).sort((a, b) => b.createdAt - a.createdAt);

    return {
      transactions: filterByDate(state.transactions),
      sales: filterByDate(state.sales),
      productions: filterByDate(state.productions),
      dpOrders: filterByDate(state.dpOrders),
      loans: filterByDate(state.loans),
      batches: state.batches.filter(b => b.currentQuantity > 0) // Current Stock doesn't strictly follow date range for asset snapshot
    };
  }, [state, dateRange]);

  // Financial Metrics
  const totalCash = state.transactions.reduce((sum, t) => 
    t.type === TransactionType.CASH_IN ? sum + t.amount : sum - t.amount, 0
  );
  const totalInventoryValue = state.batches.reduce((sum, b) => sum + (b.currentQuantity * b.buyPrice), 0);
  const totalDebt = state.loans.reduce((sum, l) => sum + l.remainingAmount, 0);
  const netWealth = (totalCash + totalInventoryValue) - totalDebt;

  // Period P&L
  const revenue = filteredData.sales.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalCOGS = filteredData.sales.reduce((sum, s) => sum + s.totalCOGS, 0);
  const operationalExpenses = filteredData.transactions
    .filter(t => t.type === TransactionType.CASH_OUT && t.category !== TransactionCategory.STOCK_PURCHASE && t.category !== TransactionCategory.PRODUCTION_COST && t.category !== TransactionCategory.LOAN_REPAYMENT)
    .reduce((sum, t) => sum + t.amount, 0);
  const otherIncome = filteredData.transactions
    .filter(t => t.category === TransactionCategory.FORFEITED_DP)
    .reduce((sum, t) => sum + t.amount, 0);
  const netProfit = (revenue + otherIncome) - (totalCOGS + operationalExpenses);

  const handleExportXLSX = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Rangkuman & Aset
    const summaryData = [
      ["LAPORAN RINGKASAN USAHA", ""],
      ["Bisnis:", state.settings.businessName],
      ["Periode:", `${startDateStr || 'Awal'} s/d ${endDateStr || 'Sekarang'}`],
      ["Tanggal Ekspor:", new Date().toLocaleString()],
      [""],
      ["PERFORMA PERIODE INI", ""],
      ["Total Omset Penjualan", revenue],
      ["Pendapatan Lain (DP Hangus)", otherIncome],
      ["Total HPP (Beban Stok)", totalCOGS],
      ["Beban Operasional", operationalExpenses],
      ["LABA BERSIH", netProfit],
      [""],
      ["POSISI ASET SAAT INI (FINAL)", ""],
      ["Saldo Kas Tunai", totalCash],
      ["Nilai Inventaris Gudang", totalInventoryValue],
      ["Total Hutang Aktif", -totalDebt],
      ["TOTAL KEKAYAAN BERSIH", netWealth]
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan & Aset");

    // Sheet 2: Transaksi Kas
    const txData = filteredData.transactions.map(t => ({
      'Tanggal': formatDateLabel(t.createdAt),
      'Waktu': formatFullTime(t.createdAt),
      'Akun': t.paymentMethod || 'CASH',
      'Tipe': t.type,
      'Kategori': t.category,
      'Deskripsi': t.description,
      'Nominal': t.amount
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txData), "Arus Kas");

    // Sheet 3: Penjualan
    const salesData = filteredData.sales.map(s => ({
      'Tanggal': formatDateLabel(s.createdAt),
      'Produk': s.productName,
      'Varian': s.variantLabel || '-',
      'Qty': s.quantity,
      'Harga Jual': s.salePrice,
      'Total Omset': s.totalRevenue,
      'HPP Terjual': s.totalCOGS,
      'Profit': s.totalRevenue - s.totalCOGS
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData), "Penjualan");

    // Sheet 4: Produksi
    const prodData = filteredData.productions.map(p => ({
      'Tanggal Mulai': formatDateLabel(p.createdAt),
      'Produk Jadi': p.outputProductName,
      'Qty Target': p.outputQuantity,
      'Total Biaya HPP': p.totalHPP,
      'Status': p.status
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prodData), "Produksi");

    // Sheet 5: Stok Aktif
    const stockData = state.batches.map(b => ({
      'Barang': b.productName,
      'Tipe': b.stockType,
      'Sisa Stok': b.currentQuantity,
      'Harga Beli Satuan': b.buyPrice,
      'Total Nilai Stok': b.currentQuantity * b.buyPrice
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockData), "Gudang (Stok)");

    XLSX.writeFile(wb, `Laporan_UMKM_${state.settings.businessName}_${Date.now()}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text(state.settings.businessName.toUpperCase(), pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periode: ${startDateStr || 'Awal'} - ${endDateStr || 'Sekarang'}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Dicetak pada: ${new Date().toLocaleString()}`, pageWidth / 2, 34, { align: 'center' });

    // 1. Rangkuman Laba Rugi
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text("1. PERFORMA LABA RUGI", 14, 45);
    
    autoTable(doc, {
      startY: 48,
      head: [['Keterangan', 'Nilai']],
      body: [
        ['Total Omset Penjualan', formatIDR(revenue)],
        ['Pendapatan Lain (DP)', formatIDR(otherIncome)],
        ['Total HPP Terjual', formatIDR(totalCOGS)],
        ['Biaya Operasional', formatIDR(operationalExpenses)],
        [{ content: 'LABA BERSIH PERIODE', styles: { fontStyle: 'bold' } }, { content: formatIDR(netProfit), styles: { fontStyle: 'bold', textColor: netProfit >= 0 ? [16, 185, 129] : [239, 68, 68] } }]
      ],
      theme: 'grid'
    });

    // 2. Riwayat Transaksi (Ringkasan)
    doc.setFontSize(14);
    doc.text("2. RIWAYAT ARUS KAS TERBARU", 14, (doc as any).lastAutoTable.finalY + 15);
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 18,
      head: [['Tgl', 'Akun', 'Kategori', 'Nominal']],
      body: filteredData.transactions.slice(0, 30).map(t => [
        formatDateLabel(t.createdAt),
        t.paymentMethod || 'CASH',
        t.category,
        formatIDR(t.amount)
      ]),
      styles: { fontSize: 8 }
    });

    // 3. Posisi Aset (Final)
    doc.addPage();
    doc.setFontSize(14);
    doc.text("3. RINGKASAN ASET & KEKAYAAN BISNIS", 14, 20);
    
    autoTable(doc, {
      startY: 25,
      head: [['Komponen Aset', 'Rincian Nilai']],
      body: [
        ['Saldo Kas Tunai (Cash on Hand)', formatIDR(totalCash)],
        ['Nilai Inventaris Gudang (Bahan & Jadi)', formatIDR(totalInventoryValue)],
        ['Kewajiban Hutang / Pinjaman Pokok', formatIDR(totalDebt)],
        [{ content: 'TOTAL KEKAYAAN BERSIH (NET ASSETS)', styles: { fontStyle: 'bold', fillColor: [51, 65, 85], textColor: [255, 255, 255] } }, { content: formatIDR(netWealth), styles: { fontStyle: 'bold', fillColor: [51, 65, 85], textColor: [255, 255, 255] } }]
      ],
      theme: 'grid'
    });

    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text("* Laporan ini dihasilkan secara otomatis oleh Sistem UMKM PRO.", 14, (doc as any).lastAutoTable.finalY + 10);

    doc.save(`Laporan_Lengkap_${state.settings.businessName}.pdf`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Pusat Laporan & Audit</h2>
          <div className="flex items-center gap-2">
            <p className="text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">Analisis Mendalam Seluruh Aktivitas</p>
            <div className="group relative">
               <Info size={12} className="text-blue-400 cursor-help" />
               <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-4 bg-slate-900 text-white text-[9px] rounded-2xl shadow-2xl z-50 leading-relaxed font-bold uppercase tracking-wider border border-slate-700">
                 Ekspor mencakup data Kas, Penjualan, Produksi, dan Inventaris sekaligus untuk audit lengkap.
               </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-xl">
          <div className="flex flex-row items-center gap-2 w-full">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Mulai</label>
              <input type="date" className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 w-full text-[10px] font-black text-slate-900 dark:text-white" value={startDateStr} onChange={(e) => setStartDateStr(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[7px] font-black text-slate-400 uppercase tracking-widest ml-1">Sampai</label>
              <input type="date" className="bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 rounded-xl px-3 py-2 w-full text-[10px] font-black text-slate-900 dark:text-white" value={endDateStr} onChange={(e) => setEndDateStr(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExportXLSX} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95 transition-all">
              <FileSpreadsheet size={16} />
              <span className="hidden sm:inline">Excel</span>
            </button>
            <button onClick={handleExportPDF} className="bg-slate-900 dark:bg-slate-800 hover:bg-black text-white px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95 transition-all border border-slate-700">
              <FileText size={16} />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Snapshot Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 rounded-xl"><Wallet size={20} /></div>
           <div>
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Saldo Kas</p>
             <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tighter">{formatIDR(totalCash)}</h4>
           </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 rounded-xl"><Package size={20} /></div>
           <div>
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Nilai Stok</p>
             <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tighter">{formatIDR(totalInventoryValue)}</h4>
           </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
           <div className="p-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 rounded-xl"><Landmark size={20} /></div>
           <div>
             <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Total Hutang</p>
             <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tighter">{formatIDR(totalDebt)}</h4>
           </div>
        </div>
        <div className="bg-slate-900 dark:bg-blue-600 p-5 rounded-2xl shadow-xl flex items-center gap-4 border border-slate-800">
           <div className="p-3 bg-white/10 text-white rounded-xl"><Scale size={20} /></div>
           <div>
             <p className="text-[8px] font-black text-white/50 uppercase tracking-widest mb-0.5">Kekayaan Bersih</p>
             <h4 className="text-sm font-black text-white tracking-tighter">{formatIDR(netWealth)}</h4>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Performance List */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex items-center justify-between">
            <h4 className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-tight flex items-center gap-2">
              <History size={16} className="text-blue-500" /> Arus Kas Terbaru
            </h4>
          </div>
          <div className="overflow-x-auto max-h-[400px] no-scrollbar">
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredData.transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-900 dark:text-white leading-tight uppercase">{t.description}</span>
                          <span className={`text-[7px] font-black px-1 rounded ${t.paymentMethod === 'BANK' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>{t.paymentMethod || 'CASH'}</span>
                        </div>
                        <span className="text-[7px] font-black text-slate-400 uppercase mt-1 tracking-widest">{formatDateLabel(t.createdAt)} • {t.category}</span>
                      </div>
                    </td>
                    <td className={`px-6 py-4 text-right font-black text-[10px] tracking-tighter ${t.type === TransactionType.CASH_IN ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {t.type === TransactionType.CASH_IN ? '+' : '-'}{formatIDR(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales List */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex items-center justify-between">
            <h4 className="font-black text-slate-800 dark:text-white uppercase text-xs tracking-tight flex items-center gap-2">
              <ShoppingCart size={16} className="text-emerald-500" /> Penjualan Terbaru
            </h4>
          </div>
          <div className="overflow-x-auto max-h-[400px] no-scrollbar">
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filteredData.sales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-all">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-slate-900 dark:text-white leading-tight uppercase">{s.productName}</span>
                        <span className="text-[7px] font-black text-slate-400 uppercase mt-1 tracking-widest">{formatDateLabel(s.createdAt)} • {s.quantity} Unit</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <p className="font-black text-[10px] text-emerald-600 tracking-tighter">{formatIDR(s.totalRevenue)}</p>
                       <p className="text-[7px] font-black text-blue-500 uppercase tracking-tighter">Profit: {formatIDR(s.totalRevenue - s.totalCOGS)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
