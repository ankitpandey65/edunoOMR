import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type PdfPageRenderer = {
  totalPages: number;
  renderPage(pageNum: number): Promise<Buffer>;
  dispose(): Promise<void>;
};

/**
 * Create a PDF page renderer for OMR processing.
 * Pages are rendered on demand to reduce memory usage for large PDFs.
 */
export async function createPdfPageRenderer(pdfBuffer: Buffer): Promise<PdfPageRenderer> {
  const tempRoot = await mkdtemp(path.join(tmpdir(), "eduno-omr-"));
  const pdfPath = path.join(tempRoot, "input.pdf");
  await writeFile(pdfPath, pdfBuffer);

  const countScript = [
    "import fitz,sys",
    "doc=fitz.open(sys.argv[1])",
    "print(doc.page_count)",
  ].join(";");

  let totalPages = 0;
  try {
    const { stdout } = await execFileAsync("python3", ["-c", countScript, pdfPath], {
      maxBuffer: 5 * 1024 * 1024,
    });
    totalPages = Number(String(stdout).trim() || "0");
  } catch (e) {
    await rm(tempRoot, { recursive: true, force: true });
    throw new Error(
      "Failed to open PDF with Python renderer. Ensure PyMuPDF is installed (python3 -m pip install pymupdf)."
    );
  }

  const renderScaleRaw = Number(process.env.OMR_PDF_RENDER_SCALE ?? "3");
  const renderScale = Number.isFinite(renderScaleRaw)
    ? Math.max(1.5, Math.min(4, renderScaleRaw))
    : 3;

  return {
    totalPages,
    async renderPage(pageNum: number) {
      if (pageNum < 1 || pageNum > totalPages) {
        throw new Error(`Invalid page number ${pageNum}`);
      }
      const renderScript = [
        "import fitz,sys",
        "doc=fitz.open(sys.argv[1])",
        "idx=int(sys.argv[2])-1",
        "scale=float(sys.argv[3])",
        "page=doc.load_page(idx)",
        "pix=page.get_pixmap(matrix=fitz.Matrix(scale,scale), alpha=False)",
        "sys.stdout.buffer.write(pix.tobytes('png'))",
      ].join(";");
      const { stdout } = await execFileAsync(
        "python3",
        ["-c", renderScript, pdfPath, String(pageNum), String(renderScale)],
        { encoding: "buffer", maxBuffer: 50 * 1024 * 1024 }
      );
      return Buffer.from(stdout as Buffer);
    },
    async dispose() {
      await rm(tempRoot, { recursive: true, force: true });
    },
  };
}
