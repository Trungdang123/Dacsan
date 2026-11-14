// Chạy: node ingest.js   (chạy lại mỗi khi sửa sản phẩm hoặc thêm file vào thư mục docs/)
// Đọc sản phẩm từ shop.db + PDF/TXT/MD trong docs/ -> cắt đoạn -> embedding -> index.json
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const pdf = require("pdf-parse"); // cần pdf-parse@1.1.1
const { embed } = require("./ollama");

function chunkText(text, size = 800) {
  const paras = text.replace(/\r/g, "").split(/\n{2,}/).map((s) => s.trim()).filter(Boolean);
  const chunks = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + "\n" + p).length > size && cur) { chunks.push(cur); cur = p; }
    else cur = cur ? cur + "\n" + p : p;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

(async () => {
  const items = []; // { source, text }

  // 1) Sản phẩm: mỗi món = 1 đoạn
  const db = new Database(path.join(__dirname, "shop.db"), { readonly: true });
  for (const r of db.prepare("SELECT * FROM MonAn").all()) {
    items.push({
      source: "Sản phẩm",
      text:
        `${r.TenMon} (nhóm: ${r.NhomMon}). Giá: ${r.Gia}đ / ${r.DonVi}. ` +
        `Mô tả: ${r.MoTa}. Hương vị: ${r.HuongVi}. Xuất xứ: ${r.XuatXu}. ` +
        `Cách dùng: ${r.CachDung}. Bảo quản: ${r.BaoQuan}. Hạn dùng: ${r.HanDung}. ` +
        `Lưu ý dị ứng: ${r.LuuYDiUng}. Hộp làm quà: ${r.HopLamQua ? "có" : "không"}. Tồn kho: ${r.TonKho}.`,
    });
  }
  db.close();

  // 2) Tài liệu riêng: docs/*.pdf|txt|md
  const docsDir = path.join(__dirname, "docs");
  if (fs.existsSync(docsDir)) {
    for (const f of fs.readdirSync(docsDir)) {
      const ext = path.extname(f).toLowerCase();
      const full = path.join(docsDir, f);
      let text = "";
      if (ext === ".pdf") text = (await pdf(fs.readFileSync(full))).text;
      else if (ext === ".txt" || ext === ".md") text = fs.readFileSync(full, "utf8");
      else continue;
      chunkText(text).forEach((c) => items.push({ source: f, text: c }));
      console.log("Đã đọc", f);
    }
  }

  console.log(`Đang tạo embedding cho ${items.length} đoạn...`);
  const vecs = await embed(items.map((i) => i.text));
  fs.writeFileSync(
    path.join(__dirname, "index.json"),
    JSON.stringify(items.map((it, i) => ({ ...it, vec: vecs[i] })))
  );
  console.log("Xong -> index.json");
})().catch((e) => { console.error("Lỗi:", e.message); process.exit(1); });
