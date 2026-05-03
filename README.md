# GraphRetail AI - Competitive Intelligence & Simulation Platform

GraphRetail AI là một hệ thống phân tích đối thủ cạnh tranh toàn diện cho các nhà bán lẻ thương mại điện tử (đặc biệt là Shopee). Hệ thống kết hợp sức mạnh của **Đồ thị tri thức (Knowledge Graph)**, **Graph Neural Networks (GNN)** và **Generative AI** để cung cấp các phân tích causual reasoning và dự báo doanh thu.

---

## 🚀 Cài đặt & Chạy ứng dụng

### 1. Yêu cầu hệ thống
- **Node.js** (Phiên bản 18 trở lên)
- **Supabase Account** (Để lưu trữ dữ liệu và chạy Edge Functions)
- **Gemini API Key** (Để chạy AI Chatbot phân tích)

### 2. Cài đặt Dashboard (Web App)
### Cách 1: Tải và chạy Localhost trên máy tính cá nhân
1. Clone repository về máy.
2. Cài đặt các gói phụ thuộc:
   ```bash
   npm install
   ````
3. Tạo file `.env` tại thư mục gốc với các thông số sau:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```
4. Khởi chạy ứng dụng ở chế độ phát triển:
   ```bash
   npm run dev
   ```
---
### Cách 2: Truy cập nhanh (Khuyến nghị)
Nếu chẳng may khi bấm vào link không phải màn hình đăng nhập, bạn có thể bấm nút đăng xuất ở góc bên phải trên cùng để đăng nhập tài khoản khác
Không cần cài đặt, bạn có thể truy cập trực tiếp vào web app đã được triển khai:
👉 https://graph-retail-ai.vercel.app


### 3. Tài khoản trải nghiệm & Đăng ký
- **Tài khoản mẫu (Đã có dữ liệu):**
  - **Email:** `gameyuno123@gmail.com`
  - **Mật khẩu:** `123456`
- **Đăng ký tài khoản mới:** 
  - Nếu muốn dùng tài khoản riêng (chưa có dữ liệu), hãy nhấn vào tab **Đăng ký**.
  - Sau khi đăng ký, bạn cần **kiểm tra email** để xác nhận tài khoản trước khi đăng nhập.
  - **Lưu ý:** Hệ thống giới hạn đăng ký tối đa **3 tài khoản/giờ**.

### 4. Cài đặt Chrome Extension (Crawl Tool)
1. Mở trình duyệt Chrome và truy cập đường dẫn: `chrome://extensions/`
2. Bật **"Chế độ nhà phát triển" (Developer mode)** ở góc trên bên phải.
3. Nhấn nút **"Tải tiện ích đã giải nén" (Load unpacked)**.
4. Chọn thư mục `chrome-extension/` trong dự án này.
5. Ghim Extension lên thanh công cụ để sử dụng.

---

## 🛠 Hướng dẫn sử dụng

### Bước 1: Thu thập dữ liệu (Crawl)
1. **Đăng nhập**: Mở Extension, nhập tài khoản GraphRetail AI của bạn.
   - **Lưu ý:** Nếu đã đăng nhập từ lâu, bạn nên **Đăng xuất và Đăng nhập lại** để làm mới phiên làm việc. Hãy chú ý kiểm tra đúng tài khoản đang hiển thị trong Extension trước khi nhấn Crawl.
2. **Crawl**: Truy cập trang Shop hoặc danh mục sản phẩm trên Shopee. Nhấn **"▶ Bắt đầu Crawl"**. Extension sẽ tự động cuộn trang và thu thập thông tin sản phẩm.
   - **Khuyến nghị:** Nên cào **dưới 200 dòng dữ liệu** mỗi lần để đảm bảo hiệu năng mượt mà nhất khi hiển thị đồ thị tri thức trên Dashboard (đặc biệt với các máy cấu hình thấp).
3. **Upload**: Sau khi hoàn tất, nhấn **"⬆ Đẩy lên Supabase"**. Dữ liệu sẽ được tự động làm sạch và chuẩn hóa (Region, Shop Name) trước khi lưu vào database.

### Bước 2: Phân tích trên Dashboard
1. **Làm mới dữ liệu**: Quay lại Dashboard và nhấn nút 🔄 (Refresh) để tải dữ liệu mới nhất.
2. **Đồ thị tri thức**:
   - **Node lớn**: Doanh thu cao.
   - **Đường kẻ đỏ đứt đoạn**: Chỉ ra sự cạnh tranh trực tiếp giữa các sản phẩm (tương đồng về tính năng/giá).
   - **Liên kết**: Shop -> Vùng -> Sản phẩm.
3. **AI Chatbot**: Sử dụng khung chat ở góc phải để hỏi về xu hướng thị trường, chiến lược giá hoặc yêu cầu so sánh đối thủ.
   - **Lưu ý:** Hệ thống sử dụng mô hình AI miễn phí nên có **giới hạn số lượt chat mỗi phút/giờ**. Vui lòng hạn chế sử dụng dồn dập để tránh bị tạm khóa API.
4. **Mô phỏng (Simulation)**:
   - Sử dụng thanh bên phải để thay đổi **Chu kỳ kinh tế** (Recession, Normal, Growth).
   - Điều chỉnh giá hoặc khuyến mãi của shop mình để xem dự báo thay đổi doanh thu và mức độ "ăn thịt" (Cannibalization) từ đối thủ.

---

## ✨ Tính năng nổi bật

- **Chuẩn hóa dữ liệu tự động**: Tự động xử lý lỗi Unicode, khoảng trắng NBSP và gộp các vùng địa lý (ví dụ: "TP.HCM" và "Hồ Chí Minh" sẽ về cùng một Node).
- **Phân tích GNN**: Sử dụng Graph Neural Networks để phát hiện các mối quan hệ cạnh tranh ẩn.
- **Hệ thống Tutorial**: Hướng dẫn tương tác 14 bước chi tiết ngay lần đầu sử dụng.
- **Real-time Sync**: Dữ liệu từ Extension đồng bộ ngay lập tức với Dashboard thông qua Supabase.

---

## 📁 Cấu trúc thư mục

- `/src`: Mã nguồn React/Vite (Dashboard).
- `/chrome-extension`: Tiện ích thu thập dữ liệu Shopee.
- `/supabase`: Chứa các migrations và Edge Functions (logic xử lý dữ liệu).
- `/BrandGuidline`: Tài liệu và logo nhận diện thương hiệu.

---
© 2026 GraphRetail AI Team - Architecting Retail Intelligence.
