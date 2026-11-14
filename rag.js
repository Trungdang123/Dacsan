// Tìm các đoạn liên quan nhất tới câu hỏi (cosine similarity trên index.json)
const fs = require("fs");
const path = require("path");
const { embed } = require("./ollama");

const INDEX_FILE = path.join(__dirname, "index.json");
let index = null;

function load() {
  if (!index) {
    index = fs.existsSync(INDEX_FILE) ? JSON.parse(fs.readFileSync(INDEX_FILE, "utf8")) : [];
  }
  return index;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

async function search(question, k = 5) {
  const items = load();
  if (!items.length) return [];
  const [qv] = await embed([question]);
  return items
    .map((it) => ({ ...it, score: cosine(qv, it.vec) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

module.exports = { search };
