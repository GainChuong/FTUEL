import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Joyride, STATUS, Step, EVENTS, ACTIONS } from "react-joyride";
import {
  Activity,
  Play,
  TrendingUp,
  Info,
  AlertTriangle,
  Network,
  HelpCircle,
  PlusCircle,
  X,
  BrainCircuit,
  Globe,
  RotateCcw,
  Save,
  Trash2,
  MapPin,
  LogOut,
  Loader2,
  Database,
  Search
} from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import { generateGraphData } from "./graphData";
import type { GraphMetrics, CrawledRow } from "./graphData";
import staticRawData from './crawledData.json';
import { runGNN, predictRevenueWithGNN, detectCannibalization, cosineSimilarity, type GNNResult } from "./lib/gnnEngine";
import Chatbot from "./components/Chatbot";
import { AuthProvider, useAuth } from "./lib/auth";
import { supabase } from "./lib/supabase";
import LoginPage from "./components/LoginPage";
import { getGeminiXAIExplanation, getGeminiStrategyExplanation } from './lib/gemini';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ReferenceDot,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Define SVG Paths for our icons based on Lucide
const svgPaths = {
  shop: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h2V14h8v8h2a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/>',
  product: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  region: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>'
};

const getSvgUri = (pathData: string, strokeValue: string) => 
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${strokeValue}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${pathData}</svg>`)}`;

// Preload Images
const iconCache: Record<string, HTMLImageElement> = {};
['shop', 'product', 'region'].forEach(type => {
  const img = new Image();
  img.src = getSvgUri(svgPaths[type as keyof typeof svgPaths], '#ffffff'); 
  iconCache[type] = img;
});

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2"><AlertTriangle /> Error rendering graph: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}

