import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType
} from "docx";
import fs from "fs";
import path from "path";

const FONT = "Arial";
const SIZE_BODY = 24; // 12pt
const SIZE_H1 = 36;  // 18pt
const SIZE_H2 = 28;  // 14pt

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 200 },
    children: [new TextRun({ text, bold: true, size: SIZE_H1, font: FONT, color: "1F3864" })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 160 },
    children: [new TextRun({ text, bold: true, size: SIZE_H2, font: FONT, color: "2E4057" })],
  });
}

function p(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 100, after: 100, line: 360,  },
    children: [new TextRun({ text, size: SIZE_BODY, font: FONT })],
  });
}

function pageBreak() {
  return new Paragraph({ children: [new TextRun({ break: 1 })] });
}

function bold(text) {
  return new TextRun({ text, bold: true, size: SIZE_BODY, font: FONT });
}

function mixedP(...runs) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { before: 100, after: 100, line: 360,  },
    children: runs,
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: FONT, size: SIZE_BODY },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1800, right: 1440 },
        },
      },
      children: [

        // â”€â”€ TRANG BÃŒA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 1800, after: 400 },
          children: [new TextRun({ text: "Báº¢N CHáº¤T Cá»¦A PHÃT TRIá»‚N", bold: true, size: 52, font: FONT, color: "1F3864" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 200 },
          children: [new TextRun({ text: "Má»™t gÃ³c nhÃ¬n Ä‘a chiá»u vá» sá»± phÃ¡t triá»ƒn cá»§a cÃ¡ nhÃ¢n, tá»• chá»©c vÃ  nhÃ¢n loáº¡i", italics: true, size: 26, font: FONT, color: "555555" })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 800, after: 200 },
          children: [new TextRun({ text: "2026", size: SIZE_BODY, font: FONT, color: "888888" })],
        }),
        pageBreak(),

        // â”€â”€ Má»¤C Lá»¤C â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("Má»¥c Lá»¥c"),
        p("ChÆ°Æ¡ng I: PhÃ¡t triá»ƒn lÃ  gÃ¬? â€” Äá»‹nh nghÄ©a vÃ  báº£n cháº¥t cá»‘t lÃµi"),
        p("ChÆ°Æ¡ng II: PhÃ¡t triá»ƒn cÃ¡ nhÃ¢n â€” HÃ nh trÃ¬nh tá»« bÃªn trong"),
        p("ChÆ°Æ¡ng III: PhÃ¡t triá»ƒn tÆ° duy â€” Ná»n táº£ng cá»§a má»i thay Ä‘á»•i"),
        p("ChÆ°Æ¡ng IV: PhÃ¡t triá»ƒn trong nghá»‹ch cáº£nh â€” Ãp lá»±c táº¡o ra kim cÆ°Æ¡ng"),
        p("ChÆ°Æ¡ng V: PhÃ¡t triá»ƒn bá»n vá»¯ng â€” CÃ¢n báº±ng giá»¯a tá»‘c Ä‘á»™ vÃ  chiá»u sÃ¢u"),
        p("ChÆ°Æ¡ng VI: PhÃ¡t triá»ƒn táº­p thá»ƒ â€” Khi cÃ¡ nhÃ¢n káº¿t ná»‘i thÃ nh sá»©c máº¡nh cá»™ng Ä‘á»“ng"),
        p("ChÆ°Æ¡ng VII: Báº«y cá»§a sá»± phÃ¡t triá»ƒn â€” Nhá»¯ng Ä‘iá»u cáº£n trá»Ÿ ta tiáº¿n lÃªn"),
        p("ChÆ°Æ¡ng VIII: PhÃ¡t triá»ƒn trong ká»· nguyÃªn sá»‘ â€” CÆ¡ há»™i vÃ  thÃ¡ch thá»©c má»›i"),
        p("ChÆ°Æ¡ng IX: Triáº¿t há»c vá» phÃ¡t triá»ƒn â€” Ã nghÄ©a sÃ¢u xa Ä‘áº±ng sau sá»± thay Ä‘á»•i"),
        p("Káº¿t luáº­n: Con Ä‘Æ°á»ng phÃ­a trÆ°á»›c"),
        pageBreak(),

        // â”€â”€ CHÆ¯Æ NG I â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("ChÆ°Æ¡ng I: PhÃ¡t triá»ƒn lÃ  gÃ¬?"),
        h2("1.1 Äá»‹nh nghÄ©a cá»‘t lÃµi"),
        p("PhÃ¡t triá»ƒn khÃ´ng Ä‘Æ¡n thuáº§n lÃ  sá»± thay Ä‘á»•i. Má»i thá»© Ä‘á»u thay Ä‘á»•i theo thá»i gian â€” Ä‘Ã¡ mÃ²n, gá»— má»¥c, sáº¯t gá»‰. NhÆ°ng khÃ´ng pháº£i sá»± thay Ä‘á»•i nÃ o cÅ©ng lÃ  phÃ¡t triá»ƒn. PhÃ¡t triá»ƒn lÃ  sá»± thay Ä‘á»•i cÃ³ hÆ°á»›ng Ä‘i, cÃ³ má»¥c Ä‘Ã­ch, dáº«n Ä‘áº¿n tráº¡ng thÃ¡i tá»‘t hÆ¡n, phá»©c táº¡p hÆ¡n, hoáº·c cÃ³ nÄƒng lá»±c cao hÆ¡n so vá»›i trÆ°á»›c."),
        p("Tá»« gÃ³c nhÃ¬n sinh há»c, phÃ¡t triá»ƒn lÃ  quÃ¡ trÃ¬nh má»™t cÆ¡ thá»ƒ Ä‘i tá»« Ä‘Æ¡n giáº£n Ä‘áº¿n phá»©c táº¡p, tá»« yáº¿u Ä‘uá»‘i Ä‘áº¿n máº¡nh máº½, tá»« phá»¥ thuá»™c Ä‘áº¿n tá»± chá»§. Tá»« gÃ³c nhÃ¬n tÃ¢m lÃ½, phÃ¡t triá»ƒn lÃ  sá»± má»Ÿ rá»™ng cá»§a nháº­n thá»©c, cáº£m xÃºc vÃ  Ã½ thá»©c vá» báº£n thÃ¢n vÃ  tháº¿ giá»›i. Tá»« gÃ³c nhÃ¬n xÃ£ há»™i, phÃ¡t triá»ƒn lÃ  kháº£ nÄƒng táº¡o ra giÃ¡ trá»‹ ngÃ y cÃ ng cao hÆ¡n cho cá»™ng Ä‘á»“ng."),
        h2("1.2 Ba chiá»u cá»§a phÃ¡t triá»ƒn"),
        mixedP(
          bold("Chiá»u rá»™ng "),
          new TextRun({ text: "â€” má»Ÿ rá»™ng tráº£i nghiá»‡m, kiáº¿n thá»©c, má»‘i quan há»‡. ÄÃ¢y lÃ  phÃ¡t triá»ƒn theo bá» ngang, giÃºp ta hiá»ƒu nhiá»u lÄ©nh vá»±c, káº¿t ná»‘i vá»›i nhiá»u ngÆ°á»i, tiáº¿p xÃºc nhiá»u gÃ³c nhÃ¬n khÃ¡c nhau.", size: SIZE_BODY, font: FONT })
        ),
        mixedP(
          bold("Chiá»u sÃ¢u "),
          new TextRun({ text: "â€” Ä‘Ã o sÃ¢u vÃ o má»™t lÄ©nh vá»±c, táº¡o ra sá»± chuyÃªn sÃ¢u vÃ  thÃ nh tháº¡o thá»±c sá»±. ÄÃ¢y lÃ  con Ä‘Æ°á»ng cá»§a chuyÃªn gia, cá»§a nhá»¯ng ngÆ°á»i muá»‘n trá»Ÿ thÃ nh báº­c tháº§y trong nghá».", size: SIZE_BODY, font: FONT })
        ),
        mixedP(
          bold("Chiá»u cao "),
          new TextRun({ text: "â€” nÃ¢ng cao táº§m nhÃ¬n, Ã½ thá»©c vÃ  trÃ­ tuá»‡. ÄÃ¢y lÃ  phÃ¡t triá»ƒn ná»™i tÃ¢m, giÃºp ta tháº¥y rÃµ hÆ¡n bá»©c tranh toÃ n cáº£nh, hiá»ƒu sÃ¢u hÆ¡n Ã½ nghÄ©a cá»§a cuá»™c sá»‘ng.", size: SIZE_BODY, font: FONT })
        ),
        p("PhÃ¡t triá»ƒn thá»±c sá»± Ä‘Ã²i há»i cáº£ ba chiá»u nÃ y cÃ¹ng tiáº¿n triá»ƒn, dÃ¹ khÃ´ng nháº¥t thiáº¿t pháº£i Ä‘á»“ng Ä‘á»u. NgÆ°á»i chá»‰ phÃ¡t triá»ƒn theo chiá»u rá»™ng dá»… trá»Ÿ nÃªn nÃ´ng cáº¡n. NgÆ°á»i chá»‰ phÃ¡t triá»ƒn theo chiá»u sÃ¢u dá»… bá»‹ háº¡n cháº¿ vá» táº§m nhÃ¬n. NgÆ°á»i chá»‰ theo Ä‘uá»•i chiá»u cao mÃ  thiáº¿u ná»n táº£ng thá»±c tiá»…n dá»… rÆ¡i vÃ o mÆ¡ má»™ng viá»ƒn vÃ´ng."),
        pageBreak(),

        // â”€â”€ CHÆ¯Æ NG II â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("ChÆ°Æ¡ng II: PhÃ¡t triá»ƒn cÃ¡ nhÃ¢n â€” HÃ nh trÃ¬nh tá»« bÃªn trong"),
        h2("2.1 Táº¡i sao phÃ¡t triá»ƒn báº¯t Ä‘áº§u tá»« bÃªn trong"),
        p("CÃ³ má»™t nghá»‹ch lÃ½ mÃ  nhiá»u ngÆ°á»i máº¥t nhiá»u nÄƒm má»›i nháº­n ra: chÃºng ta khÃ´ng thá»ƒ thay Ä‘á»•i tháº¿ giá»›i bÃªn ngoÃ i cho Ä‘áº¿n khi thay Ä‘á»•i Ä‘Æ°á»£c tháº¿ giá»›i bÃªn trong. HÃ nh vi táº¡o ra káº¿t quáº£, nhÆ°ng tÆ° duy táº¡o ra hÃ nh vi. VÃ¬ váº­y, gá»‘c rá»… cá»§a má»i sá»± phÃ¡t triá»ƒn náº±m á»Ÿ tÆ° duy vÃ  nháº­n thá»©c."),
        p("Carol Dweck, nhÃ  tÃ¢m lÃ½ há»c táº¡i Stanford, phÃ¢n biá»‡t hai loáº¡i tÆ° duy: tÆ° duy cá»‘ Ä‘á»‹nh (fixed mindset) â€” tin ráº±ng nÄƒng lá»±c lÃ  báº©m sinh vÃ  khÃ´ng thay Ä‘á»•i Ä‘Æ°á»£c â€” vÃ  tÆ° duy phÃ¡t triá»ƒn (growth mindset) â€” tin ráº±ng nÄƒng lá»±c cÃ³ thá»ƒ Ä‘Æ°á»£c trau dá»“i qua ná»— lá»±c vÃ  há»c há»i. NghiÃªn cá»©u cá»§a bÃ  cho tháº¥y loáº¡i tÆ° duy nÃ y áº£nh hÆ°á»Ÿng sÃ¢u sáº¯c Ä‘áº¿n thÃ nh cÃ´ng trong há»c táº­p, cÃ´ng viá»‡c vÃ  cÃ¡c má»‘i quan há»‡."),
        h2("2.2 VÃ²ng láº·p phÃ¡t triá»ƒn"),
        p("PhÃ¡t triá»ƒn cÃ¡ nhÃ¢n khÃ´ng pháº£i lÃ  Ä‘Æ°á»ng tháº³ng mÃ  lÃ  má»™t vÃ²ng xoÃ¡y Ä‘i lÃªn. Má»—i chu ká»³ bao gá»“m: há»c há»i kiáº¿n thá»©c má»›i â†’ thá»±c hÃ nh vÃ  thá»­ nghiá»‡m â†’ váº¥p ngÃ£ vÃ  tháº¥t báº¡i â†’ pháº£n tÆ° vÃ  rÃºt kinh nghiá»‡m â†’ nÃ¢ng cao nÄƒng lá»±c â†’ báº¯t Ä‘áº§u chu ká»³ má»›i á»Ÿ cáº¥p Ä‘á»™ cao hÆ¡n."),
        p("Äiá»u quan trá»ng lÃ  khÃ´ng bá» qua bÆ°á»›c pháº£n tÆ°. Nhiá»u ngÆ°á»i cá»© hÃ nh Ä‘á»™ng mÃ  khÃ´ng dá»«ng láº¡i Ä‘á»ƒ há»c tá»« kinh nghiá»‡m. Há» tÃ­ch lÅ©y thá»i gian nhÆ°ng khÃ´ng tÃ­ch lÅ©y trÃ­ tuá»‡. NhÆ° triáº¿t gia John Dewey Ä‘Ã£ nÃ³i: 'ChÃºng ta khÃ´ng há»c tá»« kinh nghiá»‡m. ChÃºng ta há»c tá»« viá»‡c pháº£n tÆ° vá» kinh nghiá»‡m.'"),
        pageBreak(),

        // â”€â”€ CHÆ¯Æ NG III â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("ChÆ°Æ¡ng III: PhÃ¡t triá»ƒn tÆ° duy â€” Ná»n táº£ng cá»§a má»i thay Ä‘á»•i"),
        h2("3.1 Há»‡ thá»‘ng niá»m tin vÃ  sá»± phÃ¡t triá»ƒn"),
        p("TÆ° duy cá»§a chÃºng ta Ä‘Æ°á»£c xÃ¢y dá»±ng trÃªn má»™t há»‡ thá»‘ng niá»m tin hÃ¬nh thÃ nh tá»« thuá»Ÿ áº¥u thÆ¡. Nhá»¯ng niá»m tin nÃ y hoáº¡t Ä‘á»™ng nhÆ° má»™t bá»™ lá»c, quyáº¿t Ä‘á»‹nh nhá»¯ng gÃ¬ chÃºng ta chÃº Ã½, cÃ¡ch chÃºng ta diá»…n giáº£i sá»± kiá»‡n vÃ  hÃ nh Ä‘á»™ng chÃºng ta chá»n. Váº¥n Ä‘á» lÃ  nhiá»u niá»m tin trong sá»‘ nÃ y khÃ´ng cÃ²n phÃ¹ há»£p khi ta trÆ°á»Ÿng thÃ nh."),
        p("'MÃ¬nh khÃ´ng giá»i toÃ¡n.' 'NgÆ°á»i nhÆ° mÃ¬nh khÃ´ng thá»ƒ thÃ nh cÃ´ng.' 'Äá»ƒ an toÃ n, Ä‘á»«ng ná»•i báº­t.' Nhá»¯ng cÃ¢u chuyá»‡n ta ká»ƒ cho báº£n thÃ¢n khÃ´ng chá»‰ mÃ´ táº£ thá»±c táº¡i mÃ  cÃ²n táº¡o ra thá»±c táº¡i. PhÃ¡t triá»ƒn tÆ° duy báº¯t Ä‘áº§u báº±ng viá»‡c nháº­n ra, thÃ¡ch thá»©c vÃ  thay tháº¿ nhá»¯ng niá»m tin giá»›i háº¡n nÃ y."),
        h2("3.2 MÃ´ hÃ¬nh tÆ° duy há»‡ thá»‘ng"),
        p("Má»™t trong nhá»¯ng bÆ°á»›c tiáº¿n lá»›n nháº¥t trong tÆ° duy lÃ  chuyá»ƒn tá»« tÆ° duy tuyáº¿n tÃ­nh sang tÆ° duy há»‡ thá»‘ng. TÆ° duy tuyáº¿n tÃ­nh nhÃ¬n má»i thá»© theo quan há»‡ nhÃ¢n quáº£ Ä‘Æ¡n giáº£n: A gÃ¢y ra B. TÆ° duy há»‡ thá»‘ng nhÃ¬n tháº¥y cÃ¡c vÃ²ng pháº£n há»“i, sá»± tÆ°Æ¡ng tÃ¡c phá»©c táº¡p, vÃ  há»‡ quáº£ khÃ´ng lÆ°á»ng trÆ°á»›c."),
        p("NgÆ°á»i phÃ¡t triá»ƒn Ä‘Æ°á»£c tÆ° duy há»‡ thá»‘ng khÃ´ng chá»‰ giáº£i quyáº¿t triá»‡u chá»©ng mÃ  tÃ¬m Ä‘áº¿n nguyÃªn nhÃ¢n gá»‘c rá»…. Há» hiá»ƒu ráº±ng tá»‘i Æ°u hÃ³a má»™t pháº§n cá»§a há»‡ thá»‘ng Ä‘Ã´i khi lÃ m há»ng toÃ n bá»™. Há» biáº¿t chá» Ä‘á»£i káº¿t quáº£ dÃ i háº¡n thay vÃ¬ chá»‰ tá»‘i Æ°u ngáº¯n háº¡n."),
        pageBreak(),

        // â”€â”€ CHÆ¯Æ NG IV â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("ChÆ°Æ¡ng IV: PhÃ¡t triá»ƒn trong nghá»‹ch cáº£nh"),
        h2("4.1 Ãp lá»±c nhÆ° cháº¥t xÃºc tÃ¡c"),
        p("Trong tá»± nhiÃªn, than Ä‘Ã¡ trá»Ÿ thÃ nh kim cÆ°Æ¡ng dÆ°á»›i Ã¡p lá»±c khá»•ng lá»“. Con ngÆ°á»i cÅ©ng khÃ´ng khÃ¡c. Nhá»¯ng giai Ä‘oáº¡n khÃ³ khÄƒn nháº¥t trong cuá»™c Ä‘á»i thÆ°á»ng lÃ  nhá»¯ng giai Ä‘oáº¡n ta phÃ¡t triá»ƒn nhanh nháº¥t â€” náº¿u ta chá»n cÃ¡ch nhÃ¬n Ä‘Ãºng vá» chÃºng."),
        p("NhÃ  tÃ¢m lÃ½ há»c Viktor Frankl, sá»‘ng sÃ³t qua tráº¡i táº­p trung Auschwitz, Ä‘Ã£ nháº­n ra ráº±ng con ngÆ°á»i cÃ³ thá»ƒ chá»‹u Ä‘á»±ng báº¥t cá»© Ä‘iá»u gÃ¬ náº¿u tÃ¬m tháº¥y Ã½ nghÄ©a trong Ä‘Ã³. Ã”ng viáº¿t: 'Khi ta khÃ´ng thá»ƒ thay Ä‘á»•i hoÃ n cáº£nh, ta buá»™c pháº£i thay Ä‘á»•i báº£n thÃ¢n.' ÄÃ¢y lÃ  háº¡t nhÃ¢n cá»§a sá»± phÃ¡t triá»ƒn trong nghá»‹ch cáº£nh."),
        h2("4.2 Kháº£ nÄƒng phá»¥c há»“i â€” Resilience"),
        p("Resilience khÃ´ng pháº£i lÃ  khÃ´ng bá»‹ tá»•n thÆ°Æ¡ng. ÄÃ³ lÃ  kháº£ nÄƒng phá»¥c há»“i, há»c há»i vÃ  tiáº¿p tá»¥c tiáº¿n lÃªn sau khi bá»‹ tá»•n thÆ°Æ¡ng. NgÆ°á»i cÃ³ resilience cao khÃ´ng trÃ¡nh nÃ© khÃ³ khÄƒn mÃ  Ä‘á»‘i máº·t vá»›i nÃ³, xá»­ lÃ½ cáº£m xÃºc má»™t cÃ¡ch lÃ nh máº¡nh, tÃ¬m kiáº¿m sá»± há»— trá»£ khi cáº§n vÃ  rÃºt ra bÃ i há»c Ä‘á»ƒ tiáº¿n vá» phÃ­a trÆ°á»›c."),
        p("Resilience cÃ³ thá»ƒ Ä‘Æ°á»£c xÃ¢y dá»±ng theo thá»i gian thÃ´ng qua viá»‡c tiáº¿p xÃºc vá»›i nhá»¯ng thá»­ thÃ¡ch nhá», phÃ¡t triá»ƒn máº¡ng lÆ°á»›i há»— trá»£, duy trÃ¬ má»¥c Ä‘Ã­ch sá»‘ng rÃµ rÃ ng vÃ  thá»±c hÃ nh tá»± chÄƒm sÃ³c báº£n thÃ¢n Ä‘Ãºng cÃ¡ch."),
        pageBreak(),

        // â”€â”€ CHÆ¯Æ NG V â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("ChÆ°Æ¡ng V: PhÃ¡t triá»ƒn bá»n vá»¯ng"),
        h2("5.1 CÃ¡i báº«y cá»§a tá»‘c Ä‘á»™"),
        p("Trong vÄƒn hÃ³a hiá»‡n Ä‘áº¡i, chÃºng ta bá»‹ Ã¡m áº£nh bá»Ÿi tá»‘c Ä‘á»™. Nhanh hÆ¡n, nhiá»u hÆ¡n, ngay bÃ¢y giá». NhÆ°ng phÃ¡t triá»ƒn thá»±c sá»± khÃ´ng pháº£i lÃºc nÃ o cÅ©ng lÃ  phÃ¡t triá»ƒn nhanh. CÃ¢y má»c nhanh trong nhÃ  kÃ­nh thÆ°á»ng cÃ³ thÃ¢n má»m yáº¿u. CÃ¢y má»c cháº­m trong giÃ³ bÃ£o láº¡i cÃ³ rá»… sÃ¢u vÃ  thÃ¢n cá»©ng."),
        p("PhÃ¡t triá»ƒn bá»n vá»¯ng Ä‘Ã²i há»i sá»± cÃ¢n báº±ng giá»¯a thÃºc Ä‘áº©y vÃ  nghá»‰ ngÆ¡i, giá»¯a ná»— lá»±c vÃ  phá»¥c há»“i, giá»¯a tham vá»ng vÃ  cháº¥p nháº­n. Nhá»¯ng ngÆ°á»i Ä‘áº¡t Ä‘Æ°á»£c thÃ nh cÃ´ng lÃ¢u dÃ i thÆ°á»ng khÃ´ng pháº£i lÃ  ngÆ°á»i lÃ m viá»‡c nhiá»u nháº¥t mÃ  lÃ  ngÆ°á»i biáº¿t duy trÃ¬ nÄƒng lÆ°á»£ng vÃ  sá»± táº­p trung qua thá»i gian dÃ i."),
        h2("5.2 NguyÃªn táº¯c lÃ£i kÃ©p trong phÃ¡t triá»ƒn"),
        p("Einstein gá»i lÃ£i kÃ©p lÃ  'ká»³ quan thá»© tÃ¡m cá»§a tháº¿ giá»›i'. NguyÃªn táº¯c nÃ y khÃ´ng chá»‰ Ã¡p dá»¥ng cho tÃ i chÃ­nh mÃ  cho má»i lÄ©nh vá»±c phÃ¡t triá»ƒn. Má»—i ká»¹ nÄƒng báº¡n há»c Ä‘Æ°á»£c lÃ m cho viá»‡c há»c ká»¹ nÄƒng tiáº¿p theo dá»… hÆ¡n. Má»—i thÃ³i quen tá»‘t báº¡n xÃ¢y dá»±ng táº¡o ná»n táº£ng cho thÃ³i quen tá»‘t khÃ¡c. Sá»± kiÃªn trÃ¬ nhá» má»—i ngÃ y, duy trÃ¬ qua nhiá»u nÄƒm, táº¡o ra káº¿t quáº£ phi thÆ°á»ng."),
        pageBreak(),

        // â”€â”€ CHÆ¯Æ NG VI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("ChÆ°Æ¡ng VI: PhÃ¡t triá»ƒn táº­p thá»ƒ"),
        h2("6.1 KhÃ´ng ai phÃ¡t triá»ƒn má»™t mÃ¬nh"),
        p("CÃ³ má»™t huyá»n thoáº¡i nguy hiá»ƒm vá» 'thiÃªn tÃ i Ä‘Æ¡n Ä‘á»™c' â€” ngÆ°á»i má»™t mÃ¬nh trong gÃ¡c xÃ©p táº¡o ra nhá»¯ng Ä‘á»™t phÃ¡ vÄ© Ä‘áº¡i. Thá»±c táº¿, háº§u háº¿t nhá»¯ng thÃ nh tá»±u lá»›n cá»§a nhÃ¢n loáº¡i Ä‘á»u lÃ  káº¿t quáº£ cá»§a há»£p tÃ¡c. Newton nÃ³i: 'Náº¿u tÃ´i tháº¥y xa hÆ¡n, Ä‘Ã³ lÃ  vÃ¬ tÃ´i Ä‘á»©ng trÃªn vai nhá»¯ng ngÆ°á»i khá»•ng lá»“.'"),
        p("MÃ´i trÆ°á»ng vÃ  cá»™ng Ä‘á»“ng ta thuá»™c vá» áº£nh hÆ°á»Ÿng sÃ¢u sáº¯c Ä‘áº¿n tá»‘c Ä‘á»™ vÃ  hÆ°á»›ng phÃ¡t triá»ƒn cá»§a ta. NghiÃªn cá»©u cá»§a nhÃ  xÃ£ há»™i há»c Nicholas Christakis chá»‰ ra ráº±ng hÃ nh vi, cáº£m xÃºc vÃ  tháº­m chÃ­ cÃ¢n náº·ng cá»§a chÃºng ta bá»‹ áº£nh hÆ°á»Ÿng bá»Ÿi báº¡n bÃ¨ cá»§a báº¡n bÃ¨ cá»§a báº¡n bÃ¨ â€” tá»©c lÃ  ba báº­c káº¿t ná»‘i xÃ£ há»™i."),
        h2("6.2 XÃ¢y dá»±ng mÃ´i trÆ°á»ng phÃ¡t triá»ƒn"),
        p("Muá»‘n phÃ¡t triá»ƒn bá»n vá»¯ng, hÃ£y xÃ¢y dá»±ng má»™t mÃ´i trÆ°á»ng nÆ¡i sá»± phÃ¡t triá»ƒn lÃ  chuáº©n má»±c, khÃ´ng pháº£i ngoáº¡i lá»‡. Äiá»u nÃ y cÃ³ nghÄ©a lÃ : chá»§ Ä‘á»™ng tÃ¬m kiáº¿m nhá»¯ng ngÆ°á»i giá»i hÆ¡n mÃ¬nh Ä‘á»ƒ há»c há»i, Ä‘Ã³ng gÃ³p vÃ o cá»™ng Ä‘á»“ng thay vÃ¬ chá»‰ nháº­n, táº¡o ra khÃ´ng gian an toÃ n Ä‘á»ƒ thá»­ nghiá»‡m vÃ  tháº¥t báº¡i, vÃ  chia sáº» kiáº¿n thá»©c vÃ¬ dáº¡y ngÆ°á»i khÃ¡c lÃ  cÃ¡ch há»c tá»‘t nháº¥t."),
        pageBreak(),

        // â”€â”€ CHÆ¯Æ NG VII â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("ChÆ°Æ¡ng VII: Báº«y cá»§a sá»± phÃ¡t triá»ƒn"),
        h2("7.1 TÄƒng trÆ°á»Ÿng nháº§m hÆ°á»›ng"),
        p("KhÃ´ng pháº£i má»i sá»± tÄƒng trÆ°á»Ÿng Ä‘á»u dáº«n Ä‘áº¿n phÃ¡t triá»ƒn tá»‘t. Ung thÆ° lÃ  sá»± tÄƒng trÆ°á»Ÿng khÃ´ng kiá»ƒm soÃ¡t, phÃ¡ há»§y cÆ¡ thá»ƒ. Sá»± giÃ u cÃ³ khÃ´ng Ä‘i kÃ¨m vá»›i trÃ­ tuá»‡ vÃ  pháº©m giÃ¡ cÃ³ thá»ƒ lÃ m há»ng con ngÆ°á»i. Quyá»n lá»±c khÃ´ng Ä‘i kÃ¨m vá»›i trÃ¡ch nhiá»‡m táº¡o ra Ã¡p bá»©c. PhÃ¡t triá»ƒn cáº§n Ä‘Æ°á»£c Ä‘á»‹nh hÆ°á»›ng bá»Ÿi cÃ¡c giÃ¡ trá»‹ cá»‘t lÃµi."),
        h2("7.2 Báº«y hoÃ n háº£o chá»§ nghÄ©a"),
        p("HoÃ n háº£o chá»§ nghÄ©a (perfectionism) thÆ°á»ng Ä‘Æ°á»£c ngá»¥y trang nhÆ° má»™t Ä‘á»©c tÃ­nh. NhÆ°ng thá»±c cháº¥t, Ä‘Ã¢y lÃ  má»™t trong nhá»¯ng rÃ o cáº£n lá»›n nháº¥t cho sá»± phÃ¡t triá»ƒn. NgÆ°á»i theo Ä‘uá»•i sá»± hoÃ n háº£o thÆ°á»ng trÃ¬ hoÃ£n hÃ nh Ä‘á»™ng vÃ¬ sá»£ tháº¥t báº¡i, khÃ´ng chá»‹u há»c há»i tá»« pháº£n há»“i, kiá»‡t sá»©c vÃ¬ Ä‘áº·t tiÃªu chuáº©n khÃ´ng thá»±c táº¿, vÃ  bá» lá»¡ cÆ¡ há»™i vÃ¬ chá» Ä‘á»£i Ä‘iá»u kiá»‡n hoÃ n háº£o."),
        p("Thay vÃ o Ä‘Ã³, hÃ£y theo Ä‘uá»•i sá»± tiáº¿n bá»™ liÃªn tá»¥c. NhÆ° James Clear viáº¿t trong 'Atomic Habits': cáº£i thiá»‡n 1% má»—i ngÃ y trong má»™t nÄƒm sáº½ khiáº¿n báº¡n giá»i hÆ¡n 37 láº§n so vá»›i hiá»‡n táº¡i."),
        pageBreak(),

        // â”€â”€ CHÆ¯Æ NG VIII â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("ChÆ°Æ¡ng VIII: PhÃ¡t triá»ƒn trong ká»· nguyÃªn sá»‘"),
        h2("8.1 CÆ¡ há»™i chÆ°a tá»«ng cÃ³"),
        p("ChÆ°a bao giá» trong lá»‹ch sá»­ nhÃ¢n loáº¡i, con ngÆ°á»i láº¡i cÃ³ kháº£ nÄƒng tiáº¿p cáº­n kiáº¿n thá»©c vÃ  káº¿t ná»‘i vá»›i tháº¿ giá»›i dá»… dÃ ng nhÆ° ngÃ y nay. Má»™t ngÆ°á»i á»Ÿ lÃ ng quÃª Viá»‡t Nam cÃ³ thá»ƒ há»c tá»« giÃ¡o sÆ° Harvard, cá»™ng tÃ¡c vá»›i chuyÃªn gia á»Ÿ Berlin, hay bÃ¡n sáº£n pháº©m cho khÃ¡ch hÃ ng á»Ÿ Tokyo â€” táº¥t cáº£ tá»« chiáº¿c Ä‘iá»‡n thoáº¡i trong tay."),
        p("CÃ´ng nghá»‡ AI Ä‘ang thay Ä‘á»•i báº£n cháº¥t cá»§a nhiá»u cÃ´ng viá»‡c vÃ  ká»¹ nÄƒng. Nhá»¯ng gÃ¬ mÃ¡y mÃ³c cÃ³ thá»ƒ lÃ m tá»‘t hÆ¡n con ngÆ°á»i ngÃ y cÃ ng nhiá»u. Äiá»u nÃ y táº¡o ra Ã¡p lá»±c lá»›n nhÆ°ng cÅ©ng má»Ÿ ra khÃ´ng gian cho nhá»¯ng pháº©m cháº¥t thuáº§n tÃºy con ngÆ°á»i: sÃ¡ng táº¡o, empathy, kháº£ nÄƒng káº¿t ná»‘i Ã½ nghÄ©a, vÃ  trÃ­ tuá»‡ cáº£m xÃºc."),
        h2("8.2 ThÃ¡ch thá»©c cá»§a sá»± phÃ¢n tÃ¡n"),
        p("Máº·t trÃ¡i cá»§a ká»· nguyÃªn sá»‘ lÃ  sá»± phÃ¢n tÃ¡n chÆ°a tá»«ng cÃ³. Má»—i ngÃ y chÃºng ta nháº­n hÃ ng trÄƒm thÃ´ng bÃ¡o, hÃ ng nghÃ¬n máº£nh thÃ´ng tin. Attention economy â€” ná»n kinh táº¿ dá»±a trÃªn sá»± chÃº Ã½ â€” cáº¡nh tranh khá»‘c liá»‡t Ä‘á»ƒ chiáº¿m Ä‘oáº¡t tÃ i nguyÃªn quÃ½ giÃ¡ nháº¥t cá»§a ta: thá»i gian vÃ  sá»± táº­p trung. PhÃ¡t triá»ƒn trong ká»· nguyÃªn nÃ y Ä‘Ã²i há»i kháº£ nÄƒng báº£o vá»‡ sá»± táº­p trung nhÆ° báº£o vá»‡ tÃ i sáº£n quÃ½ giÃ¡."),
        pageBreak(),

        // â”€â”€ CHÆ¯Æ NG IX â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("ChÆ°Æ¡ng IX: Triáº¿t há»c vá» phÃ¡t triá»ƒn"),
        h2("9.1 Ã nghÄ©a Ä‘áº±ng sau sá»± thay Ä‘á»•i"),
        p("Cuá»‘i cÃ¹ng, cÃ¢u há»i quan trá»ng nháº¥t vá» phÃ¡t triá»ƒn khÃ´ng pháº£i lÃ  'lÃ m tháº¿ nÃ o' mÃ  lÃ  'Ä‘á»ƒ lÃ m gÃ¬'. PhÃ¡t triá»ƒn khÃ´ng cÃ³ Ä‘á»‹nh hÆ°á»›ng cÃ³ thá»ƒ trá»Ÿ thÃ nh sá»± cháº¡y Ä‘ua vÃ´ táº­n, khÃ´ng bao giá» cáº£m tháº¥y Ä‘á»§. Triáº¿t há»c Pháº­t giÃ¡o gá»i Ä‘Ã¢y lÃ  'tanha' â€” sá»± khao khÃ¡t khÃ´ng bao giá» Ä‘Æ°á»£c thá»a mÃ£n."),
        p("Aristotle Ä‘á» xuáº¥t khÃ¡i niá»‡m 'eudaimonia' â€” thÆ°á»ng Ä‘Æ°á»£c dá»‹ch lÃ  háº¡nh phÃºc nhÆ°ng chÃ­nh xÃ¡c hÆ¡n lÃ  'flourishing' â€” sá»± ná»Ÿ rá»™, phÃ¡t triá»ƒn Ä‘áº¿n má»©c hoÃ n chá»‰nh nháº¥t cá»§a tiá»m nÄƒng con ngÆ°á»i. ÄÃ¢y khÃ´ng pháº£i lÃ  cáº£m giÃ¡c vui sÆ°á»›ng thoÃ¡ng qua mÃ  lÃ  tráº¡ng thÃ¡i sÃ¢u sáº¯c hÆ¡n cá»§a viá»‡c sá»‘ng Ä‘Ãºng vá»›i báº£n cháº¥t vÃ  tiá»m nÄƒng cá»§a mÃ¬nh."),
        h2("9.2 PhÃ¡t triá»ƒn nhÆ° má»™t hÃ nh trÃ¬nh, khÃ´ng pháº£i Ä‘Ã­ch Ä‘áº¿n"),
        p("Má»™t trong nhá»¯ng nháº­n thá»©c sÃ¢u sáº¯c nháº¥t vá» phÃ¡t triá»ƒn lÃ  nháº­n ra ráº±ng Ä‘Ã³ lÃ  hÃ nh trÃ¬nh liÃªn tá»¥c, khÃ´ng cÃ³ Ä‘iá»ƒm káº¿t thÃºc. KhÃ´ng cÃ³ má»™t ngÃ y ta 'hoÃ n thÃ nh' viá»‡c phÃ¡t triá»ƒn. Ngay cáº£ nhá»¯ng ngÆ°á»i vÄ© Ä‘áº¡i nháº¥t cÅ©ng tiáº¿p tá»¥c há»c há»i vÃ  thay Ä‘á»•i cho Ä‘áº¿n hÆ¡i thá»Ÿ cuá»‘i cÃ¹ng."),
        p("Äiá»u nÃ y khÃ´ng nÃªn táº¡o ra sá»± lo Ã¢u mÃ  mang láº¡i sá»± giáº£i phÃ³ng. Ta khÃ´ng cáº§n pháº£i hoÃ n háº£o. Ta khÃ´ng cáº§n pháº£i 'Ä‘áº¿n nÆ¡i'. Ta chá»‰ cáº§n tiáº¿p tá»¥c bÆ°á»›c Ä‘i, há»c há»i, yÃªu thÆ°Æ¡ng vÃ  Ä‘Ã³ng gÃ³p â€” má»—i ngÃ y má»™t chÃºt tá»‘t hÆ¡n ngÃ y hÃ´m qua."),
        pageBreak(),

        // â”€â”€ Káº¾T LUáº¬N â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        h1("Káº¿t Luáº­n: Con Ä‘Æ°á»ng phÃ­a trÆ°á»›c"),
        p("PhÃ¡t triá»ƒn, á»Ÿ báº£n cháº¥t sÃ¢u xa nháº¥t cá»§a nÃ³, lÃ  sá»± thá»ƒ hiá»‡n Ä‘áº§y Ä‘á»§ nháº¥t cá»§a tiá»m nÄƒng con ngÆ°á»i. NÃ³ khÃ´ng pháº£i lÃ  cuá»™c Ä‘ua Ä‘á»ƒ Ä‘áº¿n trÆ°á»›c ngÆ°á»i khÃ¡c, khÃ´ng pháº£i lÃ  sá»± tÃ­ch lÅ©y danh hiá»‡u hay tÃ i sáº£n, khÃ´ng pháº£i lÃ  sá»± hoÃ n háº£o khÃ´ng tÃ¬ váº¿t."),
        p("PhÃ¡t triá»ƒn lÃ  quÃ¡ trÃ¬nh ta trá»Ÿ nÃªn ngÃ y cÃ ng hoÃ n chá»‰nh hÆ¡n â€” hiá»ƒu mÃ¬nh sÃ¢u hÆ¡n, yÃªu thÆ°Æ¡ng rá»™ng hÆ¡n, Ä‘Ã³ng gÃ³p nhiá»u hÆ¡n, sá»‘ng Ã½ nghÄ©a hÆ¡n. ÄÃ³ lÃ  hÃ nh trÃ¬nh tá»« ngÆ°á»i bá»‹ hoÃ n cáº£nh Ä‘iá»u khiá»ƒn Ä‘áº¿n ngÆ°á»i tá»± chá»§ trong cuá»™c sá»‘ng. Tá»« pháº£n á»©ng sang Ä‘Ã¡p láº¡i. Tá»« tá»“n táº¡i sang thá»±c sá»± sá»‘ng."),
        p("KhÃ´ng cÃ³ con Ä‘Æ°á»ng nÃ o giá»‘ng nhau. KhÃ´ng cÃ³ lá»‹ch trÃ¬nh nÃ o chuáº©n. Má»—i ngÆ°á»i cÃ³ Ä‘iá»ƒm xuáº¥t phÃ¡t khÃ¡c nhau, Ä‘iá»ƒm Ä‘áº¿n khÃ¡c nhau, vÃ  hÃ nh trÃ¬nh khÃ¡c nhau. Äiá»u duy nháº¥t quan trá»ng lÃ  báº¯t Ä‘áº§u â€” vÃ  tiáº¿p tá»¥c."),
        p("Bá»Ÿi vÃ¬ cuá»‘i cÃ¹ng, nhÆ° LÃ£o Tá»­ Ä‘Ã£ viáº¿t tá»« hÆ¡n hai nghÃ¬n nÄƒm trÆ°á»›c: 'HÃ nh trÃ¬nh ngÃ n dáº·m báº¯t Ä‘áº§u tá»« má»™t bÆ°á»›c chÃ¢n.'"),

        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 600, after: 200 },
          children: [new TextRun({ text: "â€” Háº¿t â€”", italics: true, size: SIZE_BODY, font: FONT, color: "888888" })],
        }),
      ],
    },
  ],
});

const outputPath = path.join(process.cwd(), "workspace", "ban-chat-phat-trien.docx");
const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outputPath, buffer);
console.log("Done:", outputPath, `(${(buffer.length / 1024).toFixed(1)} KB)`);


