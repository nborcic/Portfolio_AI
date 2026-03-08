import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chunkText } from "./chunk.js";
import { embedText, embedTexts } from "./embedding.js";
import { getDb } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function extractText(filePath: string, ext: string): Promise<string> {
  const buf = fs.readFileSync(filePath);
  if (ext === ".txt") return buf.toString("utf-8");
  if (ext === ".pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buf);
    return data.text ?? "";
  }
  return "";
}

/**
 * Load files from docsDir, chunk, embed, and upsert into Supabase doc_chunks.
 * Replaces all existing chunks (full reload).
 */
export async function loadDocs(docsDir: string): Promise<{ count: number; chunks: number }> {
  const root = path.isAbsolute(docsDir) ? docsDir : path.join(process.cwd(), docsDir);
  const db = getDb();

  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    console.warn(`Docs folder not found: ${root}. Create a "docs" folder and add PDF/TXT files.`);
    await db.rpc("truncate_doc_chunks");
    return { count: 0, chunks: 0 };
  }

  const files = fs.readdirSync(root);
  const allowed = [".pdf", ".txt"];
  const rows: { source_file: string; content: string; embedding: number[] }[] = [];

  for (const name of files) {
    const ext = path.extname(name).toLowerCase();
    if (!allowed.includes(ext)) continue;
    const filePath = path.join(root, name);
    if (!fs.statSync(filePath).isFile()) continue;
    try {
      const text = await extractText(filePath, ext);
      if (!text.trim()) continue;
      const textChunks = chunkText(text);
      const embeddings = await embedTexts(textChunks);
      for (let i = 0; i < textChunks.length; i++) {
        rows.push({ source_file: name, content: textChunks[i], embedding: embeddings[i] });
      }
    } catch (e) {
      console.warn(`Skip ${name}:`, e);
    }
  }

  await db.rpc("truncate_doc_chunks");
  if (rows.length > 0) {
    const { error } = await db.from("doc_chunks").insert(
      rows.map((r) => ({ source_file: r.source_file, content: r.content, embedding: r.embedding }))
    );
    if (error) throw new Error(`DB insert failed: ${error.message}`);
  }

  const fileCount = files.filter((f) => allowed.includes(path.extname(f).toLowerCase())).length;
  return { count: fileCount, chunks: rows.length };
}

/**
 * Search doc_chunks by vector similarity (uses DB RPC).
 */
export async function searchChunks(
  queryEmbedding: number[],
  topK: number,
  minSimilarity: number
): Promise<{ content: string }[]> {
  const db = getDb();
  const { data, error } = await db.rpc("match_doc_chunks", {
    query_embedding: queryEmbedding,
    match_threshold: minSimilarity,
    match_count: topK,
  });
  if (error) throw new Error(`Search failed: ${error.message}`);
  return Array.isArray(data) ? data.map((r: { content: string }) => ({ content: r.content })) : [];
}

export async function getChunksCount(): Promise<number> {
  const db = getDb();
  const { count, error } = await db.from("doc_chunks").select("*", { count: "exact", head: true });
  if (error) return 0;
  return count ?? 0;
}
