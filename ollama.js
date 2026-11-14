// Gọi Ollama chạy local (không cần API key). Mặc định: http://localhost:11434
const HOST = process.env.OLLAMA_HOST || "http://localhost:11434";
const CHAT_MODEL = process.env.OLLAMA_MODEL || "qwen2.5:7b";   // máy yếu: "qwen2.5:3b"
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "bge-m3"; // embedding đa ngôn ngữ, hỗ trợ tiếng Việt

async function post(path, body) {
  const r = await fetch(HOST + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Ollama ${path} lỗi ${r.status}: ${await r.text()}`);
  return r.json();
}

// texts: string[] -> number[][]
async function embed(texts) {
  const out = [];
  for (let i = 0; i < texts.length; i += 16) {
    const data = await post("/api/embed", { model: EMBED_MODEL, input: texts.slice(i, i + 16) });
    out.push(...data.embeddings);
  }
  return out;
}

// messages: [{role:"system"|"user"|"assistant", content}]
async function chat(messages) {
  const data = await post("/api/chat", {
    model: CHAT_MODEL,
    messages,
    stream: false,
    options: { num_ctx: 4096, temperature: 0.3 },
  });
  return data.message.content;
}

module.exports = { embed, chat };
