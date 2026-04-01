// File I/O tools — read_file, write_file, list_dir
// Tất cả đều bị sandbox trong WORKSPACE_DIR để tránh AI truy cập file hệ thống

import fs from "node:fs";
import path from "node:path";

const MAX_READ_SIZE = 50_000; // chars — tránh trả quá nhiều vào context

/**
 * Resolve đường dẫn an toàn trong workspace.
 * Throws nếu path cố thoát ra ngoài workspace (path traversal).
 */
function safePath(workspaceDir: string, filePath: string): string {
  const workspace = path.resolve(workspaceDir);
  const resolved = path.resolve(workspace, filePath);

  if (!resolved.startsWith(workspace + path.sep) && resolved !== workspace) {
    throw new Error(
      `Truy cập bị từ chối: đường dẫn "${filePath}" nằm ngoài workspace.`
    );
  }

  // Follow symlinks và kiểm tra real path (tránh symlink traversal)
  try {
    const real = fs.realpathSync(resolved);
    if (!real.startsWith(workspace + path.sep) && real !== workspace) {
      throw new Error(`Truy cập bị từ chối: symlink trỏ ra ngoài workspace.`);
    }
  } catch (e) {
    // ENOENT = file chưa tồn tại (cho write operations) — bỏ qua
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }

  return resolved;
}

// ─── Writers theo định dạng ────────────────────────────────────────────────

