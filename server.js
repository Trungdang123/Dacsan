// Chạy: node server.js  (cùng thư mục với shop.db, ollama.js, rag.js)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { chat } = require("./ollama");
const { search } = require("./rag");

const db = new Database(path.join(__dirname, "shop.db"), { readonly: true });
const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/products", (req, res) => {
  const rows = db.prepare("SELECT * FROM MonAn").all();
  res.json(rows.map((r) => ({
    id: r.MaMon, name: r.TenMon, category: r.NhomMon,
    price: r.Gia, unit: r.DonVi, image: r.HinhAnh,
    // các trường dùng cho trang chi tiết, nhãn "Quà biếu" và "Hết hàng"
    stock: r.TonKho, gift: !!r.HopLamQua, desc: r.MoTa, flavor: r.HuongVi,
    origin: r.XuatXu, usage: r.CachDung, storage: r.BaoQuan,
    shelfLife: r.HanDung, allergy: r.LuuYDiUng,
  })));
});

// Nhận đơn hàng: tính lại tiền theo giá trong shop.db (không tin giá từ trình duyệt), ghi vào orders.json
const ORDERS_FILE = path.join(__dirname, "orders.json");
app.post("/api/orders", (req, res) => {
  try {
    const c = req.body.customer || {};
    const name = String(c.name || "").trim().slice(0, 100);
    const phone = String(c.phone || "").trim().slice(0, 20);
    const address = String(c.address || "").trim().slice(0, 300);
    const note = String(c.note || "").trim().slice(0, 300);
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    if (!name || !phone || !address) return res.status(400).json({ error: "Thiếu thông tin người nhận" });
    if (!items.length) return res.status(400).json({ error: "Giỏ hàng trống" });

    const get = db.prepare("SELECT MaMon, TenMon, Gia, DonVi, TonKho FROM MonAn WHERE MaMon = ?");
    const lines = [];
    let total = 0;
    for (const it of items) {
      const qty = Math.floor(Number(it.qty));
      const p = get.get(Number(it.id));
      if (!p || !(qty > 0)) return res.status(400).json({ error: "Món trong giỏ không hợp lệ" });
      if (qty > p.TonKho) return res.status(400).json({ error: `${p.TenMon} chỉ còn ${p.TonKho} sản phẩm` });
      lines.push({ id: p.MaMon, name: p.TenMon, unit: p.DonVi, price: p.Gia, qty });
      total += p.Gia * qty;
    }

    const orders = fs.existsSync(ORDERS_FILE) ? JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8")) : [];
    const orderId = (orders.length ? Math.max(...orders.map((o) => o.orderId)) : 1000) + 1;
    orders.push({ orderId, createdAt: new Date().toISOString(), status: "moi", customer: { name, phone, address, note }, items: lines, total });
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
    res.json({ orderId, total });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ error: "Lỗi máy chủ, hãy thử lại" });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body.message || "").slice(0, 500);
    const hits = await search(message, 5);
    const context = hits.length
      ? hits.map((h, i) => `[${i + 1}] (${h.source}) ${h.text}`).join("\n\n")
      : "(không có dữ liệu)";

    const reply = await chat([
      { role: "system", content:
        "Bạn là trợ lý bán hàng của cửa hàng Đặc sản Thanh Hóa. Trả lời bằng tiếng Việt, lịch sự, ngắn gọn. " +
        "CHỈ dùng thông tin trong phần DỮ LIỆU bên dưới. Nếu không có thông tin, hãy nói chưa có thông tin và mời khách liên hệ cửa hàng. " +
        " Nếu thông tin không có trong danh mục, nói rõ bạn chưa có thông tin và gợi ý khách liên hệ cửa hàng" + 
        "- Câu hỏi không liên quan đến cửa hàng/đặc sản: từ chối lịch sự và đưa khách về chủ đề sản phẩm" + 
        " Món có tình trạng HẾT HÀNG thì báo hết hàng và gợi ý món tương tự còn hàng." + context },
      { role: "user", content: message },
    ]);
    res.json({ reply });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ reply: null });
  }
});

app.listen(3000, () => console.log("Server chạy tại http://localhost:3000"));