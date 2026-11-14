// Chạy 1 lần duy nhất: node migrate.js
// Đọc bảng MonAn từ SQL Server (theo file .env) rồi ghi sang file shop.db (SQLite)
require("dotenv").config();
const sql = require("mssql");
const Database = require("better-sqlite3");
const path = require("path");

const config = {
  server: process.env.DB_SERVER,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  options: { encrypt: false, trustServerCertificate: true },
};

(async () => {
  const pool = await new sql.ConnectionPool(config).connect();
  const result = await pool.request().query("SELECT * FROM MonAn");
  const rows = result.recordset;
  console.log(`Đọc được ${rows.length} dòng từ SQL Server`);

  const db = new Database(path.join(__dirname, "shop.db"));
  db.exec(`
    DROP TABLE IF EXISTS MonAn;
    CREATE TABLE MonAn (
      MaMon     INTEGER PRIMARY KEY,
      TenMon    TEXT NOT NULL,
      NhomMon   TEXT,
      Gia       REAL NOT NULL DEFAULT 0,
      DonVi     TEXT,
      MoTa      TEXT,
      HuongVi   TEXT,
      XuatXu    TEXT,
      CachDung  TEXT,
      BaoQuan   TEXT,
      HanDung   TEXT,
      LuuYDiUng TEXT,
      HopLamQua INTEGER DEFAULT 0,
      TonKho    INTEGER DEFAULT 0,
      HinhAnh   TEXT
    );
  `);

  const insert = db.prepare(`
    INSERT INTO MonAn
      (MaMon, TenMon, NhomMon, Gia, DonVi, MoTa, HuongVi, XuatXu, CachDung, BaoQuan, HanDung, LuuYDiUng, HopLamQua, TonKho, HinhAnh)
    VALUES
      (@MaMon, @TenMon, @NhomMon, @Gia, @DonVi, @MoTa, @HuongVi, @XuatXu, @CachDung, @BaoQuan, @HanDung, @LuuYDiUng, @HopLamQua, @TonKho, @HinhAnh)
  `);

  // SQLite không nhận boolean/Date của mssql -> đổi về số/chuỗi
  const clean = (r) => ({
    MaMon: r.MaMon,
    TenMon: r.TenMon,
    NhomMon: r.NhomMon ?? null,
    Gia: Number(r.Gia) || 0,
    DonVi: r.DonVi ?? null,
    MoTa: r.MoTa ?? null,
    HuongVi: r.HuongVi ?? null,
    XuatXu: r.XuatXu ?? null,
    CachDung: r.CachDung ?? null,
    BaoQuan: r.BaoQuan ?? null,
    HanDung: r.HanDung instanceof Date ? r.HanDung.toISOString().slice(0, 10) : (r.HanDung ?? null),
    LuuYDiUng: r.LuuYDiUng ?? null,
    HopLamQua: r.HopLamQua ? 1 : 0,
    TonKho: Number(r.TonKho) || 0,
    HinhAnh: r.HinhAnh ?? null,
  });

  db.transaction((list) => list.forEach((r) => insert.run(clean(r))))(rows);

  console.log(`Đã ghi ${db.prepare("SELECT COUNT(*) AS n FROM MonAn").get().n} dòng vào shop.db`);
  db.close();
  await pool.close();
})().catch((err) => {
  console.error("Lỗi di chuyển dữ liệu:", err.message);
  process.exit(1);
});
