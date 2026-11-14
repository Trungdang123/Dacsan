// Chạy: node server.js  (cùng thư mục với shop.db, ollama.js, rag.js)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");
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
  })));
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
        "Không bịa giá hay hạn dùng.\n\nDỮ LIỆU:\n" + context },
      { role: "user", content: message },
    ]);
    res.json({ reply });
  } catch (e) {
    console.error(e.message);
    res.status(500).json({ reply: null });
  }
});

app.listen(3000, () => console.log("Server chạy tại http://localhost:3000"));