async function writeDocx(resolved: string, content: string): Promise<void> {
  const { Document, Packer, Paragraph, HeadingLevel, TextRun } = await import("docx");

  const lines = content.split("\n");
  const children: InstanceType<typeof Paragraph>[] = [];

  for (const line of lines) {
    if (line.startsWith("# ")) {
      children.push(new Paragraph({ text: line.slice(2), heading: HeadingLevel.HEADING_1 }));
    } else if (line.startsWith("## ")) {
      children.push(new Paragraph({ text: line.slice(3), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith("### ")) {
      children.push(new Paragraph({ text: line.slice(4), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith("**") && line.endsWith("**")) {
      children.push(new Paragraph({
        children: [new TextRun({ text: line.slice(2, -2), bold: true })],
      }));
    } else {
      children.push(new Paragraph({ text: line }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(resolved, buf);
}

async function writeXlsx(resolved: string, content: string): Promise<void> {
  const XLSX = await import("xlsx");

  // Hỗ trợ CSV hoặc JSON array
  let ws: ReturnType<typeof XLSX.utils.aoa_to_sheet>;
  const trimmed = content.trim();

  if (trimmed.startsWith("[")) {
    // JSON array of objects
    const data = JSON.parse(trimmed) as Record<string, unknown>[];
    ws = XLSX.utils.json_to_sheet(data);
  } else {
    // CSV
    const rows = trimmed.split("\n").map((row) => row.split(",").map((c) => c.trim()));
    ws = XLSX.utils.aoa_to_sheet(rows);
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  fs.writeFileSync(resolved, buf);
}

async function writePdf(resolved: string, content: string): Promise<void> {
  const PDFDocument = (await import("pdfkit")).default;

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(resolved);
    doc.pipe(stream);

    // Dùng font hỗ trợ Unicode (built-in Helvetica cho ASCII)
    doc.font("Helvetica");

    const lines = content.split("\n");
    for (const line of lines) {
      if (line.startsWith("# ")) {
        doc.fontSize(20).text(line.slice(2), { paragraphGap: 8 });
        doc.fontSize(12);
      } else if (line.startsWith("## ")) {
        doc.fontSize(16).text(line.slice(3), { paragraphGap: 6 });
        doc.fontSize(12);
      } else if (line.startsWith("### ")) {
        doc.fontSize(14).text(line.slice(4), { paragraphGap: 4 });
        doc.fontSize(12);
      } else if (line === "") {
        doc.moveDown(0.5);
      } else {
        doc.fontSize(12).text(line, { lineGap: 2 });
      }
    }

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Đọc nội dung file trong workspace.
 */
export function readFile(workspaceDir: string, filePath: string): string {
  let resolved: string;
  try {
    resolved = safePath(workspaceDir, filePath);
  } catch (e) {
    return String(e instanceof Error ? e.message : e);
  }

  if (!fs.existsSync(resolved)) {
    return `File không tồn tại: ${filePath}`;
  }

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    return `"${filePath}" là thư mục, không phải file. Dùng list_dir để xem nội dung.`;
  }

  try {
    const content = fs.readFileSync(resolved, "utf8");
    if (content.length > MAX_READ_SIZE) {
      return content.slice(0, MAX_READ_SIZE) + `\n\n...(truncated — file dài ${content.length} chars, chỉ hiển thị ${MAX_READ_SIZE})`;
    }
    return content;
  } catch {
    return `File tồn tại nhưng không đọc được dưới dạng text (có thể là file binary).`;
  }
}

/**
 * Ghi nội dung vào file trong workspace. Tạo thư mục cha nếu chưa có.
 * Tự động chọn writer phù hợp theo đuôi file:
 *   .docx → Word document (hỗ trợ markdown heading: #, ##, ###)
 *   .xlsx → Excel (hỗ trợ CSV hoặc JSON array)
 *   .pdf  → PDF document (hỗ trợ markdown heading: #, ##, ###)
 *   khác  → text thuần (UTF-8)
 */
export async function writeFile(workspaceDir: string, filePath: string, content: string): Promise<string> {
  let resolved: string;
  try {
    resolved = safePath(workspaceDir, filePath);
  } catch (e) {
    return String(e instanceof Error ? e.message : e);
  }

  try {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".docx") {
      await writeDocx(resolved, content);
      return `✅ Đã tạo file Word: ${filePath}`;
    }

    if (ext === ".xlsx" || ext === ".xls") {
      await writeXlsx(resolved, content);
      return `✅ Đã tạo file Excel: ${filePath}`;
    }

    if (ext === ".pdf") {
      await writePdf(resolved, content);
      return `✅ Đã tạo file PDF: ${filePath}`;
    }

    // Mặc định: text
    fs.writeFileSync(resolved, content, "utf8");
    const lines = content.split("\n").length;
    return `✅ Đã ghi file: ${filePath} (${lines} dòng, ${content.length} ký tự)`;

  } catch (err) {
    return `Lỗi tạo file: ${err instanceof Error ? err.message : String(err)}`;
  }
}

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".svn", "__pycache__", ".next", "dist", "build",
  ".cache", "coverage", "vendor", "venv", ".venv", "env", ".env",
]);

/**
 * Đệ quy xây dựng cây thư mục dạng text.
 */
function buildTree(dirPath: string, prefix: string, depth: number, maxDepth: number): string[] {
  if (depth > maxDepth) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  // Thư mục trước, file sau; bỏ qua các thư mục nặng
  const dirs = entries.filter((e) => e.isDirectory() && !SKIP_DIRS.has(e.name));
  const files = entries.filter((e) => !e.isDirectory());

  const lines: string[] = [];
  const all = [...dirs, ...files];

  for (let i = 0; i < all.length; i++) {
    const e = all[i]!;
    const isLast = i === all.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? prefix + "    " : prefix + "│   ";

    if (e.isDirectory()) {
      lines.push(`${prefix}${connector}${e.name}/`);
      lines.push(...buildTree(path.join(dirPath, e.name), childPrefix, depth + 1, maxDepth));
    } else {
      try {
        const size = fs.statSync(path.join(dirPath, e.name)).size;
        const sizeStr = size > 1048576 ? `${(size / 1048576).toFixed(1)}MB`
          : size > 1024 ? `${(size / 1024).toFixed(1)}KB`
          : `${size}B`;
        lines.push(`${prefix}${connector}${e.name} (${sizeStr})`);
      } catch {
        lines.push(`${prefix}${connector}${e.name}`);
      }
    }
  }
  return lines;
}

/**
 * Liệt kê nội dung thư mục dạng cây đệ quy.
 * - Nếu dirPath là absolute path (ví dụ C:\Users\... hoặc /home/...) → đọc thẳng từ path đó.
 * - Nếu là relative path → sandbox trong WORKSPACE_DIR.
 * - depth: độ sâu đệ quy (mặc định 3).
 */
export function listDir(workspaceDir: string, dirPath: string = ".", depth: number = 3): string {
  const isAbsolute = path.isAbsolute(dirPath);

  let resolved: string;
  if (isAbsolute) {
    resolved = path.normalize(dirPath);
  } else {
    try {
      resolved = safePath(workspaceDir, dirPath);
    } catch (e) {
      return String(e instanceof Error ? e.message : e);
    }
  }

  // Nếu workspace chưa tồn tại, tạo nó (chỉ với relative path)
  if (!fs.existsSync(resolved)) {
    if (!isAbsolute && (dirPath === "." || dirPath === "")) {
      fs.mkdirSync(resolved, { recursive: true });
      return `Workspace trống: ${workspaceDir}`;
    }
    return `Thư mục không tồn tại: ${resolved}`;
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return `"${dirPath}" là file, không phải thư mục. Dùng read_file để đọc nội dung.`;
  }

  const treeLines = buildTree(resolved, "", 0, Math.min(depth, 5));
  if (treeLines.length === 0) return `Thư mục trống: ${resolved}`;

  return `${resolved}/\n${treeLines.join("\n")}`;
}
