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
  Database
} from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import { generateGraphData } from "./graphData";
import type { GraphMetrics, CrawledRow } from "./graphData";
import Chatbot from "./components/Chatbot";
import { AuthProvider, useAuth } from "./lib/auth";
import LoginPage from "./components/LoginPage";
import { supabase } from "./lib/supabase";
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

function Dashboard() {
  const { user, signOut } = useAuth();
  const [dataLoading, setDataLoading] = useState(true);
  const [hasData, setHasData] = useState(true);
  const [runTour, setRunTour] = useState(false);
  const [tourKey, setTourKey] = useState(0);
  
  // Custom Modals & Simulation
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductForm, setNewProductForm] = useState({ name: '', price: 100000, regionId: '' });
  const [discountChange, setDiscountChange] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [xaiMessage, setXaiMessage] = useState<string | null>(null);

  const [graphData, setGraphData] = useState<any>({
    nodes: [],
    links: [],
    products: [],
    shops: [],
    regions: [],
    metrics: { maxProductRevenue: 1, maxShopRevenue: 1, maxRegionRevenue: 1, maxPrice: 1, maxSold: 1 } as GraphMetrics,
  });
  const d3DataRef = useRef<{nodes: any[], links: any[]}>({ nodes: [], links: [] });
  const [selectedNodes, setSelectedNodes] = useState<any[]>([]);
  const [compType, setCompType] = useState<'product' | 'shop' | 'region'>('product');
  const [compMetric, setCompMetric] = useState<string>('revenue');
  
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  
  const graphRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Economic Scenarios & Optimization
  const [marketCondition, setMarketCondition] = useState<'normal' | 'recession' | 'growth'>('normal');
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
  const [scenarioNameInput, setScenarioNameInput] = useState('');

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
    const newData = JSON.parse(JSON.stringify(graphData, (k, v) => (k === 'source' || k === 'target') && v?.id ? v.id : v));

    newData.products.forEach((p: any) => {
      // Xác định phân khúc dựa trên giá
      const isCheap = p.originalPrice <= 250000;
      const isPremium = p.originalPrice >= 1000000;

      if (cond === 'normal') {
        p.sold = p.originalSold;
        p.price = p.originalPrice;
        p.discount = p.originalDiscount;
      } else if (cond === 'growth') {
        // Growth: Premiumization bùng nổ, tăng giá không mất nhiều khách
        p.sold = isPremium ? Math.floor(p.originalSold * 1.5) : Math.floor(p.originalSold * 1.2);
        p.price = isPremium ? Math.floor(p.originalPrice * 1.15) : Math.floor(p.originalPrice * 1.05);
        p.discount = Math.max(0, p.originalDiscount * 0.8);
      } else {
        // Recession: Khách thắt chặt chi tiêu. Phân khúc tầm trung chịu ảnh hưởng nặng nhất. Giày giá rẻ (clogs) ổn định.
        if (isCheap) {
          p.sold = Math.floor(p.originalSold * 1.1); // Value-for-money phát triển
          p.price = p.originalPrice; // Cố gắng giữ nguyên giá
        } else if (isPremium) {
          p.sold = Math.floor(p.originalSold * 0.7); // Lipstick effect - vẫn có người mua nhưng giảm
          p.price = Math.floor(p.originalPrice * 0.95);
        } else {
          p.sold = Math.floor(p.originalSold * 0.5); // Mid-tier rớt mạnh nhất (Trade down)
          p.price = Math.floor(p.originalPrice * 0.85);
        }
        p.discount = Math.min(0.7, p.originalDiscount * 1.5); // Tăng cường khuyến mãi sâu
      }
      p.revenue = p.price * (1 - p.discount) * p.sold;
      p.vx = (Math.random() - 0.5) * 200;
      p.vy = (Math.random() - 0.5) * 200;
    });

    recalcAggregates(newData);
    setGraphData(newData);
    setXaiMessage(`Chuyển sang nền kinh tế: ${cond === 'normal' ? 'Bình thường' : cond === 'recession' ? 'Suy thoái' : 'Tăng trưởng'}. Doanh thu thị trường đã thay đổi.`);
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
    
    setXaiMessage(`✅ Đã tối ưu ${changesCount} sản phẩm.\n💡 Chiến lược: ${strategyDesc}\n📈 Doanh thu thay đổi: ${totalGain >= 0 ? '+' : ''}₫${fmtVND(Math.floor(totalGain))}`);
    
    setTimeout(() => graphRef.current?.d3ReheatSimulation(), 100);
    
    const myUpdated = newData.shops.find((s: any) => s.isMe);
    saveScenarioByName(scenarioNameInput || "Auto Optimize", myUpdated?.totalRevenue);
  };

  const resetSimulation = () => {
    if (initialData) {
      const parsed = JSON.parse(JSON.stringify(initialData));
      setGraphData(parsed);
      setMarketCondition('normal');
      setDiscountChange(0);
      setPriceChange(0);
      setXaiMessage("Đồ thị đã được khôi phục về trạng thái gốc.");
      setTimeout(() => graphRef.current?.d3ReheatSimulation(), 100);
    }
  };

  const saveScenarioByName = (customName?: any, newRevenue?: number) => {
    let nameToSave = typeof customName === 'string' && customName.trim() ? customName : scenarioNameInput;
    if (!nameToSave || !nameToSave.trim()) return;
    
    const myShop = graphData.shops.find((s: any) => s.isMe);
    const revenueToSave = newRevenue !== undefined ? newRevenue : (myShop?.totalRevenue || 0);

    setSavedScenarios(prev => [...prev, {
      id: Date.now(),
      name: nameToSave.trim(),
      condition: marketCondition,
      revenue: revenueToSave,
    }]);

    if (typeof customName !== 'string') setScenarioNameInput('');
  };

  const saveScenario = () => saveScenarioByName();

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
    { target: '.graph-container', content: 'Đồ thị hiển thị mối quan hệ giữa Vùng, Shop và Sản phẩm. Node lớn = doanh thu cao.', disableBeacon: true },
    { target: '.network-legend', content: 'Bảng chú giải: Vùng (đỏ), Shop của bạn (tím), Đối thủ (xanh), Sản phẩm (cam).' },
    { target: '.add-product-btn', content: 'Thêm sản phẩm mới vào shop của bạn.' },
    { target: '.compare-mode-toggle', content: 'Bật Compare Mode để chọn nhiều node và so sánh.' },
    { target: '.intelligence-dashboard', content: 'Panel phân tích: xem chi tiết, điều chỉnh KM, dự báo doanh thu.' },
    { target: '.chatbot-btn', content: 'Trợ lý AI - hỏi đáp về dữ liệu và chiến lược.' }
  ];

  const [initialData, setInitialData] = useState<any>(null);

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
      const rawData = generateGraphData(rows);
      setGraphData(rawData);
      setInitialData(JSON.parse(JSON.stringify(rawData)));
      d3DataRef.current = { nodes: [...rawData.nodes], links: [...rawData.links] };
      setHasData(true);
    };

    const loadData = async () => {
      setHasData(false);
      setDataLoading(true);

      try {
        // Lấy thông tin profile để có display_name
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single();

        const displayName = profile?.display_name || user.email;
        console.log(`App: Đang tải dữ liệu cho ${displayName}...`);
        
        let { data: rows, error } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user.id);

        if (error) {
          console.error('App: Lỗi fetch data:', error);
          setHasData(false);
        } else if (rows && rows.length > 0) {
          console.log(`App: Thành công! Tìm thấy ${rows.length} bản ghi của ${displayName}`);
          loadGraph(mapRows(rows));
          setHasData(true);
        } else {
          console.log(`App: Không tìm thấy dữ liệu cho ${displayName} (ID: ${user.id})`);
          setHasData(false);
        }
      } catch (err) {
        console.error('App: Exception trong loadData:', err);
        setHasData(false);
      } finally {
        setDataLoading(false);
      }
    };

    loadData();

    const isTutorialCompleted = localStorage.getItem('retailAiTutorialCompleted');
    if (!isTutorialCompleted) {
      const tourTimer = setTimeout(() => setRunTour(true), 1000);
      return () => clearTimeout(tourTimer);
    }
  }, [user?.id, supabase]);

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
    const measure = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDimensions({ width: rect.width, height: rect.height });
        // Force graph re-center on resize
        if (graphRef.current) {
          graphRef.current.centerAt(0, 0, 400);
        }
      }
    };
    
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(measure);
    });
    
    observer.observe(containerRef.current);
    measure(); // Immediate measure
    
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (graphRef.current) {
        graphRef.current.d3Force('charge').strength(-300);
        const m = graphData.metrics;
        graphRef.current.d3Force('link').distance((link: any) => {
          if (link.type === 'located_in') return 200;
          if (link.type === 'sells') {
            const prod = graphData.products.find((p: any) => p.id === (typeof link.target === 'object' ? link.target.id : link.target));
            const revRatio = prod ? prod.revenue / m.maxProductRevenue : 0.5;
            return 80 + (1 - revRatio) * 80;
          }
          if (link.type === 'competes_with') {
            const srcId = typeof link.source === 'object' ? link.source.id : link.source;
            const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
            const a = graphData.products.find((p: any) => p.id === srcId);
            const b = graphData.products.find((p: any) => p.id === tgtId);
            if (a && b) {
              const diff = Math.abs(a.price - b.price);
              const avg = (a.price + b.price) / 2 || 1;
              return 60 + (diff / avg) * 200;
            }
            return 160;
          }
          return 120;
        });
        graphRef.current.d3ReheatSimulation();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [graphData]);

  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const label = node.name;
    const fontSize = Math.max(12 / globalScale, 2);
    ctx.font = `600 ${fontSize}px Inter, sans-serif`;
    const m = graphData.metrics;

    const isPrimarySelected = selectedNodes.some(n => n.id === node.id);
    let isSecondarySelected = false;
    let isDimmed = false;

    if (selectedNodes.length > 0) {
      if (selectedNodes[0].type === 'shop') {
        const shopProducts = graphData.products.filter((p: any) => p.shopId === selectedNodes[0].id);
        const shopRegions = shopProducts.map((p: any) => p.regionId);
        if (node.type === 'product' && shopProducts.some((p: any) => p.id === node.id)) {
          isSecondarySelected = true;
        } else if (node.type === 'region' && shopRegions.includes(node.id)) {
          isSecondarySelected = true;
        } else if (!isPrimarySelected) {
          isDimmed = true;
        }
      } else if (selectedNodes[0].type === 'region') {
        const regionProducts = graphData.products.filter((p: any) => p.regionId === selectedNodes[0].id);
        const regionShops = [...new Set(regionProducts.map((p: any) => p.shopId))];
        if (node.type === 'product' && regionProducts.some((p: any) => p.id === node.id)) {
          isSecondarySelected = true;
        } else if (node.type === 'shop' && regionShops.includes(node.id)) {
          isSecondarySelected = true;
        } else if (!isPrimarySelected) {
          isDimmed = true;
        }
      } else {
        const selProds = selectedNodes.filter(n => n.type === 'product');
        if (node.type === 'shop' && selProds.some((sp: any) => sp.shopId === node.id)) {
          isSecondarySelected = true;
        } else if (node.type === 'region' && selProds.some((sp: any) => sp.regionId === node.id)) {
          isSecondarySelected = true;
        } else if (!isPrimarySelected) {
          isDimmed = true;
        }
      }
    }

    // Revenue-based sizing
    let nodeR = 10;
    if (node.type === 'product') {
      nodeR = 6 + Math.sqrt(node.revenue / m.maxProductRevenue) * 16;
    } else if (node.type === 'shop') {
      nodeR = 10 + Math.sqrt((node.totalRevenue || 0) / m.maxShopRevenue) * 14;
    } else if (node.type === 'region') {
      nodeR = 14 + Math.sqrt((node.totalRevenue || 0) / m.maxRegionRevenue) * 12;
    }

    const radius = isPrimarySelected ? nodeR + 4 : isSecondarySelected ? nodeR + 2 : nodeR;
    const fillStyle = node.type === 'region' ? '#0d9488' : node.type === 'shop' ? (node.isMe ? '#1de5e2' : '#2d3748') : '#1de5e2';
    
    ctx.globalAlpha = isDimmed ? 0.15 : 1;

    if (isPrimarySelected) { ctx.shadowColor = '#1de5e2'; ctx.shadowBlur = 20 / globalScale; }
    else if (isSecondarySelected) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 15 / globalScale; }
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
    if (globalScale > 1.2 || isPrimarySelected || isSecondarySelected) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const truncLabel = label.length > 20 ? label.substring(0, 18) + '...' : label;
      const textWidth = ctx.measureText(truncLabel).width;
      const bckgDimensions = [textWidth + fontSize * 0.4, fontSize * 1.2];
      
      ctx.fillStyle = `rgba(255,255,255,${isDimmed ? 0.4 : 0.85})`;
      ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + radius + 2 / globalScale, bckgDimensions[0], bckgDimensions[1]);
      ctx.fillStyle = isPrimarySelected ? '#0f172a' : isSecondarySelected ? '#b45309' : '#475569';
      ctx.fillText(truncLabel, node.x, node.y + radius + 2 / globalScale + fontSize * 0.1);

      // Stats on deep zoom
      if (globalScale > 2.0) {
        const statsFontSize = fontSize * 0.75;
        ctx.font = `500 ${statsFontSize}px Inter, sans-serif`;
        let statsText = '';
        if (node.type === 'product') statsText = `₫${(node.price/1000).toFixed(0)}K | ${(node.sold).toLocaleString()} sold`;
        else if (node.type === 'shop') statsText = `₫${(node.totalRevenue/1e9).toFixed(1)}B rev`;
        else if (node.type === 'region') statsText = `₫${(node.totalRevenue/1e9).toFixed(1)}B total`;
        
        if (statsText) {
          const sw = ctx.measureText(statsText).width;
          ctx.fillStyle = `rgba(255,255,255,0.85)`;
          ctx.fillRect(node.x - sw / 2 - 2, node.y + radius + 2 / globalScale + bckgDimensions[1], sw + 4, statsFontSize * 1.2);
          ctx.fillStyle = '#6366f1';
          ctx.fillText(statsText, node.x, node.y + radius + 2 / globalScale + bckgDimensions[1] + statsFontSize * 0.1);
        }
      }
    }
    ctx.globalAlpha = 1;
  }, [selectedNodes, graphData.metrics]);

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
  };

  const runSimulation = () => {
    const primaryNode = selectedNodes[0];
    if (!primaryNode || primaryNode.type !== "product") return;

    const isCheap = primaryNode.originalPrice <= 250000;
    const isPremium = primaryNode.originalPrice >= 1000000;

    let priceElasticity = 1.5;
    let discountBoostMult = 2.0;

    if (marketCondition === 'recession') {
      priceElasticity = 2.5; // Nhạy cảm về giá cực cao
      discountBoostMult = 3.0; // KM kích cầu mạnh
    } else if (marketCondition === 'growth') {
      priceElasticity = 0.5; // Ít nhạy cảm về giá (inflation-plus)
      discountBoostMult = 1.2; // KM không kích cầu bùng nổ bằng
    }

    const newDiscount = Math.min(0.7, Math.max(0, primaryNode.originalDiscount + discountChange / 100));
    const newPrice = Math.max(1000, primaryNode.originalPrice * (1 + priceChange / 100));

    // Hiệu ứng ăn thịt đồng loại (Cannibalization) & Cạnh tranh
    const priceEffect = Math.max(0.1, 1 - (priceChange / 100) * priceElasticity);
    const discountEffect = 1 + (newDiscount - primaryNode.originalDiscount) * discountBoostMult;

    const newSold = Math.max(0, Math.floor(primaryNode.originalSold * priceEffect * discountEffect));
    const actualPrice = newPrice * (1 - newDiscount);
    const newRevenue = actualPrice * newSold;

    const newData = JSON.parse(JSON.stringify(graphData, (k, v) => (k === 'source' || k === 'target') && v?.id ? v.id : v));
    
    newData.products.forEach((p: any) => {
      if (p.id === primaryNode.id) {
        p.discount = newDiscount;
        p.price = newPrice;
        p.sold = newSold;
        p.revenue = newRevenue;
        p.vx = (Math.random() - 0.5) * 200;
        p.vy = (Math.random() - 0.5) * 200;
      } else {
        // Nếu sp chính giảm giá/tăng KM, đối thủ cùng vùng bị hút khách
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
    saveScenarioByName(`KM ${primaryNode.name.substring(0,20)}: ${(newDiscount*100).toFixed(0)}%`, myShop?.totalRevenue);

    if (discountChange !== 0 || priceChange !== 0) {
      setXaiMessage(`Bối cảnh ${marketCondition.toUpperCase()}: Điều chỉnh giá ${priceChange}% và KM ${discountChange}%. Lượng bán: ${newSold.toLocaleString()}. Doanh thu: ₫${fmtVND(Math.floor(newRevenue))}.`);
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
    saveScenarioByName(scenarioNameInput || "Tung SP mới: " + newProductForm.name);
  };

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      setRunTour(false);
      localStorage.setItem('retailAiTutorialCompleted', 'true');
    }
  };

  if (dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }}>
        <div className="text-center">
          <Loader2 size={40} className="animate-spin mx-auto mb-4" style={{ color: '#30E9CD' }} />
          <p className="text-slate-400 font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)' }}>
        <div className="text-center max-w-md mx-4">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'rgba(29, 229, 226, 0.1)' }}>
            <Database size={36} style={{ color: '#1de5e2' }} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Chưa có dữ liệu</h2>
          <p className="text-slate-400 mb-6 leading-relaxed">
            Tài khoản của bạn chưa có dữ liệu crawl. Hãy sử dụng Extension trình duyệt để crawl dữ liệu từ các cửa hàng bạn muốn phân tích.
          </p>
          <button
            onClick={signOut}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-[#1de5e2] border border-[#1de5e2]/20 hover:bg-[#1de5e2]/10 transition-colors cursor-pointer"
          >
            <LogOut size={14} className="inline mr-2" />
            Đăng xuất
          </button>
        </div>
      </div>
    );

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
            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
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
                <div className="text-[9px] text-slate-400 mt-1 italic">Node lớn = doanh thu cao</div>
              </div>
            </div>

            <div className="absolute inset-0 cursor-crosshair bg-[#f8fafc]">
              <ErrorBoundary>
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
                  linkDirectionalParticles={(link: any) => link.type === 'sells' ? 3 : 0}
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
                />
              </ErrorBoundary>
            </div>
          </div>

          {/* Right Panel: Controls & Metrics */}
          <div className="w-[380px] bg-slate-50 flex flex-col shadow-[-4px_0_24px_-12px_rgba(0,0,0,0.1)] z-10 shrink-0 intelligence-dashboard">
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
                  <button onClick={optimizeMyProfit} className="text-[10px] uppercase font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 py-1.5 px-2 rounded flex items-center gap-1 transition-colors">
                    <BrainCircuit size={12}/> Auto Optimize
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
                <div className="mt-2 flex flex-col gap-1 max-h-24 overflow-y-auto pr-1 border-t border-slate-100 pt-2">
                  {savedScenarios.map((sc) => (
                    <div key={sc.id} className="flex justify-between items-center bg-white/60 p-2 mb-1 rounded border border-slate-200">
                      <div className="flex flex-col">
                        <span className="font-bold text-[11px]">{sc.name}</span>
                        <span className="text-[9px] text-slate-400 uppercase">{sc.condition}</span>
                      </div>
                      <div className="text-right">
                        {/* Dòng 1: Hiện giá (Con số nhỏ) */}
                        {sc.price && (
                          <div className="text-[10px] font-bold text-blue-600">
                            Giá: ₫{fmtVND(sc.price)}
                          </div>
                        )}
                        {/* Dòng 2: Hiện lợi nhuận (Con số lớn) */}
                        <div className="text-[11px] font-mono font-black text-slate-800">
                          DT: ₫{sc.revenue ? fmtVND(sc.revenue) : '0'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Node Context Info (Flex 1) */}
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
              {selectedNodes.length === 1 ? (
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

                {/* Simulation & XAI Panel for Single Product */}
                  <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
                    <div className="bg-blue-50 p-2.5 border-b border-blue-100 flex items-start gap-2 shrink-0">
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <Activity size={12} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">Phân tích Nhu cầu</h4>
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
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 transition-colors shadow-sm shrink-0"
                      >
                        <Play size={14} /> Chạy Mô Phỏng
                      </button>

                      {xaiMessage && (
                        <div className="mt-1 text-[11px] p-2 rounded-lg border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white text-indigo-900 leading-tight shadow-inner whitespace-pre-line">
                          <div className="flex items-center gap-1.5 font-bold mb-1 text-indigo-800">
                            <BrainCircuit size={12} /> AI Phân Tích
                          </div>
                          {xaiMessage}
                        </div>
                      )}
                    </div>
                  </div>
              </div>
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
        </div>
      </div>
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