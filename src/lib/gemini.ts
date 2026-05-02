import { GoogleGenAI } from '@google/genai';
import { XAI_PROMPT } from './prompt';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Reusable generation function to match Chatbot.tsx behavior if possible, 
// but using generateContent for one-off tasks.
const generateWithGemini = async (prompt: string): Promise<string> => {
  if (!ai) return "";
  
  try {
    // The @google/genai SDK uses generateContent with a specific structure
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    
    return response.text || "";
  } catch (error: any) {
    console.error('Gemini Generation Error:', error);
    // Fallback if gemini-2.5-flash fails (unlikely if user insists, but good for safety)
    return "";
  }
};

export const getGeminiXAIExplanation = async (
  product: any,
  changes: { priceChange: number; discountChange: number },
  results: { newSold: number; newRevenue: number; revenueDelta: number },
  marketCondition: string,
  gnnInsights?: string
): Promise<string> => {
  if (!ai) {
    return "⚠️ Gemini API Key chưa được cấu hình. Không thể tạo phân tích AI.";
  }

  const prompt = `
${XAI_PROMPT}

### DỮ LIỆU CỤ THỂ:
- Sản phẩm: ${product.name}
- Giá gốc: ${product.originalPrice.toLocaleString()}đ
- Lượt bán gốc: ${product.originalSold.toLocaleString()}
- Doanh thu gốc: ${Math.floor(product.originalPrice * (1 - product.originalDiscount) * product.originalSold).toLocaleString()}đ
- Khuyến mãi gốc: ${(product.originalDiscount * 100).toFixed(0)}%

### THAY ĐỔI:
- Thay đổi giá: ${changes.priceChange}%
- Thay đổi khuyến mãi: ${changes.discountChange}% (so với giá gốc)

### KẾT QUẢ MÔ PHỎNG:
- Lượt bán mới: ${results.newSold.toLocaleString()}
- Doanh thu mới: ${Math.floor(results.newRevenue).toLocaleString()}đ
- Thay đổi doanh thu: ${results.revenueDelta >= 0 ? '+' : ''}${Math.floor(results.revenueDelta).toLocaleString()}đ

### BỐI CẢNH:
- Thị trường: ${marketCondition === 'normal' ? 'Bình thường' : marketCondition === 'recession' ? 'Suy thoái' : 'Tăng trưởng'}
${gnnInsights ? `- GNN Insights: ${gnnInsights}` : ''}

Hãy đưa ra phân tích XAI cho kịch bản này.
`;

  const text = await generateWithGemini(prompt);
  return text || "❌ Không thể nhận phản hồi từ Gemini 2.5 Flash. Vui lòng kiểm tra lại cấu hình.";
};

export const getGeminiStrategyExplanation = async (
  shopName: string,
  changesCount: number,
  totalGain: number,
  strategyDesc: string,
  marketCondition: string,
  topPerformers: any[]
): Promise<string> => {
  if (!ai) return "";

  const prompt = `
Bạn là chuyên gia phân tích chiến lược cao cấp cho hệ thống Graph Retail AI.
Hãy viết một báo cáo phân tích chiến lược chuyên sâu về kết quả tối ưu hóa vừa thực hiện cho shop **${shopName}**.

### DỮ LIỆU TỔNG HỢP:
- Số sản phẩm đã điều chỉnh: ${changesCount}
- Tổng doanh thu dự kiến thay đổi: ${totalGain >= 0 ? '+' : ''}${Math.floor(totalGain).toLocaleString()}đ
- Bối cảnh thị trường: ${marketCondition}
- Chiến lược cốt lõi: ${strategyDesc}

### DANH SÁCH SẢN PHẨM TIÊU BIỂU:
${topPerformers.map(p => `- ${p.name}: Giá mới ${Math.floor(p.price * (1 - p.discount)).toLocaleString()}đ (KM: ${(p.discount * 100).toFixed(0)}%) -> Dự kiến bán: ${p.sold}`).join('\n')}

### YÊU CẦU PHÂN TÍCH:
- Viết cực kỳ ngắn gọn (chỉ 1 đến 2 câu).
- KHÔNG sử dụng định dạng Markdown: TUYỆT ĐỐI KHÔNG in đậm (**), KHÔNG dùng dấu sao (*) hoặc gạch đầu dòng.
- Chỉ sử dụng văn bản thuần túy (Plain text).
- Phản hồi bằng tiếng Việt.
`;

  return await generateWithGemini(prompt);
};
