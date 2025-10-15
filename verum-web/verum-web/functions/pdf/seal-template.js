import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Generate a sealed verification PDF with a watermark, QR code and summary block.
 *
 * @param {Object} options - Options for the PDF.
 * @param {string} options.hash - The SHA-512 hash of the evidence.
 * @param {string} options.title - Title for the document.
 * @param {string} options.notes - Optional notes.
 * @param {string} options.logoPath - Path to the logo to embed.
 * @param {string} options.productId - Identifier for the product/version.
 * @param {Object|null} options.receipt - Optional receipt object with txid, chain and issuedAt.
 * @returns {PDFDocument} The PDF document instance (caller should pipe it).
 */
export async function makeSealedPdf({ hash, title, notes, logoPath, productId, receipt }) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, left: 56, right: 56, bottom: 56 }
  });

  // Embed a font if available (optional)
  const fontPath = path.join(__dirname, "fonts", "DejaVuSans.ttf");
  if (fs.existsSync(fontPath)) {
    doc.registerFont("DejaVuSans", fontPath);
  }

  // Header logo (centered)
  if (fs.existsSync(logoPath)) {
    const { width } = doc.page;
    const logoW = 140;
    const x = (width - logoW) / 2;
    doc.image(logoPath, x, 24, { width: logoW });
  }

  // Watermark (logo or fallback text)
  if (fs.existsSync(logoPath)) {
    const { width, height } = doc.page;
    const wmW = 360;
    const wmX = (width - wmW) / 2;
    const wmY = (height - wmW) / 2;
    doc.save().opacity(0.08).image(logoPath, wmX, wmY, { width: wmW }).restore();
  } else {
    doc.save().opacity(0.06)
      .font("DejaVuSans")
      .fontSize(96)
      .rotate(-25, { origin: [300, 400] })
      .text("VERUM OMNIS", 120, 300, { align: "center" })
      .rotate(25)
      .restore();
  }

  doc.moveDown(4);

  // Title
  doc.font("DejaVuSans").fillColor("#000").fontSize(18).text(title || "Sealed Verification", { align: "center" });
  doc.moveDown(1);

  // Visible hash
  doc.fontSize(10).text("SHA-512:", { continued: true }).font("DejaVuSans").text(` ${hash}`);
  doc.moveDown(0.5);

  // Receipt summary
  const trunc = (s) => (s ? s.slice(0, 16) + "…" : "");
  doc.fontSize(10).text(`Product: ${productId}`);
  if (receipt?.txid) doc.text(`Anchor: ${receipt.chain || "eth"} / ${trunc(receipt.txid)}`);
  if (receipt?.issuedAt) doc.text(`Issued: ${receipt.issuedAt}`);
  doc.moveDown(0.5);

  // Optional notes
  if (notes) {
    doc.moveDown(0.5);
    doc.fontSize(11).text("Notes:", { underline: true });
    doc.fontSize(10).text(notes);
  }

  // QR code payload summarising the receipt
  const qrPayload = {
    verum: true,
    hash,
    productId,
    receipt: receipt ? { chain: receipt.chain, txid: receipt.txid, issuedAt: receipt.issuedAt } : null
  };
  const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrPayload));
  const qrBuf = Buffer.from(qrDataUrl.split(",")[1], "base64");

  // Certification block in bottom-right
  const { width, height } = doc.page;
  const blockW = 240, blockH = 110;
  const x = width - blockW - 56;
  const y = height - blockH - 56;

  doc.roundedRect(x, y, blockW, blockH, 12).lineWidth(1).stroke();
  doc.image(qrBuf, x + 8, y + 8, { width: 90 });
  doc.font("DejaVuSans").fontSize(10).fillColor("#000");
  doc.text("✔ Patent Pending Verum Omnis", x + 110, y + 14);
  doc.text(`Hash: ${hash.slice(0, 16)}…`, x + 110, y + 30);
  if (receipt?.txid) doc.text(`TX: ${trunc(receipt.txid)}`, x + 110, y + 46);
  doc.text("This document is sealed and tamper-evident.", x + 110, y + 62);

  doc.end();
  return doc;
}