
export enum StockType {
  FOR_PRODUCTION = 'BAHAN PRODUKSI',
  FOR_SALE = 'BARANG JADI'
}

export enum TransactionType {
  CASH_IN = 'UANG MASUK',
  CASH_OUT = 'UANG KELUAR'
}

export enum TransactionCategory {
  STOCK_PURCHASE = 'PEMBELIAN STOK',
  SALES = 'PENJUALAN',
  PRODUCTION_COST = 'BIAYA PRODUKSI',
  OPERATIONAL = 'OPERASIONAL',
  DEPOSIT = 'DEPOSIT',
  FORFEITED_DP = 'DP HANGUS',
  LOAN_PROCEEDS = 'PINJAMAN', // Pencairan Pinjaman (Hanya Kas & Hutang)
  LOAN_REPAYMENT = 'PAMBAYARAN PINJAMAN', // Pelunasan Pokok (Hanya Kas & Hutang)
  TRANSFER = 'PINDAH DANA' // Fitur Baru: Transfer antar Bank/Tunai
}

export enum ProductionStatus {
  IN_PROGRESS = 'PROSES',
  COMPLETED = 'SELESAI'
}

export enum DPStatus {
  PENDING = 'DITUNDA',
  COMPLETED = 'SELESAI',
  CANCELLED = 'BATAL'
}

export interface BatchVariant {
  id: string;
  label: string;
  quantity: number;
}

export interface Batch {
  id: string;
  productName: string;
  subCategory?: string; // Varian tunggal (legacy support)
  variants?: BatchVariant[]; // Fitur Baru: Banyak varian dengan stok masing-masing
  initialQuantity: number;
  currentQuantity: number;
  buyPrice: number;
  stockType: StockType;
  createdAt: number;
}

export interface ProductionUsage {
  id: string;
  productionId: string;
  batchId: string;
  quantityUsed: number;
  costPerUnit: number;
}

export interface ProductionIngredient {
  productName: string;
  quantity: number;
}

export interface ProductionRecord {
  id: string;
  outputProductName: string;
  outputQuantity: number;
  totalHPP: number;
  createdAt: number;
  completedAt?: number;
  status: ProductionStatus;
  batchIdCreated?: string;
  ingredients?: ProductionIngredient[]; // Bahan yang direncanakan/diinput di awal
}

export interface SaleRecord {
  id: string;
  productName: string;
  variantLabel?: string; // Melacak varian mana yang terjual
  quantity: number;
  salePrice: number;
  totalRevenue: number;
  totalCOGS: number;
  createdAt: number;
  related_order_id?: string;
}

export interface DPOrder {
  id: string;
  customerName: string;
  productName: string;
  quantity: number;
  totalAmount: number;
  dpAmount: number;
  status: DPStatus;
  createdAt: number;
  completedAt?: number;
}

export interface Loan {
  id: string;
  source: string;
  initialAmount: number;
  remainingAmount: number;
  createdAt: number;
  note: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  createdAt: number;
  relatedId?: string;
  paymentMethod: 'CASH' | 'BANK'; // Fitur baru: Sub kategori kas
}

export interface AppSettings {
  businessName: string;
  theme: 'light' | 'dark';
  supabaseUrl: string;
  supabaseAnonKey: string;
  useCloud: boolean;
}

export interface AppState {
  batches: Batch[];
  productions: ProductionRecord[];
  productionUsages: ProductionUsage[];
  sales: SaleRecord[];
  dpOrders: DPOrder[];
  loans: Loan[];
  transactions: Transaction[];
  settings: AppSettings;
  isSyncing: boolean;
  user: any | null;
  lastSyncTime?: number;
}