function LoadingScreen({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-[#0f172a]">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-[#30E9CD]/20"
            initial={{ 
              x: Math.random() * 100 + "%", 
              y: Math.random() * 100 + "%",
              scale: Math.random() * 0.5 + 0.5
            }}
            animate={{ 
              y: ["100%", "-100%"],
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: Math.random() * 5 + 5, 
              repeat: Infinity, 
              ease: "linear",
              delay: Math.random() * 5
            }}
          />
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex flex-col items-center gap-8"
      >
        <div className="relative">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="p-4 rounded-3xl border-2 border-dashed border-[#30E9CD]/30"
          >
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#30E9CD] to-[#20c4ab] shadow-[0_0_40px_rgba(48,233,205,0.3)]">
              <Network size={48} className="text-[#0f172a]" />
            </div>
          </motion.div>
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="absolute inset-0 bg-[#30E9CD] blur-3xl -z-10 rounded-full"
          />
        </div>

        <div className="text-center">
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">
            GraphRetail <span className="text-[#30E9CD]">AI</span>
          </h1>
          <p className="text-slate-400 font-medium tracking-[0.3em] uppercase text-[10px]">Architecting Retail Intelligence</p>
        </div>

        <div className="w-72">
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 p-[1px]">
            <motion.div 
              className="h-full bg-gradient-to-r from-[#30E9CD] via-[#20c4ab] to-[#30E9CD] bg-[length:200%_100%]"
              initial={{ width: 0 }}
              animate={{ 
                width: `${progress}%`,
                backgroundPosition: ["0% 0%", "100% 0%"]
              }}
              transition={{ 
                width: { type: "spring", damping: 20, stiffness: 40 },
                backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" }
              }}
            />
          </div>
          <div className="mt-4 flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <span className="flex items-center gap-2">
              <motion.span 
                animate={{ opacity: [1, 0.5, 1] }} 
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-[#30E9CD]"
              />
              System Initializing
            </span>
            <span className="text-white tabular-nums font-mono">{Math.round(progress)}%</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Dashboard() {
  const { user, signOut } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [hasData, setHasData] = useState(true);
  const [isDataEmpty, setIsDataEmpty] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [tourKey, setTourKey] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  // Custom Modals & Simulation
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({ name: '', price: 100000, regionId: '' });
  const [discountChange, setDiscountChange] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [xaiMessage, setXaiMessage] = useState<string | null>(null);
  const [isXaiLoading, setIsXaiLoading] = useState(false);
  const [viewingScenario, setViewingScenario] = useState<any | null>(null);

  const importSampleData = async () => {
    if (!user || isImporting) return;
    setIsImporting(true);
    try {
      const sampleRecords = [
        { "Tên Shop": "nesty ", "Tên sản phẩm": "[Tặng Sticker] Dép Sục Gia Đình Nesty Chất Liệu Eva Siêu Nhẹ, Không Mùi, Đế Thấp 3 cm NE50", "Rating": "4.94", "Giá": 125000, "Đã bán": 20000, "Vùng": "TP. Hồ Chí Minh", "Khuyến mại": 0.3 },
        { "Tên Shop": "nesty ", "Tên sản phẩm": "[NE75-Sản Phẩm Mới] Dép Sục Nesty Đúc Nguyên Khối Cao 6cm – Êm Nhẹ, Tôn Dáng, Chống Trơn, Hottrend Cá Tính", "Rating": 5, "Giá": 185000, "Đã bán": 154, "Vùng": "Tỉnh Đắk Lắk", "Khuyến mại": 0.47 },
        { "Tên Shop": "nesty ", "Tên sản phẩm": "[NE01_Hỏa Tốc] Dép Sục Nam Nữ NESTY Kiểu Dáng Basic Đế Mềm Cao 4cm Tặng Kèm Charm", "Rating": 5, "Giá": 122245, "Đã bán": 41, "Vùng": "TP. Hồ Chí Minh", "Khuyến mại": 0.36 },
        { "Tên Shop": "nesty ", "Tên sản phẩm": "[NEW] DÉP SỤC THIẾT KẾ KHÓA TĂNG GIẢM CHÍNH HÃNG NESTY MÃ NE29", "Rating": "4.88", "Giá": 165511, "Đã bán": 983, "Vùng": "Bình Dương", "Khuyến mại": 0.53 },
        { "Tên Shop": "nesty ", "Tên sản phẩm": "[NE29] Dép Lười NESTY Chất Liệu EVA Cao Cấp – Đế 4cm Êm Chân, Khóa Cài", "Rating": "4.94", "Giá": 154800, "Đã bán": 421, "Vùng": "TP. Hồ Chí Minh", "Khuyến mại": 0.23 }
      ];

      const toInsert = sampleRecords.map(r => ({
        user_id: user.id,
        shop_name: r["Tên Shop"].trim(),
        name: r["Tên sản phẩm"],
        rating: Number(r["Rating"]),
        price: Number(r["Giá"]),
        sold_count: Number(r["Đã bán"]),
        region: r["Vùng"],
        promotion: Number(r["Khuyến mại"]),
        display_name: user.email?.split('@')[0] || 'User'
      }));

      const { error } = await supabase.from('products').insert(toInsert);
      if (error) throw error;

      window.location.reload(); 
    } catch (err) {
      console.error("Import failed:", err);
      alert("Không thể nạp dữ liệu mẫu.");
    } finally {
      setIsImporting(false);
    }
  };

  const [graphData, setGraphData] = useState<any>({
    nodes: [],
    links: [],
    products: [],
    shops: [],
    regions: [],
    metrics: { maxProductRevenue: 1, maxShopRevenue: 1, maxRegionRevenue: 1, maxPrice: 1, maxSold: 1 } as GraphMetrics,
    gnnResult: null as GNNResult | null,
  });

  // GNN State
  const [gnnReady, setGnnReady] = useState(false);
  const gnnResultRef = useRef<GNNResult | null>(null);
  const d3DataRef = useRef<{nodes: any[], links: any[]}>({ nodes: [], links: [] });
  const [selectedNodes, setSelectedNodes] = useState<any[]>([]);
  const [compType, setCompType] = useState<'product' | 'shop' | 'region'>('product');
  const [compMetric, setCompMetric] = useState<string>('revenue');
  
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number, height: number } | null>(null);

  // Economic Scenarios & Optimization
  const [marketCondition, setMarketCondition] = useState<'normal' | 'recession' | 'growth'>('normal');
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
  const [scenarioNameInput, setScenarioNameInput] = useState('');

  // Performance Optimization: Pre-compute highlight maps for O(1) rendering
  const highlightMap = useMemo(() => {
    const primary = new Set<string>();
    const secondary = new Set<string>();
    const dimmed = new Set<string>();

    if (selectedNodes.length === 0) return { primary, secondary, dimmed };

    selectedNodes.forEach(n => primary.add(n.id));
    const firstSel = selectedNodes[0];

    if (firstSel.type === 'shop') {
      const shopProducts = graphData.products.filter((p: any) => p.shopId === firstSel.id);
      const shopRegions = new Set(shopProducts.map((p: any) => p.regionId));
      shopProducts.forEach((p: any) => secondary.add(p.id));
      graphData.regions.forEach((r: any) => { if (shopRegions.has(r.id)) secondary.add(r.id); });
    } else if (firstSel.type === 'region') {
      const regionProducts = graphData.products.filter((p: any) => p.regionId === firstSel.id);
      const regionShops = new Set(regionProducts.map((p: any) => p.shopId));
      regionProducts.forEach((p: any) => secondary.add(p.id));
      graphData.shops.forEach((s: any) => { if (regionShops.has(s.id)) secondary.add(s.id); });
    } else {
      const selProds = selectedNodes.filter(n => n.type === 'product');
      selProds.forEach((sp: any) => {
        secondary.add(sp.shopId);
        secondary.add(sp.regionId);
      });
    }

    graphData.nodes.forEach((n: any) => {
      if (!primary.has(n.id) && !secondary.has(n.id)) dimmed.add(n.id);
    });

    return { primary, secondary, dimmed };
  }, [selectedNodes, graphData]);

  // Helper: format VND
  const fmtVND = (v: number) => {
    if (v >= 1e9) return `${(v/1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v/1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v/1e3).toFixed(0)}K`;
    return `${v}`;
  };

  const recalcAggregates = (data: any) => {
    data.shops.forEach((s: any) => {
      const sp = data.products.filter((p: any) => p.shopId === s.id);
      s.productCount = sp.length;
      s.totalRevenue = Math.floor(sp.reduce((sum: number, p: any) => sum + p.revenue, 0));
      s.avgPrice = sp.length ? Math.floor(sp.reduce((sum: number, p: any) => sum + p.price, 0) / sp.length) : 0;
      s.rating = sp.length ? parseFloat((sp.reduce((sum: number, p: any) => sum + p.rating, 0) / sp.length).toFixed(2)) : 0;
    });
    data.regions.forEach((r: any) => {
      const rp = data.products.filter((p: any) => p.regionId === r.id);
      r.productCount = rp.length;
      r.totalRevenue = Math.floor(rp.reduce((sum: number, p: any) => sum + p.revenue, 0));
      const shopIds = new Set(rp.map((p: any) => p.shopId));
      r.shopCount = shopIds.size;
    });
    data.metrics = {
      maxProductRevenue: Math.max(...data.products.map((p: any) => p.revenue), 1),
      maxShopRevenue: Math.max(...data.shops.map((s: any) => s.totalRevenue), 1),
      maxRegionRevenue: Math.max(...data.regions.map((r: any) => r.totalRevenue), 1),
      maxPrice: Math.max(...data.products.map((p: any) => p.price), 1),
      maxSold: Math.max(...data.products.map((p: any) => p.sold), 1),
    };
  };

  const applyMarketCondition = (cond: 'normal' | 'recession' | 'growth') => {
    setMarketCondition(cond);
    setIsXaiLoading(true);
    setXaiMessage(`Đang phân tích tác động của nền kinh tế ${cond === 'normal' ? 'Bình thường' : cond === 'recession' ? 'Suy thoái' : 'Tăng trưởng'}...`);
    
    const newData = JSON.parse(JSON.stringify(graphData, (k, v) => (k === 'source' || k === 'target') && v?.id ? v.id : v));
    let oldTotalRevenue = 0;
    let newTotalRevenue = 0;

    newData.products.forEach((p: any) => {
      oldTotalRevenue += p.revenue;
      // Xác định phân khúc dựa trên giá
      const isCheap = p.originalPrice <= 250000;
      const isPremium = p.originalPrice >= 1000000;

      if (cond === 'normal') {
        p.sold = p.originalSold;
        p.price = p.originalPrice;
        p.discount = p.originalDiscount;
      } else if (cond === 'growth') {
        p.sold = isPremium ? Math.floor(p.originalSold * 1.5) : Math.floor(p.originalSold * 1.2);
        p.price = isPremium ? Math.floor(p.originalPrice * 1.15) : Math.floor(p.originalPrice * 1.05);
        p.discount = Math.max(0, p.originalDiscount * 0.8);
      } else {
        if (isCheap) {
          p.sold = Math.floor(p.originalSold * 1.1);
          p.price = p.originalPrice;
        } else if (isPremium) {
          p.sold = Math.floor(p.originalSold * 0.7);
          p.price = Math.floor(p.originalPrice * 0.95);
        } else {
          p.sold = Math.floor(p.originalSold * 0.5);
          p.price = Math.floor(p.originalPrice * 0.85);
        }
        p.discount = Math.min(0.7, p.originalDiscount * 1.5);
      }
      p.revenue = p.price * (1 - p.discount) * p.sold;
      newTotalRevenue += p.revenue;
      p.vx = (Math.random() - 0.5) * 200;
      p.vy = (Math.random() - 0.5) * 200;
    });

    recalcAggregates(newData);
    setGraphData(newData);
    
    const revDiff = newTotalRevenue - oldTotalRevenue;
    const revPercent = oldTotalRevenue ? (revDiff / oldTotalRevenue) * 100 : 0;

    // AI Analysis for Market Condition
    getGeminiXAIExplanation({
      productName: "Toàn bộ thị trường",
      priceChange: 0,
      discountChange: 0,
      revenueChange: revDiff,
      percentChange: revPercent,
      condition: cond,
      gnnInsights: `Tác động vĩ mô: ${cond.toUpperCase()}. Hệ thống ghi nhận biến động doanh thu tổng thể là ${revPercent.toFixed(1)}%.`
    }).then(explanation => {
      setXaiMessage(explanation || `Đã chuyển sang trạng thái ${cond}.`);
      setIsXaiLoading(false);
    }).catch(() => {
      setXaiMessage(`Đã chuyển sang trạng thái ${cond}. Doanh thu thị trường thay đổi ${revPercent.toFixed(1)}%.`);
      setIsXaiLoading(false);
    });

    setTimeout(() => graphRef.current?.d3ReheatSimulation(), 100);
  };

  const optimizeMyProfit = () => {
    const newData = JSON.parse(JSON.stringify(graphData, (k, v) => (k === 'source' || k === 'target') && v?.id ? v.id : v));
    const myShop = newData.shops.find((s: any) => s.isMe);
    if (!myShop) return;

    let totalGain = 0;
    let strategyDesc = "";
    let changesCount = 0;

    newData.products.forEach((p: any) => {
      if (p.shopId === myShop.id) {
        const oldRevenue = p.revenue;
        const isCheap = p.originalPrice <= 250000;
        const isPremium = p.originalPrice >= 1000000;

        let newDiscount = p.originalDiscount;
        let newPrice = p.originalPrice;
        let newSold = p.originalSold;

        if (marketCondition === 'recession') {
            if (isCheap) {
                newDiscount = Math.min(0.7, p.originalDiscount + 0.3); // Deep discount
                newSold = Math.floor(p.originalSold * (1 + (newDiscount - p.originalDiscount) * 3.0));
                strategyDesc = "Suy thoái: Tăng mạnh KM giày giá rẻ để hút khách (Volume-driven).";
            } else if (isPremium) {
                newDiscount = Math.max(0, p.originalDiscount - 0.05); // Preserving brand
                newPrice = Math.floor(p.originalPrice * 0.95);
                newSold = Math.floor(p.originalSold * 0.8);
                strategyDesc = "Suy thoái: Giữ giá giày cao cấp, bảo vệ định vị (Lipstick effect).";
            } else {
                newDiscount = Math.min(0.5, p.originalDiscount + 0.15);
                newPrice = Math.floor(p.originalPrice * 0.9);
                newSold = Math.floor(p.originalSold * 0.9);
                if (!strategyDesc) strategyDesc = "Suy thoái: Chấp nhận giảm giá dòng tầm trung để xả kho.";
            }
        } else if (marketCondition === 'growth') {
            if (isPremium) {
                newPrice = Math.floor(p.originalPrice * 1.15); // Premiumization
                newDiscount = Math.max(0, p.originalDiscount - 0.1);
                newSold = Math.floor(p.originalSold * 1.1); 
                strategyDesc = "Tăng trưởng: Tăng giá giày cao cấp (Premiumization), tối đa hóa biên lợi nhuận.";
            } else {
                newPrice = Math.floor(p.originalPrice * 1.05);
                newDiscount = Math.max(0, p.originalDiscount - 0.05);
                newSold = Math.floor(p.originalSold * 1.2);
                if (!strategyDesc) strategyDesc = "Tăng trưởng: Tăng nhẹ giá, giảm KM do nhu cầu thị trường đang cao.";
            }
        } else {
            newDiscount = Math.min(0.3, p.originalDiscount + 0.1);
            newSold = Math.floor(p.originalSold * (1 + 0.1 * 1.5));
            strategyDesc = "Bình thường: Cân bằng điểm tối ưu giữa Giá và Lượng bán.";
        }

        const actualPrice = newPrice * (1 - newDiscount);
        const newRevenue = actualPrice * newSold;
        
        if (newDiscount !== p.originalDiscount || newPrice !== p.originalPrice) {
            changesCount++;
        }

        p.discount = newDiscount;
        p.price = newPrice;
        p.sold = newSold;
        p.revenue = newRevenue;
        
        totalGain += newRevenue - oldRevenue;
      }
    });

    recalcAggregates(newData);
    setGraphData(newData);
    
    const myUpdated = newData.shops.find((s: any) => s.isMe);
    const revenueToSave = myUpdated?.totalRevenue;

    // Get top 3 products by revenue after optimization to show to AI
    const topPerformers = newData.products
      .filter((p: any) => p.shopId === myShop.id)
      .sort((a: any, b: any) => b.revenue - a.revenue)
      .slice(0, 3);

    setXaiMessage(`✅ Đã tối ưu ${changesCount} sản phẩm. Đang phân tích chiến lược...`);
    setIsXaiLoading(true);

    getGeminiStrategyExplanation(
      myShop.name,
      changesCount,
      totalGain,
      strategyDesc,
      marketCondition === 'normal' ? 'Bình thường' : marketCondition === 'recession' ? 'Suy thoái' : 'Tăng trưởng',
      topPerformers
    ).then(explanation => {
      setXaiMessage(`✅ Đã tối ưu ${changesCount} sản phẩm.\n💡 Chiến lược: ${strategyDesc}\n📈 Doanh thu thay đổi: ${totalGain >= 0 ? '+' : ''}₫${fmtVND(Math.floor(totalGain))}${explanation ? '\n' + explanation : ''}`);
      setIsXaiLoading(false);
    }).catch(() => {
      setXaiMessage(`✅ Đã tối ưu ${changesCount} sản phẩm.\n💡 Chiến lược: ${strategyDesc}\n📈 Doanh thu thay đổi: ${totalGain >= 0 ? '+' : ''}₫${fmtVND(Math.floor(totalGain))}`);
      setIsXaiLoading(false);
    });
    
    setTimeout(() => graphRef.current?.d3ReheatSimulation(), 100);
  };

  const resetSimulation = () => {
    if (initialData) {
      // Reconstruct graphData from initialData
      const parsed = JSON.parse(JSON.stringify(initialData));
      
      // Handle Float32Array conversion back for GNN embeddings if they exist
      parsed.nodes.forEach((n: any) => {
        if (n.embedding && Array.isArray(n.embedding)) {
          n.embedding = new Float32Array(n.embedding);
        }
      });

      setGraphData(parsed);
      d3DataRef.current = { nodes: [...parsed.nodes], links: [...parsed.links] };
      
      // Reset all simulation-related state
      setMarketCondition('normal');
      setDiscountChange(0);
      setPriceChange(0);
      setShowAddProduct(false);
      setNewProductForm({ name: '', price: 100000, regionId: '' });
      setXaiMessage("🔄 Hệ thống đã được khôi phục về trạng thái gốc. Tất cả các điều chỉnh và sản phẩm thử nghiệm đã bị xóa.");
      
      // Refresh visualization
      setTimeout(() => {
        graphRef.current?.d3ReheatSimulation();
        graphRef.current?.zoomToFit(800, 100);
      }, 100);
    }
  };

  const saveScenarioByName = async (customName?: any, newRevenue?: number) => {
    let nameToSave = typeof customName === 'string' && customName.trim() ? customName : scenarioNameInput;
    if (!nameToSave || !nameToSave.trim()) return;
    if (!user) return;
    
    // Find all products that have been modified compared to their original state
    const modifiedProducts = graphData.products.filter((p: any) => 
      p.price !== p.originalPrice || p.discount !== p.originalDiscount
    );

    const isAddingNew = showAddProduct && newProductForm.name;

    if (modifiedProducts.length === 0 && !isAddingNew) {
      alert("Chưa có thay đổi nào để lưu kịch bản. Hãy điều chỉnh giá hoặc khuyến mãi trước.");
      return;
    }

    try {
      // 1. Insert Header
      const { data: headerData, error: headerError } = await supabase
        .from('simulation_headers')
        .insert([{
          name: nameToSave.trim(),
          market_condition: marketCondition,
          user_id: user.id
        }])
        .select();

      if (headerError) throw headerError;
      const simulationId = headerData[0].id;

      // 2. Prepare Details
      const details = modifiedProducts.map((p: any) => ({
        simulation_id: simulationId,
        product_id: p.id,
        adjusted_price: p.price,
        adjusted_discount: p.discount
      }));

      if (isAddingNew) {
        details.push({
          simulation_id: simulationId,
          product_id: null,
          new_product_name: newProductForm.name,
          adjusted_price: newProductForm.price,
          adjusted_discount: 0,
          region: newProductForm.regionId
        });
      }

      // 3. Insert Details
      const { error: detailsError } = await supabase
        .from('simulation_details')
        .insert(details);

      if (detailsError) throw detailsError;

      setSavedScenarios(prev => [...prev, {
        id: simulationId,
        name: nameToSave.trim(),
        condition: marketCondition,
        revenue: newRevenue,
        details: details // Store for quick loading
      }]);

      if (typeof customName !== 'string') setScenarioNameInput('');
      setXaiMessage(`✅ Đã lưu kịch bản: ${nameToSave.trim()}`);
    } catch (err) {
      console.error("Lỗi khi lưu kịch bản:", err);
      alert("Không thể lưu kịch bản vào cơ sở dữ liệu.");
    }
  };

  const saveScenario = () => saveScenarioByName();

  useEffect(() => {
    const fetchScenarios = async () => {
      if (!user) return;
      
      // Fetch headers
      const { data: headers, error: hError } = await supabase
        .from('simulation_headers')
        .select('*')
        .order('created_at', { ascending: false });

      if (headers && !hError) {
        // Fetch all details for these headers
        const headerIds = headers.map(h => h.id);
        const { data: details, error: dError } = await supabase
          .from('simulation_details')
          .select('*')
          .in('simulation_id', headerIds);

        if (details && !dError) {
          setSavedScenarios(headers.map(h => ({
            id: h.id,
            name: h.name,
            condition: h.market_condition,
            details: details.filter(d => d.simulation_id === h.id)
          })));
        }
      }
    };
    fetchScenarios();
  }, [user]);

  const loadScenario = (sc: any) => {
    const details = sc.details;
    if (!details || details.length === 0) return;

    const newData = JSON.parse(JSON.stringify(graphData, (k, v) => (k === 'source' || k === 'target') && v?.id ? v.id : v));
    let changesCount = 0;
    let newProdsCount = 0;

    details.forEach((det: any) => {
      if (det.product_id) {
        const prod = newData.products.find((p: any) => p.id === det.product_id);
        if (prod) {
          prod.price = det.adjusted_price;
          prod.discount = det.adjusted_discount;
          changesCount++;
        }
      } else if (det.new_product_name) {
        // Logic for adding new product from scenario
        // This is a bit more complex as handleAddProduct usually does this, 
        // but we can manually add to newData.products
        newProdsCount++;
      }
    });

    if (sc.condition) setMarketCondition(sc.condition);
    
    recalcAggregates(newData);
    setGraphData(newData);
    setXaiMessage(`💡 Đã tải kịch bản '${sc.name}': Áp dụng ${changesCount} điều chỉnh sản phẩm và ${newProdsCount} sản phẩm mới.`);
    setTimeout(() => graphRef.current?.d3ReheatSimulation(), 50);
  };

  const deleteScenario = async (id: string) => {
    try {
      const { error } = await supabase
        .from('simulation_headers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSavedScenarios(prev => prev.filter(sc => sc.id !== id));
      setXaiMessage("🗑️ Đã xóa kịch bản.");
    } catch (err) {
      console.error("Lỗi khi xóa kịch bản:", err);
    }
  };

  const handleSetMyShop = (shopId: string) => {
    const newData = JSON.parse(JSON.stringify(graphData, (k, v) => (k === 'source' || k === 'target') && v?.id ? v.id : v));
    newData.shops.forEach((s: any) => {
      s.isMe = s.id === shopId;
    });
    newData.nodes.forEach((n: any) => {
      if (n.type === 'shop') n.isMe = n.id === shopId;
    });
    setGraphData(newData);
    
    d3DataRef.current.nodes.forEach((n: any) => {
      if (n.type === 'shop') n.isMe = n.id === shopId;
    });
    
    setSelectedNodes(prev => prev.map(n => n.id === shopId ? newData.shops.find((s: any) => s.id === shopId) : n));
    setXaiMessage(`Đã chuyển cửa hàng của bạn thành: ${newData.shops.find((s: any) => s.id === shopId)?.name}`);
    setTimeout(() => graphRef.current?.d3ReheatSimulation(), 50);
  };

  const handleUnsetMyShop = () => {
    const newData = JSON.parse(JSON.stringify(graphData, (k, v) => (k === 'source' || k === 'target') && v?.id ? v.id : v));
    newData.shops.forEach((s: any) => {
      s.isMe = false;
    });
    newData.nodes.forEach((n: any) => {
      if (n.type === 'shop') n.isMe = false;
    });
    setGraphData(newData);
    
    d3DataRef.current.nodes.forEach((n: any) => {
      if (n.type === 'shop') n.isMe = false;
    });
    
    if (selectedNodes.length === 1 && selectedNodes[0].type === 'shop') {
        setSelectedNodes([{...selectedNodes[0], isMe: false}]);
    }
    
    setXaiMessage(`Đã hủy chọn cửa hàng. Bản đồ hiện ở chế độ quan sát khách quan.`);
    setTimeout(() => graphRef.current?.d3ReheatSimulation(), 50);
  };

  const steps: Step[] = [
    // --- PHẦN 1: TỔNG QUAN ---
    {
      target: '.graph-container',
      content: '🗺️ Đây là Đồ thị Tri thức (Knowledge Graph) — trái tim của GraphRetail AI.\n\n• Mỗi node đại diện cho một Vùng, Shop hoặc Sản phẩm.\n• Kích thước node = Doanh thu (càng lớn = doanh thu càng cao).\n• Đường nối thể hiện mối quan hệ: bán hàng, vị trí, cạnh tranh.\n• Kéo thả node để khám phá cấu trúc thị trường.',
      disableBeacon: true,
      placement: 'center'
    },
    {
      target: '.network-legend',
      content: '📖 Bảng Chú Giải giúp bạn đọc đồ thị:\n\n• 🟢 Node xanh ngọc = Shop của bạn\n• ⚫ Node đen = Đối thủ cạnh tranh (Shop)\n• 🔵 Node xanh nhạt = Sản phẩm\n• 📍 Node xanh lá = Vùng/Khu vực\n• Đường liền = Kênh bán hàng (💰)\n• Đường đứt = Cạnh tranh trực tiếp\n\nNhấn "Căn giữa biểu đồ" để reset góc nhìn.'
    },

    // --- PHẦN 2: THANH CÔNG CỤ ---
    {
      target: '.search-container',
      content: '🔍 Thanh Tìm kiếm — gõ tên sản phẩm hoặc shop để nhanh chóng di chuyển camera đến đúng node đó trên đồ thị.\n\nMẹo: Gõ một phần tên cũng được, hệ thống sẽ lọc tức thì!'
    },
    {
      target: '.compare-mode-toggle',
      content: '⚖️ Compare Mode — Bật chế độ so sánh để chọn nhiều node cùng lúc.\n\nKhi bật:\n• Click vào nhiều sản phẩm/shop khác nhau\n• Bảng so sánh sẽ hiển thị ở panel phải\n• So sánh giá, doanh thu, khuyến mại song song\n\nRất hữu ích khi phân tích đối thủ!'
    },
    {
      target: '.sidebar-toggle-btn',
      content: '📊 Nút Mở/Đóng Panel Phân tích bên phải.\n\nPanel này hiển thị thông tin chi tiết khi bạn click vào một node, bao gồm:\n• Thông tin giá, khuyến mại, đã bán\n• GNN Intelligence Score\n• Công cụ mô phỏng & dự báo doanh thu'
    },
    {
      target: '.refresh-data-btn',
      content: '🔄 Nút Làm mới Dữ liệu — tải lại toàn bộ dữ liệu mới nhất từ Supabase.\n\nSử dụng sau khi bạn vừa crawl thêm dữ liệu mới từ Chrome Extension để cập nhật đồ thị ngay lập tức mà không cần tải lại trang.'
    },
    {
      target: '.add-product-btn',
      content: '➕ Thêm Sản phẩm Mô phỏng — thêm một sản phẩm ảo vào đồ thị để dự báo hiệu quả trước khi ra mắt thật.\n\nBạn cần chọn "Shop của tôi" trước, sau đó nhập tên, giá và vùng cho sản phẩm mới.'
    },
    {
      target: '.tutorial-btn',
      content: '❓ Nút Hướng dẫn — nhấn vào đây bất cứ lúc nào để xem lại hướng dẫn sử dụng này từ đầu!'
    },

    // --- PHẦN 3: PANEL PHÂN TÍCH ---
    {
      target: '.intelligence-dashboard',
      content: '🧠 Panel Intelligence — trung tâm điều khiển chiến lược:\n\n1️⃣ Market Scenarios: Chọn kinh tế Bình thường / Tăng trưởng / Suy thoái\n2️⃣ Khi click vào sản phẩm: xem GNN Score, đối thủ cạnh tranh, cảnh báo Cannibalization\n3️⃣ Điều chỉnh thanh trượt Giá/KM để chạy mô phỏng doanh thu\n4️⃣ Lưu kịch bản để so sánh sau'
    },

    // --- PHẦN 4: TƯƠNG TÁC ĐỒ THỊ ---
    {
      target: '.graph-container',
      content: '🖱️ Cách tương tác với Đồ thị:\n\n• Click vào node → Xem chi tiết ở panel phải\n• Click vào Shop → Nhấn "Đặt làm Cửa hàng của tôi" để hệ thống phân tích chiến lược cho bạn\n• Cuộn chuột → Zoom in/out\n• Kéo nền → Di chuyển camera\n• Kéo node → Sắp xếp lại vị trí\n\nMẹo: Click vào nền trống để bỏ chọn tất cả.',
      placement: 'center'
    },

    // --- PHẦN 5: AI CHATBOT ---
    {
      target: '.chatbot-btn',
      content: '🤖 Trợ lý AI — chat trực tiếp với AI để phân tích dữ liệu:\n\n• Hỏi: "Top sản phẩm bán chạy nhất?"\n• Hỏi: "So sánh các shop"\n• Hỏi: "Đề xuất chiến lược giá"\n• Hỏi: "Sản phẩm nào cần tăng KM?"\n\nAI sẽ phân tích DỮ LIỆU THỰC TẾ từ đồ thị của bạn, không phải thông tin chung chung!'
    },

    // --- PHẦN 6: CHROME EXTENSION ---
    {
      target: '.graph-container',
      content: '🧩 Chrome Extension — Thu thập dữ liệu từ Shopee:\n\n📥 Cài đặt:\n1. Mở chrome://extensions → Bật "Chế độ nhà phát triển"\n2. Nhấn "Tải tiện ích đã giải nén" → chọn thư mục chrome-extension/\n\n🔐 Đăng nhập:\n3. Mở Extension → nhập Email/Mật khẩu Supabase\n\n🕷️ Crawl dữ liệu:\n4. Vào trang Shopee → nhấn "Bắt đầu Crawl"\n5. Sau khi hoàn tất → nhấn "Đẩy lên Supabase"\n6. Quay lại Web App → nhấn nút 🔄 để xem dữ liệu mới!',
      placement: 'center'
    },

    // --- PHẦN 7: MÔ PHỎNG NÂNG CAO ---
    {
      target: '.intelligence-dashboard',
      content: '🎮 Mô phỏng Nâng cao:\n\n🌐 Chọn kịch bản kinh tế (Normal/Growth/Recession) để xem thị trường phản ứng thế nào.\n\n🎯 Auto Optimize: AI tự động tìm mức giá & KM tối ưu cho shop của bạn.\n\n💾 Lưu Kịch bản: Đặt tên và lưu lại để so sánh nhiều phương án khác nhau.\n\n🔄 Khôi phục gốc: Reset tất cả về trạng thái ban đầu.'
    },

    // --- KẾT THÚC ---
    {
      target: '.graph-container',
      content: '🎉 Hoàn tất hướng dẫn!\n\nBạn đã nắm được tất cả chức năng chính của GraphRetail AI:\n\n✅ Đồ thị tri thức & GNN Intelligence\n✅ Tìm kiếm, so sánh, mô phỏng\n✅ Chrome Extension crawl dữ liệu\n✅ AI Chatbot phân tích chiến lược\n\nMẹo cuối: Nhấn nút ❓ trên thanh công cụ bất cứ lúc nào để xem lại hướng dẫn này.\n\nChúc bạn thành công! 🚀',
      placement: 'center'
    },
  ];

  const [initialData, setInitialData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;

    const mapRows = (rows: any[]): CrawledRow[] => rows.map((r: any) => ({
      shop: (r.shop_name || '').trim(),
      name: r.name || '',
      rating: Number(r.rating) || 0,
      price: Number(r.price) || 0,
      sold: Number(r.sold_count) || 0,
      region: r.region || '',
      discount: Number(r.promotion) || 0,
    }));

    const loadGraph = (rows: CrawledRow[]) => {
      setLoadingProgress(60);
      
      // Performance: Use Web Worker for GNN if possible
      if (window.Worker) {
        const worker = new Worker(new URL('./lib/gnnWorker.ts', import.meta.url), { type: 'module' });
        
        // Generate structural data for GNN
        const rawData = generateGraphData(rows);
        
        worker.postMessage({
          type: 'RUN_GNN',
          nodes: rawData.nodes.map(n => ({...n, embedding: undefined})), // strip heavy objects
          links: rawData.links.map(l => ({source: l.source, target: l.target, type: l.type})),
          metrics: rawData.metrics
        });

        worker.onmessage = (e) => {
          if (e.data.type === 'GNN_RESULT') {
            const { gnnScores, competitionScores, embeddings } = e.data;
            
            // Reconstruct GNN result into rawData
            rawData.nodes.forEach((n: any) => {
              n.gnnScore = gnnScores[n.id] || 0;
              // Reconstruct Float32Array from sent array
              if (embeddings[n.id]) n.embedding = new Float32Array(embeddings[n.id]);
            });

            // Update competition links from Worker results
            const structuralLinks = rawData.links.filter(l => l.type !== 'competes_with');
            const gnnCompLinks: any[] = [];
            Object.entries(competitionScores).forEach(([pId, comps]: [string, any]) => {
              comps.forEach((c: any) => {
                gnnCompLinks.push({ source: pId, target: c.targetId, type: 'competes_with', competitionStrength: c.score });
              });
            });
            rawData.links = [...structuralLinks, ...gnnCompLinks];
            
            gnnResultRef.current = {
              embeddings: new Map(Object.entries(embeddings).map(([k, v]) => [k, new Float32Array(v as number[])])),
              gnnScores: new Map(Object.entries(gnnScores)),
              competitionScores: new Map(Object.entries(competitionScores)),
              predictions: new Map() // filler
            };

            setGraphData(rawData);
            setInitialData(JSON.parse(JSON.stringify(rawData, (k, v) => v instanceof Float32Array ? Array.from(v) : v)));
            d3DataRef.current = { nodes: [...rawData.nodes], links: [...rawData.links] };
            setHasData(true);
            setGnnReady(true);
            setLoadingProgress(100);
            worker.terminate();
          }
        };
      } else {
        // Fallback to sync if worker fails
        const rawData = generateGraphData(rows);
        setGraphData(rawData);
        setInitialData(JSON.parse(JSON.stringify(rawData, (k, v) => v instanceof Float32Array ? Array.from(v) : v)));
        d3DataRef.current = { nodes: [...rawData.nodes], links: [...rawData.links] };
        if (rawData.gnnResult) {
          gnnResultRef.current = rawData.gnnResult;
          setGnnReady(true);
        }
        setHasData(true);
        setLoadingProgress(100);
      }
    };

    const loadData = async () => {
      setHasData(false);
      setDataLoading(true);

      try {
        // Log user context for debugging
        console.log(`App: Loading data for User ID: ${user.id}`);
        
        // Parallel fetch profile and products
        const [profileRes, productsRes] = await Promise.all([
          supabase.from('profiles').select('display_name').eq('id', user.id).single(),
          supabase.from('products').select('*').eq('user_id', user.id)
        ]);

        const displayName = profileRes.data?.display_name || user.email;
        console.log(`App: Logged in as ${displayName}`);

        if (productsRes.error) {
          console.error('App: Supabase Fetch Error:', productsRes.error);
          throw productsRes.error;
        }

        if (productsRes.data && productsRes.data.length > 0) {
          console.log(`App: Found ${productsRes.data.length} actual records for ${user.id}`);
          loadGraph(mapRows(productsRes.data));
          setHasData(true);
          setIsDataEmpty(false);
          setDataLoading(false); // Stop loading after data is processed
        } else {
          // No data found for this specific user ID
          console.warn(`App: No data records found for user_id: ${user.id}.`);
          setIsDataEmpty(true);
          setHasData(false);
          setDataLoading(false); // Stop loading so we can show Empty State
        }
      } catch (err) {
        console.error('App: Critical data loading error:', err);
        setDataLoading(false);
        setIsDataEmpty(true);
      } finally {
        // Ensure progress reaches 100%
        setLoadingProgress(100);
        setTimeout(() => setDataLoading(false), 800);
      }
    };

    loadData();

    const isTutorialCompleted = localStorage.getItem('retailAiTutorialCompleted');
    if (!isTutorialCompleted) {
      const tourTimer = setTimeout(() => setRunTour(true), 1000);
      return () => clearTimeout(tourTimer);
    }
  }, [user?.id, supabase, refreshTrigger]);

  useEffect(() => {
    if (!d3DataRef.current.nodes.length && !graphData.nodes.length) return;

    graphData.nodes.forEach((uiNode: any) => {
      const d3Node = d3DataRef.current.nodes.find((n: any) => n.id === uiNode.id);
      if (d3Node) {
        const { x, y, index, ...safeProps } = uiNode;
        Object.assign(d3Node, safeProps);
      } else {
        d3DataRef.current.nodes.push({ ...uiNode });
      }
    });

    graphData.links.forEach((uiLink: any) => {
      const linkExists = d3DataRef.current.links.find(
        (l: any) =>
          (typeof l.source === "object" ? l.source.id : l.source) ===
            (typeof uiLink.source === "object" ? uiLink.source.id : uiLink.source) &&
          (typeof l.target === "object" ? l.target.id : l.target) ===
            (typeof uiLink.target === "object" ? uiLink.target.id : uiLink.target)
      );
      if (!linkExists) d3DataRef.current.links.push({ ...uiLink });
    });
  }, [graphData]);

  useEffect(() => {
    if (!containerRef.current) return;
    
    let resizeTimer: any;
    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
        
        // Use a slight delay to ensure the canvas has resized before centering
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (graphRef.current) {
            // Zoom to fit with padding to ensure the graph fills the screen properly
            graphRef.current.zoomToFit(800, 40);
          }
        }, 150);
      }
    };
    
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    
    observer.observe(containerRef.current);
    
    // Attempt multiple measures as the layout stabilizes
    measure();
    const t1 = setTimeout(measure, 100);
    const t2 = setTimeout(measure, 500);
    const t3 = setTimeout(measure, 1000);
    
    return () => {
      observer.disconnect();
      clearTimeout(resizeTimer);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [isSidebarOpen, graphData.nodes.length, dataLoading]); // Re-run when sidebar, data, or loading state changes

  useEffect(() => {
    const timer = setTimeout(() => {
      if (graphRef.current) {
        const nodeCount = graphData.nodes.length;
        // Dynamic charge based on node count to prevent "empty space" or "overcrowding"
        const chargeStrength = nodeCount < 20 ? -800 : nodeCount < 50 ? -500 : -300;
        graphRef.current.d3Force('charge').strength(chargeStrength);
        
        const m = graphData.metrics;
        graphRef.current.d3Force('link').distance((link: any) => {
          if (link.type === 'located_in') return 180;
          if (link.type === 'sells') {
            const prod = graphData.products.find((p: any) => p.id === (typeof link.target === 'object' ? link.target.id : link.target));
            const revRatio = prod ? prod.revenue / m.maxProductRevenue : 0.5;
            return 70 + (1 - revRatio) * 70;
          }
          if (link.type === 'competes_with') {
            const srcId = typeof link.source === 'object' ? link.source.id : link.source;
            const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            const a = graphData.products.find((p: any) => p.id === srcId);
            const b = graphData.products.find((p: any) => p.id === tgtId);
            if (a && b) {
              const diff = Math.abs(a.price - b.price);
              const avg = (a.price + b.price) / 2 || 1;
              return 50 + (diff / avg) * 150;
            }
            return 140;
          }
          return 100;
        });
        
        // Add a center force to keep everything from drifting too far
        graphRef.current.d3Force('center').x(0).y(0);
        
        graphRef.current.d3ReheatSimulation();
        
        // Re-fit after simulation settles a bit
        setTimeout(() => {
          if (graphRef.current) graphRef.current.zoomToFit(600, 40);
        }, 500);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [graphData, dataLoading, dimensions]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const isPrimarySelected = highlightMap.primary.has(node.id);
    const isSecondarySelected = highlightMap.secondary.has(node.id);
    const isDimmed = highlightMap.dimmed.has(node.id);

    // LOD: Level of Detail optimization
    const hideLabel = globalScale < 0.8 && !isPrimarySelected;
    const hideShadow = globalScale < 1.2 && !isPrimarySelected;

    // Cache radius/styling on node if not exists (Performance)
    if (!node.__r) {
      const m = graphData.metrics;
      if (node.type === 'product') node.__r = 6 + Math.sqrt(node.revenue / m.maxProductRevenue) * 16;
      else if (node.type === 'shop') node.__r = 10 + Math.sqrt((node.totalRevenue || 0) / m.maxShopRevenue) * 14;
      else if (node.type === 'region') node.__r = 14 + Math.sqrt((node.totalRevenue || 0) / m.maxRegionRevenue) * 12;
      else node.__r = 10;
    }

    const nodeR = node.__r;
    const radius = isPrimarySelected ? nodeR + 4 : isSecondarySelected ? nodeR + 2 : nodeR;
    const fillStyle = node.type === 'region' ? '#0d9488' : node.type === 'shop' ? (node.isMe ? '#1de5e2' : '#2d3748') : '#1de5e2';
    
    ctx.globalAlpha = isDimmed ? 0.15 : 1;

    if (!hideShadow) {
      if (isPrimarySelected) { ctx.shadowColor = '#1de5e2'; ctx.shadowBlur = 20 / globalScale; }
      else if (isSecondarySelected) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 15 / globalScale; }
    }
    else { ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 8 / globalScale; }
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = isPrimarySelected || isSecondarySelected ? 0 : 2 / globalScale;

    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;

    // Rating border
    const rating = node.rating || 0;
    ctx.lineWidth = (1 + (rating / 5) * 2.5) / globalScale;
    ctx.strokeStyle = isPrimarySelected ? '#0f172a' : isSecondarySelected ? '#fbbf24' : rating >= 4.5 ? '#fbbf24' : '#94a3b8';
    ctx.stroke();

    // Icon
    const iconImg = iconCache[node.type];
    if (iconImg) {
      const iconSize = radius * 1.2;
      ctx.drawImage(iconImg, node.x - iconSize / 2, node.y - iconSize / 2, iconSize, iconSize);
    }

    // Label + stats
    if (!hideLabel) {
      const fontSize = Math.max(12 / globalScale, 2);
      ctx.font = `${isPrimarySelected ? '700' : '500'} ${fontSize}px Inter, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      
      const label = node.name;
      const truncLabel = label.length > 20 ? label.substring(0, 18) + '...' : label;
      
      ctx.fillStyle = isDimmed ? 'rgba(71, 85, 105, 0.4)' : '#1e293b';
      ctx.fillText(truncLabel, node.x, node.y + radius + 2 / globalScale);

      // Stats on deep zoom
      if (globalScale > 2.0 && !isDimmed) {
        const statsFontSize = fontSize * 0.75;
        ctx.font = `500 ${statsFontSize}px Inter, sans-serif`;
        let statsText = '';
        if (node.type === 'product') statsText = `₫${(node.price/1000).toFixed(0)}K | ${(node.sold).toLocaleString()} sold`;
        else if (node.type === 'shop') statsText = `₫${(node.totalRevenue/1e9).toFixed(1)}B rev`;
        else if (node.type === 'region') statsText = `₫${(node.totalRevenue/1e9).toFixed(1)}B total`;
        
        if (statsText) {
          ctx.fillStyle = "rgba(71, 85, 105, 0.7)";
          ctx.fillText(statsText, node.x, node.y + radius + 2 / globalScale + fontSize * 1.2);
        }
      }
    }
    ctx.globalAlpha = 1;
  }, [selectedNodes, graphData, highlightMap]);

  useEffect(() => {
    
    if (selectedNodes.length > 0) {
      const typesPresent = Array.from(new Set(selectedNodes.map(n => n.type)));
      if (!typesPresent.includes(compType)) {
        setCompType(typesPresent[0] as any);
      }
    }
  }, [selectedNodes]);

  const handleNodeClick = (node: any, event: any) => {
    // Quan trọng: Phải copy node {...node} để React không làm hỏng object gốc của D3
    const safeNode = { ...node }; 
    
    if (multiSelectMode || event.shiftKey || event.metaKey || event.ctrlKey) {
      setSelectedNodes(prev => {
        const exists = prev.find(n => n.id === safeNode.id);
        if (exists) return prev.filter(n => n.id !== safeNode.id);
        return [...prev, safeNode];
      });
    } else {
      setSelectedNodes(prev => (prev.length === 1 && prev[0].id === safeNode.id ? [] : [safeNode]));
    }
    setDiscountChange(0);
    setPriceChange(0);
    setXaiMessage(null);

    // Auto-center and zoom on clicked node for immediate focus
    if (graphRef.current && !multiSelectMode && !event.shiftKey) {
      graphRef.current.centerAt(safeNode.x, safeNode.y, 800);
      graphRef.current.zoom(2.5, 800);
    }
  };

  const runSimulation = () => {
    const primaryNode = selectedNodes[0];
    if (!primaryNode || primaryNode.type !== "product") return;

    // Use GNN-powered prediction if available
    const gnn = gnnResultRef.current;
    let newSold: number, newRevenue: number, gnnExplanation = '';

    if (gnn && gnn.embeddings.size > 0) {
      // GNN-powered simulation
      const prediction = predictRevenueWithGNN(
        primaryNode, priceChange, discountChange,
        marketCondition, gnn.embeddings, gnn.competitionScores,
        graphData.products
      );
      newSold = prediction.sold;
      newRevenue = prediction.revenue;
      gnnExplanation = prediction.explanation;
    } else {
      // Fallback: original elasticity-based calculation
      let priceElasticity = 1.5;
      let discountBoostMult = 2.0;
      if (marketCondition === 'recession') { priceElasticity = 2.5; discountBoostMult = 3.0; }
      else if (marketCondition === 'growth') { priceElasticity = 0.5; discountBoostMult = 1.2; }

      const newDiscount = Math.min(0.7, Math.max(0, primaryNode.originalDiscount + discountChange / 100));
      const newPrice = Math.max(1000, primaryNode.originalPrice * (1 + priceChange / 100));
      const priceEffect = Math.max(0.1, 1 - (priceChange / 100) * priceElasticity);
      const discountEffect = 1 + (newDiscount - primaryNode.originalDiscount) * discountBoostMult;
      newSold = Math.max(0, Math.floor(primaryNode.originalSold * priceEffect * discountEffect));
      const actualPrice = newPrice * (1 - newDiscount);
      newRevenue = actualPrice * newSold;
    }

    const newDiscount = Math.min(0.7, Math.max(0, primaryNode.originalDiscount + discountChange / 100));
    const newPrice = Math.max(1000, primaryNode.originalPrice * (1 + priceChange / 100));

    const newData = JSON.parse(JSON.stringify(graphData, (k, v) => {
      if (v instanceof Float32Array) return Array.from(v);
      if ((k === 'source' || k === 'target') && v?.id) return v.id;
      if (k === 'gnnResult' || k === 'embedding') return undefined;
      return v;
    }));
    
    newData.products.forEach((p: any) => {
      if (p.id === primaryNode.id) {
        p.discount = newDiscount;
        p.price = newPrice;
        p.sold = newSold;
        p.revenue = newRevenue;
        p.vx = (Math.random() - 0.5) * 200;
        p.vy = (Math.random() - 0.5) * 200;
      } else {
        const isCompetitor = p.regionId === primaryNode.regionId && p.shopId !== primaryNode.shopId;
        if (isCompetitor && (priceChange < 0 || discountChange > 0)) {
           p.sold = Math.max(0, Math.floor(p.sold * 0.98));
           p.revenue = p.price * (1 - p.discount) * p.sold;
        }
      }
    });

    recalcAggregates(newData);
    setGraphData(newData);
    
    setSelectedNodes(prev => prev.map(n => {
      if (n.type === 'product') return newData.products.find((p: any) => p.id === n.id) || n;
      if (n.type === 'shop') return newData.shops.find((s: any) => s.id === n.id) || n;
      if (n.type === 'region') return newData.regions.find((r: any) => r.id === n.id) || n;
      return n;
    }));

    const myShop = newData.shops.find((s: any) => s.isMe);

    if (discountChange !== 0 || priceChange !== 0) {
      const gnnTag = gnn ? '[GNN]' : '';
      const baseMsg = `${gnnTag} ${marketCondition.toUpperCase()}: Giá ${priceChange}% | KM ${discountChange}%. Lượt bán: ${newSold.toLocaleString()}. Doanh thu: ₫${fmtVND(Math.floor(newRevenue))}.`;
      
      setXaiMessage(baseMsg + "\n(AI đang phân tích...)");
      setIsXaiLoading(true);

      getGeminiXAIExplanation(
        primaryNode,
        { priceChange, discountChange },
        { newSold, newRevenue, revenueDelta: newRevenue - (primaryNode.originalPrice * (1 - primaryNode.originalDiscount) * primaryNode.originalSold) },
        marketCondition,
        gnnExplanation
      ).then(explanation => {
        setXaiMessage(baseMsg + "\n" + explanation);
        setIsXaiLoading(false);
      }).catch(() => {
        setXaiMessage(baseMsg);
        setIsXaiLoading(false);
      });
    } else {
      setXaiMessage(`Không thay đổi giá trị. Doanh thu giữ nguyên.`);
    }
    setTimeout(() => graphRef.current?.d3ReheatSimulation(), 50);
    setDiscountChange(0);
    setPriceChange(0);
  };

  // Revenue forecast curve
  const generateRevenueCurve = (product: any) => {
    const points = [];
    for (let d = 0; d <= 60; d += 5) {
      const disc = d / 100;
      const simPrice = product.originalPrice * (1 + priceChange / 100);
      const isCheap = product.originalPrice <= 250000;
      const isPremium = product.originalPrice >= 1000000;
      let pElasticity = 1.5;
      let dBoost = 2.0;
      if (marketCondition === 'recession') { pElasticity = 2.5; dBoost = 3.0; }
      else if (marketCondition === 'growth') { pElasticity = 0.5; dBoost = 1.2; }

      const priceEffect = Math.max(0.1, 1 - (priceChange / 100) * pElasticity);
      const discountEffect = 1 + (disc - product.originalDiscount) * dBoost;
      
      const sold = Math.max(0, Math.floor(product.originalSold * priceEffect * discountEffect));
      const rev = simPrice * (1 - disc) * sold;
      points.push({ discount: d, revenue: Math.floor(rev), sold });
    }
    return points;
  };

  const renderComparisonView = () => {
    const nodesToCompare = selectedNodes.filter(n => n.type === compType);
    
    if (nodesToCompare.length === 0) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500">
          Select at least one {compType} to compare.
        </div>
      );
    }

    const metrics = compType === "product"
      ? [
          { key: "revenue", label: "Doanh thu", color: "#3b82f6" },
          { key: "price", label: "Giá (₫)", color: "#10b981" },
          { key: "sold", label: "Đã bán", color: "#f59e0b" },
        ]
      : compType === "shop"
      ? [
          { key: "totalRevenue", label: "Tổng DT", color: "#10b981" },
          { key: "productCount", label: "Số SP", color: "#8b5cf6" },
          { key: "rating", label: "Rating", color: "#f59e0b" },
        ]
      : [
          { key: "totalRevenue", label: "Tổng DT", color: "#ef4444" },
          { key: "shopCount", label: "Số Shop", color: "#8b5cf6" },
          { key: "productCount", label: "Số SP", color: "#3b82f6" },
        ];

    // Ensure active metric is valid for current type
    const activeMetricObj = metrics.find(m => m.key === compMetric) || metrics[0];

    return (
      <div className="flex flex-col h-full bg-slate-50 relative flex-1 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-white shadow-[0_4px_6px_-6px_rgba(0,0,0,0.1)] flex flex-col gap-3 shrink-0 z-20">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-slate-800 flex items-center gap-2 text-md">
              <TrendingUp size={16} className="text-blue-500" /> Comparison
            </h3>
            <span className="text-xs font-semibold px-2 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
              {selectedNodes.length} Selected
            </span>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
            {(["product", "shop", "region"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setCompType(t)}
                className={`flex-1 text-[11px] font-bold capitalize py-1 rounded-md transition-colors ${
                  compType === t ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t === 'product' ? 'Sản phẩm' : t === 'shop' ? 'Shop' : 'Vùng'}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            {metrics.map((m) => (
              <button
                key={m.key}
                onClick={() => setCompMetric(m.key)}
                className={`flex-1 py-1 rounded-md text-[10px] font-bold transition-all border ${
                  activeMetricObj.key === m.key
                    ? `bg-slate-800 border-slate-800 text-white shadow-sm`
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-4 min-h-0">
          <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm h-full flex flex-col">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
              {activeMetricObj.label} Chart
            </h4>
            <div className="flex-1 w-full relative min-h-[150px]">
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={nodesToCompare} margin={{ top: 10, right: 10, bottom: 20, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} textAnchor="end" angle={-35} height={40} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "11px", fontWeight: "bold" }}
                  />
                  <Bar dataKey={activeMetricObj.key} fill={activeMetricObj.color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleAddNewProduct = () => {
    if (!newProductForm.name || !newProductForm.regionId) return;
    const myShop = graphData.shops.find((s: any) => s.isMe);
    if (!myShop) return;
    const newProdId = `product-${Date.now()}`;
    const shopD3Node = d3DataRef.current.nodes.find((n: any) => n.id === myShop.id);
    const price = Number(newProductForm.price);
    const isCheap = price <= 250000;
    const isPremium = price >= 1000000;
    
    let initialSold = 100;
    if (marketCondition === 'recession') {
      initialSold = isCheap ? 500 : (isPremium ? 50 : 100);
    } else if (marketCondition === 'growth') {
      initialSold = isPremium ? 400 : 150;
    } else {
      initialSold = 200;
    }

    const newProd: any = {
      id: newProdId, type: 'product', name: newProductForm.name, shopId: myShop.id,
      regionId: newProductForm.regionId, price, originalPrice: price, sold: initialSold, originalSold: initialSold,
      rating: 0, discount: 0, originalDiscount: 0, revenue: price * initialSold, isNew: true,
      x: shopD3Node?.x || 0, y: shopD3Node?.y || 0,
      vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100
    };
    const sellsLink = { source: myShop.id, target: newProdId, type: 'sells' };
    d3DataRef.current = { nodes: [...d3DataRef.current.nodes, newProd], links: [...d3DataRef.current.links, sellsLink] };
    setGraphData((prev: any) => ({ ...prev, nodes: [...prev.nodes, newProd], products: [...prev.products, newProd], links: [...prev.links, sellsLink] }));
    setShowAddProduct(false);
    setNewProductForm({ name: '', price: 100000, regionId: '' });
    setTimeout(() => graphRef.current?.d3ReheatSimulation(), 100);
  };

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      localStorage.setItem('retailAiTutorialCompleted', 'true');
    }
  };

  useEffect(() => {
    if (!dataLoading) return;
    
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setDataLoading(false), 500); // Small delay after 100%
          return 100;
        }
        const diff = Math.random() * 15;
        return Math.min(100, prev + diff);
      });
    }, 300);

    return () => clearInterval(interval);
  }, [dataLoading]);

  if (dataLoading) {
    return <LoadingScreen progress={loadingProgress} />;
  }



  return (
    <div className="h-screen bg-slate-50 text-slate-900 font-sans flex flex-col overflow-hidden">
      <Joyride
        key={tourKey}
        callback={handleJoyrideCallback}
        continuous
        hideCloseButton
        run={runTour}
        scrollToFirstStep
        showProgress
        showSkipButton
        steps={steps}
        styles={{
          options: {
            zIndex: 10000,
            primaryColor: '#1de5e2',
          },
          tooltip: {
            borderRadius: '16px',
            padding: '0',
            maxWidth: '460px',
          },
          tooltipContainer: {
            textAlign: 'left' as const,
          },
          tooltipContent: {
            padding: '20px 24px',
            fontSize: '14px',
            lineHeight: '1.7',
            whiteSpace: 'pre-line' as const,
            color: '#334155',
          },
          tooltipTitle: {
            fontSize: '16px',
            fontWeight: 700,
            padding: '16px 24px 0',
          },
          buttonNext: {
            borderRadius: '10px',
            padding: '8px 20px',
            fontSize: '13px',
            fontWeight: 700,
          },
          buttonBack: {
            color: '#64748b',
            fontSize: '13px',
            fontWeight: 600,
          },
          buttonSkip: {
            color: '#94a3b8',
            fontSize: '12px',
          },
          spotlight: {
            borderRadius: '16px',
          },
        }}
        locale={{
          back: 'Quay lại',
          close: 'Đóng',
          last: 'Hoàn tất',
          next: 'Tiếp tục',
          skip: 'Bỏ qua',
        }}
      />

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProduct && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
            >
              <button 
                onClick={() => setShowAddProduct(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
              <div className="p-6">
                <h3 className="text-xl font-bold text-slate-800 mb-1">Add New Product</h3>
                <p className="text-slate-500 text-sm mb-6">Add a new product to your store (Me) to simulate its impact.</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Product Name</label>
                    <input 
                      type="text" 
                      value={newProductForm.name}
                      onChange={e => setNewProductForm({...newProductForm, name: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      placeholder="e.g., Ultra Widget X"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Base Price ($)</label>
                      <input 
                        type="number" 
                        value={newProductForm.price}
                        onChange={e => setNewProductForm({...newProductForm, price: Number(e.target.value)})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Vùng</label>
                      <select 
                        value={newProductForm.regionId}
                        onChange={e => setNewProductForm({...newProductForm, regionId: e.target.value})}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white"
                      >
                        <option value="" disabled>Chọn Vùng</option>
                        {graphData.regions.map((r: any) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1"><Save size={12}/> Scenario Name (Auto-save)</label>
                    <input 
                      type="text" 
                      value={scenarioNameInput}
                      onChange={e => setScenarioNameInput(e.target.value)}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-slate-50"
                      placeholder="e.g. Tung sản phẩm mới..."
                    />
                  </div>
                </div>

                <div className="mt-8">
                  <button 
                    onClick={handleAddNewProduct}
                    disabled={!newProductForm.name || !newProductForm.regionId}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-xl transition-colors shadow-sm"
                  >
                    Launch Product
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scenario Detail Modal */}
      <AnimatePresence>
        {viewingScenario && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden relative"
            >
              <button 
                onClick={() => setViewingScenario(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                    <Database size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">Chi tiết kịch bản: {viewingScenario.name}</h3>
                    <p className="text-slate-500 text-sm">Điều kiện thị trường: <span className="font-bold uppercase text-blue-600">{viewingScenario.condition}</span></p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-[10px] uppercase font-bold text-slate-500 sticky top-0">
                          <tr>
                            <th className="px-4 py-3">Sản phẩm</th>
                            <th className="px-4 py-3 text-right">Giá điều chỉnh</th>
                            <th className="px-4 py-3 text-right">Khuyến mãi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {viewingScenario.details.map((det: any, idx: number) => {
                            const originalProd = graphData.products.find((p: any) => p.id === det.product_id);
                            return (
                              <tr key={idx} className="hover:bg-white transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-bold text-slate-800 truncate max-w-[200px]">{det.new_product_name || originalProd?.name || det.product_id}</div>
                                  {det.new_product_name && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">SP MỚI</span>}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-blue-600">
                                  ₫{det.adjusted_price?.toLocaleString()}
                                </td>
                                <td className="px-4 py-3 text-right font-mono font-bold text-emerald-600">
                                  {(det.adjusted_discount * 100).toFixed(0)}%
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button 
                    onClick={() => { loadScenario(viewingScenario); setViewingScenario(null); }}
                    className="flex-1 py-3 bg-slate-800 hover:bg-black text-white font-bold rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2"
                  >
                    <Play size={16} /> Áp dụng kịch bản này
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg shadow-md" style={{ background: 'linear-gradient(135deg, #30E9CD, #20c4ab)' }}>
            <Network size={24} className="text-slate-900" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">GraphRetail <span style={{ color: '#30E9CD' }}>AI</span></h1>
            <p className="text-sm text-slate-500 font-medium">{user?.email}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-8 relative search-container">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Tìm kiếm sản phẩm, shop..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-none rounded-xl py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-[#30E9CD] outline-none transition-all"
            />
          </div>
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl z-[100] max-h-60 overflow-y-auto">
              {graphData.nodes
                .filter((n: any) => n.name.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((n: any) => (
                  <button
                    key={n.id}
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedNodes([n]);
                      graphRef.current?.centerAt(n.x, n.y, 800);
                      graphRef.current?.zoom(4, 800);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-slate-50 flex items-center gap-2 border-b border-slate-50 last:border-none"
                  >
                    <div className={`w-2 h-2 rounded-full ${n.type === 'shop' ? 'bg-[#2d3748]' : 'bg-[#1de5e2]'}`} />
                    <span className="text-xs font-medium text-slate-700 truncate">{n.name}</span>
                    <span className="text-[10px] text-slate-400 uppercase ml-auto">{n.type}</span>
                  </button>
                ))
              }
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 compare-mode-toggle">
            <div className="text-right d-none sm:block">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Compare Mode</p>
              <p className="text-[10px] text-slate-400 font-medium leading-tight">Select multiple nodes easily</p>
            </div>
            <button 
              onClick={() => setMultiSelectMode(!multiSelectMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#1de5e2] focus:ring-offset-2 ${multiSelectMode ? 'bg-[#1de5e2]' : 'bg-slate-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${multiSelectMode ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`sidebar-toggle-btn p-2 rounded-lg transition-all border ${isSidebarOpen ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-[#30E9CD]/10 text-[#30E9CD] border-[#30E9CD]/20'}`}
            title={isSidebarOpen ? "Ẩn Panel" : "Hiện Panel"}
          >
            <Activity size={20} className={!isSidebarOpen ? 'animate-pulse' : ''} />
          </button>
          <button 
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            className="refresh-data-btn p-2 text-slate-400 hover:text-[#30E9CD] hover:bg-[#30E9CD]/10 rounded-lg transition-colors border border-transparent hover:border-[#30E9CD]/20"
            title="Làm mới dữ liệu từ Supabase"
          >
            <RotateCcw size={20} className={dataLoading ? 'animate-spin' : ''} />
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button 
            onClick={() => setShowAddProduct(true)}
            className="add-product-btn flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg text-sm font-bold transition-colors border border-emerald-200"
          >
            <PlusCircle size={16} /> Add Product
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button 
            onClick={() => {
              setTourKey(prev => prev + 1);
              setRunTour(true);
            }}
            className="tutorial-btn p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
            title="Start Interactive Tutorial"
          >
            <HelpCircle size={20} />
          </button>
          <button
            onClick={signOut}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 cursor-pointer"
            title="Đăng xuất"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden bg-white">
        {isDataEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 p-8 text-center">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md"
            >
              <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Database size={40} />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-4">Chào mừng đến với GraphRetail AI</h2>
              <p className="text-slate-600 mb-8 font-medium">
                Tài khoản của bạn hiện chưa có dữ liệu. Hãy bắt đầu bằng cách nạp dữ liệu mẫu để khám phá các tính năng phân tích GNN.
              </p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={importSampleData}
                  disabled={isImporting}
                  className="w-full py-4 bg-slate-800 hover:bg-black text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isImporting ? <Loader2 size={20} className="animate-spin" /> : <PlusCircle size={20} />}
                  Nạp dữ liệu mẫu ngay
                </button>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Hoặc sử dụng Chrome Extension để crawl dữ liệu thật</p>
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="flex-1 flex min-w-0">
          {/* Left Panel: Graph Visualization */}
          <div 
            className="flex-1 relative bg-[#f8fafc] graph-container overflow-hidden border-r border-slate-200" 
            ref={containerRef}
            style={{ minWidth: 0 }}
          >
            <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md border border-slate-200 p-4 rounded-xl shadow-lg network-legend">
              <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wider">Chú giải</h3>
              <div className="flex flex-col gap-2.5 text-xs text-slate-600 font-medium">
                <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#1de5e2] shadow-sm"></div> Shop của tôi</div>
                <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#2d3748] shadow-sm"></div> Đối thủ (Shop)</div>
                <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#1de5e2] shadow-sm border border-slate-200"></div> Sản phẩm</div>
                <div className="flex items-center gap-2.5"><div className="w-3.5 h-3.5 rounded-full bg-[#0d9488] shadow-sm"></div> Vùng</div>
                <div className="flex items-center gap-2.5 mt-1.5 pt-1.5 border-t border-slate-200">
                  <div className="w-5 h-[2px] bg-[#1de5e2]"></div> Sells (dòng tiền 💰)
                </div>
                <div className="flex items-center gap-2.5"><div className="w-5 h-[2px] bg-slate-300"></div> Located In</div>
                <div className="flex items-center gap-2.5"><div className="w-5 h-[2px] bg-red-300 border-t-2 border-dashed"></div> Cạnh tranh</div>
                <div className="text-[9px] text-slate-400 mt-1 italic font-bold">Node lớn = doanh thu cao</div>
              </div>
              <button 
                onClick={() => graphRef.current?.zoomToFit(800, 100)}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 bg-slate-800 text-white rounded-lg hover:bg-black transition-all text-[11px] font-bold"
              >
                <Network size={14} /> Căn giữa biểu đồ
              </button>
            </div>

            <div className="absolute inset-0 cursor-crosshair bg-[#f8fafc]">
              <ErrorBoundary>
                {dimensions ? (
                  <ForceGraph2D
                    ref={graphRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    graphData={d3DataRef.current}
                    nodeCanvasObject={nodeCanvasObject}
                    nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                      ctx.fillStyle = color;
                      ctx.beginPath();
                      ctx.arc(node.x, node.y, 16, 0, 2 * Math.PI, false);
                      ctx.fill();
                    }}
                    linkColor={(link: any) => {
                      if (selectedNodes.length > 0) {
                        const selId = selectedNodes[0].id;
                        const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                        const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                        const isRelated = srcId === selId || tgtId === selId || 
                          (selectedNodes[0].type === 'shop' && graphData.products.some((p: any) => p.shopId === selId && (p.id === srcId || p.id === tgtId)));
                        if (!isRelated) return link.type === 'competes_with' ? 'rgba(203,213,225,0.1)' : 'rgba(148,163,184,0.12)';
                        if (link.type === 'competes_with') return 'rgba(239,68,68,0.7)';
                        return 'rgba(29, 229, 226, 0.8)';
                      }
                      if (link.type === 'competes_with') return 'rgba(239,68,68,0.25)';
                      if (link.type === 'sells') return 'rgba(29, 229, 226, 0.35)';
                      return 'rgba(148,163,184,0.3)';
                    }}
                    linkWidth={(link: any) => {
                      if (link.type === 'competes_with') {
                        const srcId = typeof link.source === 'object' ? link.source.id : link.source;
                        const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
                        const a = graphData.products.find((p: any) => p.id === srcId);
                        const b = graphData.products.find((p: any) => p.id === tgtId);
                        if (a && b) {
                          const diff = Math.abs(a.price - b.price);
                          const avg = (a.price + b.price) / 2 || 1;
                          return 0.5 + (1 - diff / avg) * 2.5;
                        }
                        return 0.5;
                      }
                      if (link.type === 'sells') {
                        const prodId = typeof link.target === 'object' ? link.target.id : link.target;
                        const prod = graphData.products.find((p: any) => p.id === prodId);
                        return prod ? 0.5 + (prod.revenue / graphData.metrics.maxProductRevenue) * 3 : 1;
                      }
                      return 1;
                    }}
                    linkLineDash={(link: any) => link.type === 'competes_with' ? [4, 4] : []}
                    linkDirectionalParticles={(link: any) => link.type === 'sells' ? 1 : 0}
                    linkDirectionalParticleWidth={(link: any) => {
                      const prodId = typeof link.target === 'object' ? link.target.id : link.target;
                      const prod = graphData.products.find((p: any) => p.id === prodId);
                      return prod ? 1 + (prod.revenue / graphData.metrics.maxProductRevenue) * 3 : 1.5;
                    }}
                    linkDirectionalParticleSpeed={0.004}
                    linkDirectionalParticleColor={() => "#fbbf24"}
                    onNodeClick={handleNodeClick}
                    onBackgroundClick={() => {
                      setSelectedNodes([]);
                      setDiscountChange(0);
                      setXaiMessage(null);
                    }}
                    backgroundColor="#f8fafc"
                    d3AlphaDecay={0.03}
                    d3VelocityDecay={0.4}
                    cooldownTicks={100}
                    cooldownTime={3000}
                  />
                ) : isDataEmpty ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-12 bg-white/50 backdrop-blur-sm rounded-3xl border-2 border-dashed border-slate-200">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-[#30E9CD] to-[#20c4ab] flex items-center justify-center shadow-lg shadow-[#30E9CD]/20 mb-8">
                      <Database size={48} className="text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-slate-900 mb-4 tracking-tight">Chào mừng đến với GraphRetail AI</h2>
                    <p className="text-slate-500 max-w-md mb-8 text-lg font-medium leading-relaxed">
                      Tài khoản của bạn hiện chưa có dữ liệu. Hãy bắt đầu bằng cách nạp dữ liệu mẫu để trải nghiệm sức mạnh của đồ thị tri thức và GNN.
                    </p>
                    <button
                      onClick={importSampleData}
                      disabled={isImporting}
                      className="px-8 py-4 bg-slate-900 hover:bg-black text-white rounded-2xl font-bold flex items-center gap-3 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-50"
                    >
                      {isImporting ? <Loader2 size={20} className="animate-spin" /> : <PlusCircle size={20} />}
                      {isImporting ? "Đang nạp dữ liệu..." : "Nạp dữ liệu mẫu ngay"}
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 font-medium">
                    <Loader2 className="animate-spin mr-2" size={20} /> Initializing AI Intelligence...
                  </div>
                )}
              </ErrorBoundary>
            </div>
          </div>

          {/* Right Panel: Controls & Metrics */}
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div 
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 380, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="bg-slate-50 flex flex-col shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10 shrink-0 intelligence-dashboard overflow-hidden"
              >
                {/* 1. Global Scenario Top Area (Compact & Always Visible) */}
                <div className="p-3 border-b border-slate-200 bg-white shrink-0 shadow-sm z-20">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Globe size={16} /> Market Scenarios
                    </h2>
                    <div className="flex gap-1.5">
                      <button title="Khôi phục trạng thái gốc" onClick={resetSimulation} className="text-[10px] uppercase font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 py-1.5 px-2 rounded flex items-center gap-1 transition-colors group">
                        <RotateCcw size={12} className="group-hover:-rotate-90 transition-transform duration-300"/> Khôi phục gốc
                      </button>
                      <button 
                        onClick={optimizeMyProfit} 
                        disabled={isXaiLoading}
                        className="text-[10px] uppercase font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 py-1.5 px-2 rounded flex items-center gap-1 transition-colors disabled:opacity-50"
                      >
                        <BrainCircuit size={12}/> {isXaiLoading ? "Đang xử lý..." : "Auto Optimize"}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <select 
                      className="flex-1 bg-slate-50 border border-slate-300 rounded text-xs font-semibold px-2 py-1.5 outline-none text-slate-700 focus:border-blue-500"
                      value={marketCondition}
                      onChange={(e) => applyMarketCondition(e.target.value as any)}
                    >
                      <option value="normal">Economy: Normal</option>
                      <option value="growth">Economy: Growth</option>
                      <option value="recession">Economy: Recession</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Save size={12} className="absolute left-2.5 top-2 text-slate-400" />
                      <input 
                        type="text"
                        className="w-full bg-slate-50 border border-slate-300 rounded text-xs pl-7 pr-2 py-1.5 outline-none placeholder:text-slate-400 focus:border-blue-500"
                        placeholder="Scenario name..."
                        value={scenarioNameInput}
                        onChange={e => setScenarioNameInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveScenario()}
                      />
                    </div>
                    <button 
                      onClick={saveScenario}
                      className="bg-slate-800 hover:bg-black text-white text-[11px] px-3 py-1.5 font-bold rounded transition-colors"
                    >
                      Save
                    </button>
                  </div>

                  {savedScenarios.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1 max-h-40 overflow-y-auto pr-1 border-t border-slate-100 pt-2">
                      {savedScenarios.map((sc) => (
                        <div key={sc.id} className="flex justify-between items-center bg-white/60 p-2 mb-1 rounded border border-slate-200 hover:bg-slate-100 transition-colors group cursor-pointer" onClick={() => loadScenario(sc)}>
                          <div className="flex flex-col">
                            <span className="font-bold text-[11px] text-slate-800">{sc.name}</span>
                            <span className="text-[9px] text-slate-400 uppercase">{sc.condition}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              {sc.data?.adjusted_price && (
                                <div className="text-[9px] font-bold text-blue-600">
                                  ₫{fmtVND(sc.data.adjusted_price)}
                                </div>
                              )}
                              <div 
                                className="text-[10px] font-mono font-black text-blue-500 hover:underline cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); setViewingScenario(sc); }}
                              >
                                {sc.revenue ? `₫${fmtVND(sc.revenue)}` : 'Chi tiết'}
                              </div>
                            </div>
                            <button 
                              onClick={(e) => { e.stopPropagation(); deleteScenario(sc.id); }}
                              className="p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Node Context Info (Flex 1) */}
                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
                  {selectedNodes.length === 1 ? (
                    <>
                      <div className="p-4 flex flex-col gap-4">
                      {/* Node Info block */}
                      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-lg text-slate-900 line-clamp-1 mr-2">{selectedNodes[0].name}</h3>
                          <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide shrink-0 ${
                            selectedNodes[0].type === 'shop' ? 'bg-blue-100 text-blue-700' : 
                            selectedNodes[0].type === 'product' ? 'bg-orange-100 text-orange-700' : 
                            'bg-red-100 text-red-700'
                          }`}>
                            {selectedNodes[0].type === 'product' ? 'Sản phẩm' : selectedNodes[0].type === 'shop' ? 'Shop' : 'Vùng'}
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-2 gap-x-2 text-sm">
                          {selectedNodes[0].type === 'product' ? (
                          <>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Giá hiện tại</p>
                              <p className="font-mono text-base font-bold text-slate-900">₫{fmtVND(selectedNodes[0].price * (1 - selectedNodes[0].discount))}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Giá gốc</p>
                              <p className="font-mono text-base font-bold text-slate-500 line-through">₫{fmtVND(selectedNodes[0].price)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Khuyến mại</p>
                              <p className="font-mono text-base font-bold text-emerald-600">{(selectedNodes[0].discount * 100).toFixed(0)}%</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Đã bán</p>
                              <p className="font-mono text-base font-bold text-blue-600">{selectedNodes[0].sold.toLocaleString()}</p>
                            </div>
                            <div className="col-span-2 flex justify-between items-center border-t border-slate-100 pt-2 mt-1">
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Doanh thu dự kiến</p>
                              <p className="font-mono text-lg font-black text-emerald-600">₫{fmtVND(Math.floor(selectedNodes[0].revenue))}</p>
                            </div>
                          </>
                        ) : selectedNodes[0].type === 'shop' ? (
                          <>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Tổng Doanh thu</p>
                              <p className="font-mono text-base font-bold text-emerald-600">₫{fmtVND(selectedNodes[0].totalRevenue)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Đánh giá</p>
                              <p className="font-mono text-base font-bold text-slate-900 flex items-center gap-1">
                                {selectedNodes[0].rating} <span className="text-orange-400 text-sm">★</span>
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Số sản phẩm</p>
                              <p className="font-mono text-base font-bold text-blue-600">{selectedNodes[0].productCount}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Giá trung bình</p>
                              <p className="font-mono text-base font-bold text-slate-600">₫{fmtVND(selectedNodes[0].avgPrice)}</p>
                            </div>
                            <div className="col-span-2 pt-2 mt-1 border-t border-slate-100 flex flex-col items-center gap-2">
                              {selectedNodes[0].isMe ? (
                                <>
                                  <span className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-200">
                                    Đây là Cửa hàng của bạn
                                  </span>
                                  <button
                                    onClick={handleUnsetMyShop}
                                    className="text-[10px] font-bold text-slate-400 hover:text-rose-500 underline transition-colors"
                                  >
                                    Hủy chọn Cửa hàng này
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => handleSetMyShop(selectedNodes[0].id)}
                                  className="text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 px-4 py-1.5 rounded shadow-sm transition-colors"
                                >
                                  Đặt làm Cửa hàng của tôi
                                </button>
                              )}
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Tổng Doanh thu</p>
                              <p className="font-mono text-base font-bold text-emerald-600">₫{fmtVND(selectedNodes[0].totalRevenue)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Số Shop</p>
                              <p className="font-mono text-base font-bold text-purple-600">{selectedNodes[0].shopCount}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-0.5">Số Sản phẩm</p>
                              <p className="font-mono text-base font-bold text-blue-600">{selectedNodes[0].productCount}</p>
                            </div>
                          </>
                        )}
                      </div>
                      </div>
                    
                      {/* GNN Intelligence Panel */}
                      {gnnReady && selectedNodes[0].type === 'product' && (() => {
                        const gnn = gnnResultRef.current;
                        const nodeId = selectedNodes[0].id;
                        const competitors = gnn?.competitionScores.get(nodeId) || [];
                        const gnnScore = gnn?.gnnScores.get(nodeId) || 0;
                        const myShopProducts = graphData.products.filter((p: any) => p.shopId === selectedNodes[0].shopId);
                        const cannibalized = gnn ? detectCannibalization(myShopProducts, gnn.embeddings, 0.8).filter(c => c.productA === nodeId || c.productB === nodeId) : [];
                        return (
                          <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden shrink-0">
                            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-2.5 border-b border-indigo-100 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center"><BrainCircuit size={12} /></div>
                                <h4 className="font-bold text-slate-800 text-xs">GNN Intelligence</h4>
                              </div>
                              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Score: {gnnScore}/100</span>
                            </div>
                            <div className="p-3 space-y-2">
                              {/* Competition Radar */}
                              {competitors.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">🎯 Đối thủ cạnh tranh (GNN)</p>
                                  <div className="space-y-1 max-h-24 overflow-y-auto">
                                    {competitors.slice(0, 5).map((comp: any, idx: number) => {
                                      const compProduct = graphData.products.find((p: any) => p.id === comp.targetId);
                                      return (
                                        <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-1 rounded">
                                          <span className="text-slate-700 truncate max-w-[180px]">{compProduct?.name || comp.targetId}</span>
                                          <span className={`font-mono font-bold ${comp.score >= 0.85 ? 'text-red-600' : comp.score >= 0.75 ? 'text-orange-500' : 'text-yellow-600'}`}>
                                            {(comp.score * 100).toFixed(0)}%
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {/* Cannibalization Alert */}
                              {cannibalized.length > 0 && (
                                <div className="bg-rose-50 border border-rose-200 rounded-lg p-2">
                                  <p className="text-[10px] font-bold text-rose-600 uppercase flex items-center gap-1"><AlertTriangle size={10} /> Cảnh báo Cannibalization</p>
                                  {cannibalized.slice(0, 3).map((c: any, idx: number) => {
                                    const otherP = graphData.products.find((p: any) => p.id === (c.productA === nodeId ? c.productB : c.productA));
                                    return (
                                      <p key={idx} className="text-[10px] text-rose-700 mt-0.5">→ {otherP?.name} ({(c.similarity * 100).toFixed(0)}% giống)</p>
                                    );
                                  })}
                                </div>
                              )}
                              {competitors.length === 0 && cannibalized.length === 0 && (
                                <p className="text-[10px] text-slate-400 text-center py-2">Sản phẩm có vị thế cạnh tranh tốt ✅</p>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Simulation & XAI Panel for Single Product */}
                      {selectedNodes[0].type === 'product' && (
                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
                        <div className="bg-blue-50 p-2.5 border-b border-blue-100 flex items-start gap-2 shrink-0">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                            <Activity size={12} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 text-xs">Phân tích Nhu cầu {gnnReady && <span className="text-indigo-500 ml-1">[GNN]</span>}</h4>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Điều chỉnh KM để dự báo doanh thu.</p>
                          </div>
                        </div>
                        
                        <div className="p-3 flex flex-col gap-3 overflow-y-auto flex-1 h-full min-h-0">
                          {/* Demand Forecast Chart */}
                          <div className="h-32 w-full bg-white rounded border border-slate-100 p-1 mb-1">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={generateRevenueCurve(selectedNodes[0])}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="discount" type="number" domain={[0, 60]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                                <YAxis tickFormatter={(v) => fmtVND(v)} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={40} />
                                <Tooltip formatter={(value: number, name: string) => [fmtVND(value), 'Doanh thu']} labelFormatter={(v) => `KM: ${v}%`} contentStyle={{ fontSize: '11px', borderRadius: '8px' }} />
                                <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                                <ReferenceDot x={Math.min(60, Math.floor((selectedNodes[0].originalDiscount + discountChange/100)*100))} y={selectedNodes[0].price * (1 - Math.min(0.6, selectedNodes[0].originalDiscount + discountChange/100)) * Math.max(0, Math.floor(selectedNodes[0].originalSold * (1 + (Math.min(0.6, selectedNodes[0].originalDiscount + discountChange/100) - selectedNodes[0].originalDiscount) * 2)))} r={4} fill="#ef4444" stroke="white" strokeWidth={2} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="flex items-center justify-between text-xs mt-2">
                            <span className="font-bold text-slate-600">Điều chỉnh Giá</span>
                            <span className={`font-mono font-bold ${priceChange > 0 ? "text-rose-500" : priceChange < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                              {priceChange > 0 ? "+" : ""}{priceChange}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-50"
                            max="50"
                            value={priceChange}
                            onChange={(e) => setPriceChange(Number(e.target.value))}
                            className="w-full h-1.5 accent-rose-600 bg-slate-200 rounded-lg appearance-none cursor-pointer mb-2"
                          />

                          <div className="flex items-center justify-between text-xs">
                            <span className="font-bold text-slate-600">Mức Khuyến Mại Thêm</span>
                            <span className={`font-mono font-bold ${discountChange > 0 ? "text-rose-500" : discountChange < 0 ? "text-emerald-600" : "text-slate-500"}`}>
                              {discountChange > 0 ? "+" : ""}{discountChange}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-30"
                            max="30"
                            value={discountChange}
                            onChange={(e) => setDiscountChange(Number(e.target.value))}
                            className="w-full h-1.5 accent-blue-600 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-bold text-slate-600 uppercase flex items-center gap-1"><Save size={10}/> Lưu Kịch Bản</label>
                            <input 
                              type="text" 
                              value={scenarioNameInput}
                              onChange={e => setScenarioNameInput(e.target.value)}
                              className="w-full border border-slate-300 rounded overflow-hidden px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all bg-white"
                              placeholder="VD: Tung siêu sale 50%..."
                            />
                          </div>
                          <button
                            onClick={runSimulation}
                            disabled={isXaiLoading}
                            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 transition-colors shadow-sm shrink-0 disabled:opacity-50"
                          >
                            <Play size={14} /> {isXaiLoading ? "Đang phân tích..." : "Chạy Mô Phỏng"}
                          </button>

                          {(xaiMessage || isXaiLoading) && (
                            <div className="mt-1 text-[11px] p-2 rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white text-indigo-900 leading-tight shadow-inner whitespace-pre-line relative overflow-hidden">
                              <div className="flex items-center gap-1.5 font-bold mb-1 text-indigo-800">
                                <BrainCircuit size={12} className={isXaiLoading ? "animate-pulse" : ""} /> AI Phân Tích
                                {isXaiLoading && <Loader2 size={10} className="animate-spin ml-auto" />}
                              </div>
                              {xaiMessage}
                              {isXaiLoading && !xaiMessage && <div className="h-4 w-full bg-slate-200 animate-pulse rounded mt-1"></div>}
                            </div>
                          )}
                        </div>
                      </div>
                      )}
                      </div>
                    </>
                ) : selectedNodes.length > 1 ? (
                  <div className="h-full">
                    {renderComparisonView()}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
                    <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                      <Network size={32} className="text-slate-300" />
                    </div>
                    <p className="font-medium text-slate-500 text-sm">Click on a node in the graph to view intelligence.</p>
                  </div>
                )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          </div>
          )}

        </main>

    {/* Chatbot Integration */}
      <Chatbot 
        selectedNode={selectedNodes[0] || null} 
        simulationHistory={savedScenarios} 
        graphData={graphData} 
        marketCondition={marketCondition}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="text-center">
          <Loader2 size={40} className="animate-spin mx-auto mb-4" style={{ color: '#30E9CD' }} />
          <p className="text-slate-400 font-medium">Đang kiểm tra phiên đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Dashboard />;
}