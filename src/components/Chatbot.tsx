import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, GripHorizontal, History, Plus, MessageCircle, TrendingUp, ShoppingBag, BarChart3, Zap, Target, DollarSign } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { motion, useDragControls, AnimatePresence, useMotionValue } from 'motion/react';
import { supabase } from '../lib/supabase';
import { SYSTEM_PROMPT } from '../lib/prompt';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ChatSession {
  id: string;
  title: string;
  created_at: string;
}

interface ChatbotProps {
  selectedNode: any;
  simulationHistory: any[];
  graphData: any;
  marketCondition?: 'normal' | 'recession' | 'growth';
}

const QUICK_ACTIONS = [
  { icon: '💰', label: 'SP giá cao nhất', query: 'Sản phẩm nào có giá cao nhất? Phân tích chi tiết.' },
  { icon: '🔥', label: 'Top bán chạy', query: 'Top 5 sản phẩm bán chạy nhất là gì? Tại sao chúng bán tốt?' },
  { icon: '📊', label: 'Tổng quan thị trường', query: 'Tổng quan thị trường hiện tại: doanh thu, phân khúc giá, và xu hướng chính.' },
  { icon: '🏪', label: 'So sánh Shop', query: 'So sánh doanh thu và hiệu suất giữa các Shop. Shop nào đang dẫn đầu?' },
  { icon: '🏷️', label: 'Chiến lược KM', query: 'Phân tích chiến lược khuyến mãi: sản phẩm nào đang giảm giá mạnh và hiệu quả ra sao?' },
  { icon: '🎯', label: 'Tư vấn chiến lược', query: 'Dựa trên dữ liệu hiện tại, đề xuất 3 chiến lược giá và khuyến mãi tối ưu cho shop của tôi.' },
];

