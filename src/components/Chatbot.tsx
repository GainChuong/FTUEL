import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, GripHorizontal } from 'lucide-react';
import { GoogleGenAI } from '@google/genai/web';
import Markdown from 'react-markdown';
import { motion, useDragControls, AnimatePresence, useMotionValue } from 'motion/react';

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface ChatbotProps {
  selectedNode: any;
  simulationHistory: any[];
  graphData: any;
}

export default function Chatbot({ selectedNode, simulationHistory, graphData }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your **Graph Retail AI** Assistant. Ask me anything about the graph, products, or simulation results.' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const isDraggingBtn = useRef(false);
  
  // Shared drag state for origin positioning
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  
  const ai = useMemo(() => {
    try {
      const rawKey = (
        import.meta.env.VITE_GEMINI_API_KEY || 
        (process.env as any).VITE_GEMINI_API_KEY || 
        ''
      );
      const apiKey = String(rawKey).trim();

      if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'undefined' || apiKey === 'null') {
      }
      return new GoogleGenAI({ apiKey });
    } catch (err) {
      return null;
    }
  }, []);
  
  const chatRef = useRef<any>(null);

  useEffect(() => {
    if (ai) {
      try {
        const model = ai.getGenerativeModel({
          model: "gemini-1.5-flash",
          systemInstruction: "You are an AI assistant for Graph Retail AI, an E-commerce Digital Twin dashboard. Your job is to explain the graph, simulation results, and market dynamics to the user. Keep your answers concise, helpful, and focused on the data provided. Use markdown for formatting.",
        });
        
        chatRef.current = model.startChat({
          history: [],
        });
      } catch (err) {
      }
    }
  }, [ai]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!chatRef.current) {
      setMessages(prev => [...prev, { role: 'user', text: input.trim() }, { role: 'model', text: '❌ **Lỗi:** Không thể kết nối với AI. Vui lòng kiểm tra lại cấu hình.' }]);
      setInput('');
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const contextString = `
[CURRENT SYSTEM CONTEXT - DO NOT MENTION THIS CONTEXT BLOCK DIRECTLY TO THE USER]
Selected Node: ${selectedNode ? JSON.stringify(selectedNode) : 'None'}
Simulation History (Top 5 products): ${JSON.stringify(simulationHistory)}
Total Graph Nodes: ${graphData?.nodes?.length || 0}
Total Graph Links: ${graphData?.links?.length || 0}
[END CONTEXT]

User Question: ${userMessage}
`;

      const result = await chatRef.current.sendMessage(contextString);
      const response = await result.response;
      const text = response.text();
      
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: "Sorry, I encountered an error while processing your request." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.button
        drag
        dragMomentum={false}
        whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
        onDragStart={() => { isDraggingBtn.current = true; }}
        onDragEnd={() => { setTimeout(() => { isDraggingBtn.current = false; }, 150); }}
        onClick={() => {
          if (!isDraggingBtn.current) {
            setIsOpen(true);
          }
        }}
        className="chatbot-btn fixed bottom-6 right-6 p-4 bg-orange-500 text-white rounded-full shadow-xl hover:bg-orange-600 cursor-grab z-50"
        style={{ x, y, opacity: isOpen ? 0 : 1, pointerEvents: isOpen ? 'none' : 'auto' }}
      >
        <Sparkles size={24} />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            className="fixed bottom-6 right-6 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden resize"
            style={{ 
              x, 
              y,
              width: '400px',
              height: '600px', 
              minWidth: '300px',
              minHeight: '400px',
              maxWidth: '90vw',
              maxHeight: '90vh',
              touchAction: 'none',
              transformOrigin: 'bottom right'
            }}
          >
            {/* Header */}
            <div 
              className="p-4 bg-blue-600 text-white flex items-center justify-between shadow-sm z-10 cursor-grab active:cursor-grabbing relative"
              onPointerDown={(e) => dragControls.start(e)}
            >
              {/* Drag Indicator */}
              <div className="absolute top-1 left-1/2 -translate-x-1/2 opacity-60 hover:opacity-100 transition-opacity">
                <GripHorizontal size={18} />
              </div>
              
              <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Bot size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-lg leading-tight">AI Assistant</h3>
              <p className="text-blue-100 text-xs font-medium">Graph Retail AI</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-blue-100 hover:text-white rounded-xl hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 bg-slate-50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-orange-500 text-white'}`}>
                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className={`px-4 py-3 rounded-2xl max-w-[80%] text-sm shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-sm' : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm'}`}>
                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert' : 'prose-slate'}`}>
                  <Markdown>{msg.text}</Markdown>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 flex-row">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Bot size={16} />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-white border border-slate-100 rounded-tl-sm flex items-center gap-3 shadow-sm">
                <Loader2 size={16} className="animate-spin text-orange-500" />
                <span className="text-sm font-medium text-slate-500">Analyzing data...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 pr-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about the simulation..."
              className="flex-1 bg-transparent border-none outline-none px-3 py-2 text-sm text-slate-800 placeholder-slate-400"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}
