import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from "docx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(fs.readFileSync(path.join(__dirname, "doc-content.json"), "utf8"));

const FONT = "Times New Roman";
const S_TITLE = 36;
const S_H1 = 32;
const S_H2 = 26;
const S_BODY = 24;
const LINE_SPACING = 360;

const children = [];

// ── Trang bìa
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 2000, after: 400 },
    children: [new TextRun({ text: content.title, bold: true, size: S_TITLE, font: FONT, color: "1F3864" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    children: [new TextRun({ text: content.subtitle, italics: true, size: S_H2, font: FONT, color: "555555" })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 800 },
    children: [new TextRun({ text: "2026", size: S_BODY, font: FONT, color: "888888" })],
  }),
  // Page break
  new Paragraph({ children: [new TextRun({ break: 1 })] })
);

// ── Mục lục
children.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text: "Mục Lục", bold: true, size: S_H1, font: FONT, color: "1F3864" })],
  })
);
for (const ch of content.chapters) {
  children.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 80, after: 80, line: LINE_SPACING },
      children: [new TextRun({ text: ch.title, size: S_BODY, font: FONT })],
    })
  );
}
children.push(
  new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { before: 80, after: 80, line: LINE_SPACING },
    children: [new TextRun({ text: content.conclusion.title, size: S_BODY, font: FONT })],
  }),
  new Paragraph({ children: [new TextRun({ break: 1 })] })
);

// ── Các chương
for (const ch of content.chapters) {
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: ch.title, bold: true, size: S_H1, font: FONT, color: "1F3864" })],
    })
  );
  for (const sec of ch.sections) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 280, after: 160 },
        children: [new TextRun({ text: sec.heading, bold: true, size: S_H2, font: FONT, color: "2E4057" })],
      })
    );
    for (const para of sec.paragraphs) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { before: 120, after: 120, line: LINE_SPACING },
          children: [new TextRun({ text: para, size: S_BODY, font: FONT })],
        })
      );
    }
  }
  children.push(new Paragraph({ children: [new TextRun({ break: 1 })] }));
}

// ── Kết luận
children.push(
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text: content.conclusion.title, bold: true, size: S_H1, font: FONT, color: "1F3864" })],
  })
);
for (const para of content.conclusion.paragraphs) {
  children.push(
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 120, after: 120, line: LINE_SPACING },
      children: [new TextRun({ text: para, size: S_BODY, font: FONT })],
    })
  );
}
children.push(
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600 },
    children: [new TextRun({ text: "— Hết —", italics: true, size: S_BODY, font: FONT, color: "888888" })],
  })
);

const doc = new Document({
  sections: [{
    properties: {
      page: { margin: { top: 1440, bottom: 1440, left: 1800, right: 1440 } },
    },
    children,
  }],
});

const outPath = path.join(__dirname, "..", "workspace", "ban-chat-phat-trien.docx");
const buf = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buf);
console.log(`Done: ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