export default function Chatbot({ selectedNode, simulationHistory, graphData, marketCondition = 'normal' }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const isDraggingBtn = useRef(false);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Calculate constraints based on viewport
  const [constraints, setConstraints] = useState({ left: 0, right: 0, top: 0, bottom: 0 });

  useEffect(() => {
    const updateConstraints = () => {
      // Chat window is 420x650. Margins are 24px (bottom-6, right-6)
      // Initial position is bottom-right corner.
      // Dragging left = negative x. Max left = window width - window width offset.
      setConstraints({
        left: -(window.innerWidth - 420 - 48), // 48 is total margin (24 left + 24 right)
        right: 0,
        top: -(window.innerHeight - 650 - 48),
        bottom: 0,
      });
    };

    updateConstraints();
    window.addEventListener('resize', updateConstraints);
    return () => window.removeEventListener('resize', updateConstraints);
  }, []);

  // Initialize Gemini
  const ai = useMemo(() => {
    try {
      // Thử đọc từ nhiều nguồn để đảm bảo nhận được Key
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY ||
        (window as any).process?.env?.VITE_GEMINI_API_KEY ||
        '';

      if (!apiKey || apiKey === '') {
        console.warn('Chatbot: Gemini API Key is missing in environment variables.');
        return null;
      }

      return new GoogleGenAI({ apiKey: apiKey });
    } catch (err) {
      console.error('Chatbot: Failed to initialize Gemini AI:', err);
      return null;
    }
  }, []);

  const chatRef = useRef<any>(null);

  // Build rich data context from graphData for AI
  const buildDataContext = (userQuery: string): string => {
    const products = graphData?.products || [];
    const shops = graphData?.shops || [];
    const regions = graphData?.regions || [];
    const metrics = graphData?.metrics || {};

    if (products.length === 0) {
      return '[CẢNH BÁO: Không có dữ liệu sản phẩm trong hệ thống]';
    }

    // Sort helpers
    const byPriceDesc = [...products].sort((a: any, b: any) => b.price - a.price);
    const byRevenueDesc = [...products].sort((a: any, b: any) => b.revenue - a.revenue);
    const bySoldDesc = [...products].sort((a: any, b: any) => b.sold - a.sold);
    const byDiscountDesc = [...products].sort((a: any, b: any) => b.discount - a.discount);
    const shopsByRevenue = [...shops].sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);
    const regionsByRevenue = [...regions].sort((a: any, b: any) => b.totalRevenue - a.totalRevenue);

    // Format product for context (compact)
    const fmtProduct = (p: any) => `${p.name} | Giá: ${p.price.toLocaleString()}đ | KM: ${(p.discount * 100).toFixed(0)}% | Đã bán: ${p.sold.toLocaleString()} | DT: ${Math.floor(p.revenue).toLocaleString()}đ | Shop: ${p.shopId.replace('shop-', '')}`;
    const fmtShop = (s: any) => `${s.name} | SP: ${s.productCount} | DT: ${s.totalRevenue.toLocaleString()}đ | Giá TB: ${s.avgPrice.toLocaleString()}đ | ⭐ ${s.rating}`;
    const fmtRegion = (r: any) => `${r.name} | Shops: ${r.shopCount} | SP: ${r.productCount} | DT: ${r.totalRevenue.toLocaleString()}đ`;

    // Price segments
    const cheapProducts = products.filter((p: any) => p.price < 200000);
    const midProducts = products.filter((p: any) => p.price >= 200000 && p.price < 500000);
    const premiumProducts = products.filter((p: any) => p.price >= 500000);

    // Avg price, avg discount
    const avgPrice = products.reduce((s: number, p: any) => s + p.price, 0) / products.length;
    const avgDiscount = products.reduce((s: number, p: any) => s + p.discount, 0) / products.length;
    const totalRevenue = products.reduce((s: number, p: any) => s + p.revenue, 0);

    return `
=== DỮ LIỆU BÁN LẺ THỰC TẾ TỪ DATABASE ===

📊 TỔNG QUAN THỊ TRƯỜNG:
- Tổng sản phẩm: ${products.length}
- Tổng shops: ${shops.length}
- Tổng vùng: ${regions.length}
- Tổng doanh thu: ${Math.floor(totalRevenue).toLocaleString()}đ
- Giá trung bình: ${Math.floor(avgPrice).toLocaleString()}đ
- Khuyến mãi trung bình: ${(avgDiscount * 100).toFixed(1)}%
- Phân khúc: Rẻ(<200k): ${cheapProducts.length} SP | Trung(200-500k): ${midProducts.length} SP | Cao cấp(>500k): ${premiumProducts.length} SP

🏆 TOP 10 SẢN PHẨM DOANH THU CAO NHẤT:
${byRevenueDesc.slice(0, 10).map((p: any, i: number) => `${i + 1}. ${fmtProduct(p)}`).join('\n')}

💰 TOP 10 SẢN PHẨM GIÁ CAO NHẤT:
${byPriceDesc.slice(0, 10).map((p: any, i: number) => `${i + 1}. ${fmtProduct(p)}`).join('\n')}

🔥 TOP 10 SẢN PHẨM BÁN CHẠY NHẤT:
${bySoldDesc.slice(0, 10).map((p: any, i: number) => `${i + 1}. ${fmtProduct(p)}`).join('\n')}

🏷️ TOP 5 KHUYẾN MÃI CAO NHẤT:
${byDiscountDesc.slice(0, 5).map((p: any, i: number) => `${i + 1}. ${fmtProduct(p)}`).join('\n')}

🏪 BẢNG XẾP HẠNG SHOP (theo doanh thu):
${shopsByRevenue.map((s: any, i: number) => `${i + 1}. ${fmtShop(s)}`).join('\n')}

🌍 BẢNG XẾP HẠNG VÙNG (theo doanh thu):
${regionsByRevenue.map((r: any, i: number) => `${i + 1}. ${fmtRegion(r)}`).join('\n')}

📌 NODE ĐANG CHỌN:
${selectedNode ? JSON.stringify({
  name: selectedNode.name,
  type: selectedNode.type,
  price: selectedNode.price,
  revenue: selectedNode.revenue,
  sold: selectedNode.sold,
  discount: selectedNode.discount,
  rating: selectedNode.rating,
  shopId: selectedNode.shopId,
  regionId: selectedNode.regionId
}, null, 2) : 'Chưa chọn node nào'}

🕐 LỊCH SỬ GIẢ LẬP GẦN ĐÂY: ${simulationHistory.length > 0 ? JSON.stringify(simulationHistory.slice(-3)) : 'Chưa có'}
🌐 TRẠNG THÁI THỊ TRƯỜNG: ${marketCondition.toUpperCase()}

=== HẾT DỮ LIỆU ===

Câu hỏi của người dùng: ${userQuery}
`;
  };

  // Load sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSessions(data || []);

      if (data && data.length > 0 && !currentSessionId) {
        loadSession(data[0].id);
      } else if (!data || data.length === 0) {
        createNewSession();
      }
    } catch (err) {
      console.warn('Supabase not ready or tables missing. Switching to local-only mode.', err);
      // Fallback: Create a fake local session ID to allow chatting
      setCurrentSessionId('local-session');
      setMessages([{ role: 'model', text: '⚠️ **Lưu ý:** Không thể kết nối Supabase (có thể do chưa tạo bảng). Tin nhắn sẽ không được lưu lại, nhưng bạn vẫn có thể chat bình thường!' }]);
      setIsInitializing(false);
    }
  };

  const createNewSession = async () => {
    try {
      const title = `Chat ${new Date().toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`;
      const { data, error } = await supabase
        .from('chat_sessions')
        .insert([{ title }])
        .select()
        .single();

      if (error) throw error;
      setSessions(prev => [data, ...prev]);
      setCurrentSessionId(data.id);
      setMessages([{ role: 'model', text: 'Xin chào! Tôi là **Graph Retail AI**. Tôi đã sẵn sàng hỗ trợ bạn phân tích dữ liệu đồ thị và chiến lược bán lẻ. Bạn muốn hỏi gì về giá, khuyến mãi hay biến động thị trường?' }]);
    } catch (err) {
      console.error('Error creating session:', err);
      setCurrentSessionId('local-session');
    } finally {
      setIsInitializing(false);
    }
  };

  const loadSession = async (sessionId: string) => {
    if (sessionId === 'local-session') return;
    try {
      setCurrentSessionId(sessionId);
      setIsLoading(true);

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      // ... (rest of loadSession)

      if (data && data.length > 0) {
        const formattedMessages = data.map(m => ({
          role: m.role as 'user' | 'model',
          text: m.content
        }));
        setMessages(formattedMessages);

        // Initialize Gemini chat with history
        if (ai) {
          chatRef.current = ai.chats.create({
            model: "gemini-2.5-flash",
            config: {
              systemInstruction: SYSTEM_PROMPT,
              history: formattedMessages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
              })),
            }
          });
        }
      } else {
        setMessages([{ role: 'model', text: 'Xin chào! Tôi là **Graph Retail AI**. Tôi đã sẵn sàng hỗ trợ bạn phân tích dữ liệu đồ thị và chiến lược bán lẻ. Bạn muốn hỏi gì về giá, khuyến mãi hay biến động thị trường?' }]);
      }

      setShowHistory(false);
    } catch (err) {
      console.error('Error loading session:', err);
    } finally {
      setIsLoading(false);
      setIsInitializing(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleQuickAction = (query: string) => {
    if (isLoading || !currentSessionId) return;
    setInput(query);
    // Use setTimeout to ensure state updates before sending
    setTimeout(() => {
      const fakeEvent = { trim: () => query };
      sendMessage(query);
    }, 50);
  };

  const sendMessage = async (overrideText?: string) => {
    const text = overrideText || input.trim();
    if (!text || isLoading || !currentSessionId) return;

    if (!ai) {
      setMessages(prev => [...prev, { role: 'user', text }, { role: 'model', text: '❌ **Lỗi:** Chưa cấu hình Gemini API Key.' }]);
      return;
    }

    const userText = text;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      // 1. Save user message to Supabase (if not local)
      if (currentSessionId !== 'local-session') {
        await supabase.from('chat_messages').insert([{
          session_id: currentSessionId,
          role: 'user',
          content: userText
        }]);
      }

      // 2. Prepare rich context from actual data
      const contextString = buildDataContext(userText);

      // 3. Initialize chat if needed
      if (!chatRef.current) {
        chatRef.current = ai.chats.create({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: SYSTEM_PROMPT,
            history: messages.map(m => ({
              role: m.role,
              parts: [{ text: m.text }]
            }))
          }
        });
      }

      // 4. Get response from Gemini
      const result = await chatRef.current.sendMessage({ message: contextString });
      const aiText = result.text;

      // 5. Save AI response to Supabase (if not local)
      if (currentSessionId !== 'local-session') {
        await supabase.from('chat_messages').insert([{
          session_id: currentSessionId,
          role: 'model',
          content: aiText
        }]);
      }

      setMessages(prev => [...prev, { role: 'model', text: aiText }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'model', text: "Rất tiếc, tôi gặp lỗi khi xử lý yêu cầu của bạn. Vui lòng thử lại sau." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = () => sendMessage();

  return (
    <>
      <motion.button
        drag
        dragConstraints={{
          left: -(window.innerWidth - 64 - 48), // Button is approx 64x64
          right: 0,
          top: -(window.innerHeight - 64 - 48),
          bottom: 0
        }}
        dragElastic={0}
        dragMomentum={false}
        whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
        onDragStart={() => { isDraggingBtn.current = true; }}
        onDragEnd={() => { setTimeout(() => { isDraggingBtn.current = false; }, 150); }}
        onClick={() => { if (!isDraggingBtn.current) setIsOpen(true); }}
        className="chatbot-btn fixed bottom-6 right-6 p-4 bg-[#1de5e2] text-slate-900 rounded-full shadow-xl hover:shadow-[#1de5e2]/30 cursor-grab z-50 border-2 border-white/50"
        style={{ x, y, opacity: isOpen ? 0 : 1, pointerEvents: isOpen ? 'none' : 'auto' }}
      >
        <Sparkles size={24} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragConstraints={constraints}
            dragElastic={0}
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-6 right-6 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden"
            style={{ x, y, width: '420px', height: '650px', touchAction: 'none' }}
          >
            {/* Header */}
            <div
              className="p-4 bg-[#2d3748] text-white flex items-center justify-between shadow-md z-10 cursor-grab active:cursor-grabbing relative border-b border-white/10"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-40">
                <GripHorizontal size={16} />
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-base leading-tight">Graph Retail AI</h3>
                  <p className="text-[#1de5e2] text-[10px] font-bold tracking-wide uppercase">Chiến lược & Phân tích</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-2 rounded-lg transition-colors ${showHistory ? 'bg-white/20 text-[#1de5e2]' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
                  title="Lịch sử trò chuyện"
                >
                  <History size={18} />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden relative flex flex-col bg-slate-50">
              {/* History Panel */}
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'tween', duration: 0.2 }}
                    className="absolute inset-0 z-20 bg-white border-r border-slate-100 flex flex-col"
                  >
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        <History size={16} className="text-[#0d9488]" /> Lịch sử
                      </h4>
                      <button
                        onClick={createNewSession}
                        className="p-1.5 bg-[#1de5e2]/10 text-[#0d9488] rounded-md hover:bg-[#1de5e2]/20 transition-colors"
                        title="Cuộc trò chuyện mới"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                      {sessions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => loadSession(s.id)}
                          className={`w-full text-left p-3 rounded-xl transition-all flex flex-col gap-1 ${currentSessionId === s.id ? 'bg-[#1de5e2]/5 border border-[#1de5e2]/20 shadow-sm' : 'hover:bg-slate-50 border border-transparent'}`}
                        >
                          <span className={`text-sm font-semibold ${currentSessionId === s.id ? 'text-[#0d9488]' : 'text-slate-700'}`}>{s.title}</span>
                          <span className="text-[10px] text-slate-400">{new Date(s.created_at).toLocaleDateString('vi-VN')}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scroll-smooth">
                {isInitializing ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
                    <Loader2 className="animate-spin" size={32} />
                    <p className="text-sm font-medium">Đang kết nối dữ liệu...</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, idx) => (
                      <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-gradient-to-br from-[#1de5e2] to-[#0d9488] text-slate-900 font-bold'}`}>
                          {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`px-4 py-2.5 rounded-2xl max-w-[85%] text-sm shadow-sm ${msg.role === 'user' ? 'bg-[#2d3748] text-white rounded-tr-none border border-white/5' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                          <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                            <Markdown>{msg.text}</Markdown>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Quick Action Buttons - show only on welcome screen */}
                    {messages.length <= 1 && !isLoading && (
                      <div className="mt-2 flex flex-col gap-2">
                        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-1">Gợi ý nhanh</p>
                        <div className="grid grid-cols-2 gap-2">
                          {QUICK_ACTIONS.map((action, idx) => (
                            <motion.button
                              key={idx}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.06, duration: 0.25 }}
                              onClick={() => handleQuickAction(action.query)}
                              disabled={isLoading || isInitializing}
                              className="group flex items-center gap-2.5 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-left hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md transition-all duration-200 disabled:opacity-50 active:scale-[0.97]"
                            >
                              <span className="text-lg shrink-0 group-hover:scale-110 transition-transform">{action.icon}</span>
                              <span className="text-xs font-semibold text-slate-600 group-hover:text-blue-700 transition-colors leading-tight">{action.label}</span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isLoading && (
                      <div className="flex gap-3 flex-row">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1de5e2] to-[#0d9488] text-slate-900 flex items-center justify-center shrink-0 shadow-sm">
                          <Bot size={16} />
                        </div>
                        <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 rounded-tl-none flex items-center gap-3 shadow-sm">
                          <Loader2 size={16} className="animate-spin text-[#0d9488]" />
                          <span className="text-xs font-semibold text-slate-500 animate-pulse">Đang phân tích dữ liệu thị trường...</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_10px_rgba(0,0,0,0.03)]">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 focus-within:border-[#1de5e2] focus-within:ring-4 focus-within:ring-[#1de5e2]/10 transition-all">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Hỏi về chiến lược giá, KM..."
                    className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm text-slate-800 placeholder-slate-400"
                    disabled={isLoading || isInitializing}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading || isInitializing}
                    className="p-2.5 bg-[#1de5e2] text-slate-900 font-bold rounded-lg hover:bg-[#34e0c5] disabled:opacity-50 transition-all shadow-md active:scale-95"
                  >
                    <Send size={16} />
                  </button>
                </div>
                <p className="mt-2 text-[10px] text-center text-slate-400 font-medium">Powered by Graph Retail Intelligence AI</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
