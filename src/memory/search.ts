// Memory search — tìm kiếm keyword trong lịch sử chat đã lưu

import fs from "node:fs";
import path from "node:path";

const MAX_RESULTS = 3;
const MAX_EXCERPT_LENGTH = 400;

export interface MemoryResult {
  filename: string;
  excerpt: string;
  score: number;
}

/**
 * Tìm kiếm keyword trong các file memory đã lưu.
 * Trả về các đoạn liên quan nhất.
 */
export async function searchMemory(query: string, memoriesDir: string): Promise<string> {
  if (!fs.existsSync(memoriesDir)) {
    return "Chưa có memory nào được lưu.";
  }

  const files = fs.readdirSync(memoriesDir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse(); // mới nhất trước

  if (files.length === 0) {
    return "Chưa có memory nào được lưu.";
  }

  const keywords = extractKeywords(query);
  if (keywords.length === 0) {
    return "Không thể trích xuất từ khóa từ truy vấn.";
  }

  const results: MemoryResult[] = [];

  // Giới hạn tìm kiếm trong 50 file gần nhất để tăng tốc, và đọc file song song
  const filesToSearch = files.slice(0, 50);
  const fileReads = await Promise.all(
    filesToSearch.map(async (file) => {
      try {
        const filePath = path.join(memoriesDir, file);
        return { file, content: await fs.promises.readFile(filePath, "utf8") };
      } catch {
        return null;
      }
    })
  );

  for (const item of fileReads) {
    if (!item) continue;
    const { file, content } = item;

    const score = scoreContent(content, keywords);
    if (score === 0) continue;

    const excerpt = extractExcerpt(content, keywords);
    results.push({ filename: file, excerpt, score });
  }

  if (results.length === 0) {
    return `Không tìm thấy memory liên quan đến: "${query}"`;
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  const topResults = results.slice(0, MAX_RESULTS);
  const lines = [`Tìm thấy ${results.length} memory liên quan đến: "${query}"\n`];

  for (const r of topResults) {
    // Extract date from filename (format: YYYY-MM-DD-HHMM-...)
    const dateMatch = r.filename.match(/^(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : r.filename;
    lines.push(`**[${date}]** (${r.filename})`);
    lines.push(r.excerpt);
    lines.push("");
  }

  return lines.join("\n");
}

function extractKeywords(query: string): string[] {
  // Remove common stopwords, split into words
  const stopwords = new Set([
    "là", "và", "của", "cho", "với", "về", "trong", "có", "không", "được",
    "một", "các", "này", "đó", "the", "a", "an", "is", "are", "was", "were",
    "in", "on", "at", "to", "for", "of", "and", "or", "but", "not",
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\sàáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỷỹ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopwords.has(w));
}

function scoreContent(content: string, keywords: string[]): number {
  const lower = content.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    const occurrences = (lower.match(new RegExp(kw, "g")) ?? []).length;
    score += occurrences;
  }
  return score;
}

function extractExcerpt(content: string, keywords: string[]): string {
  const lines = content.split("\n");
  const lower = content.toLowerCase();

  // Find the line with the highest keyword density
  let bestLineIdx = 0;
  let bestScore = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();
    let score = 0;
    for (const kw of keywords) {
      if (lineLower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestLineIdx = i;
    }
  }

  // Return context: best line + 2 lines before/after
  const start = Math.max(0, bestLineIdx - 2);
  const end = Math.min(lines.length, bestLineIdx + 4);
  const excerpt = lines.slice(start, end).join("\n").trim();

  return excerpt.length > MAX_EXCERPT_LENGTH
    ? excerpt.slice(0, MAX_EXCERPT_LENGTH) + "..."
    : excerpt;
}
