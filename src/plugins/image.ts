// generate_image tool — tạo ảnh bằng Hugging Face Inference API (miễn phí)
// Model: stabilityai/stable-diffusion-xl-base-1.0
// Đăng ký token miễn phí tại: https://huggingface.co/settings/tokens

const HF_API_URL =
  "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0";

export interface GeneratedImage {
  buffer: Buffer;
  revisedPrompt: string;
}

/**
 * Tạo ảnh từ text prompt bằng Hugging Face Inference API.
 * apiKey = HF token (miễn phí tại huggingface.co/settings/tokens).
 * Trả về Buffer ảnh, hoặc throw nếu lỗi.
 */
export async function generateImage(
  prompt: string,
  apiKey: string,
  _size: "1024x1024" | "1792x1024" | "1024x1792" = "1024x1024"
): Promise<GeneratedImage> {
  if (!apiKey) {
    throw new Error(
      "IMAGE_API_KEY chưa được cấu hình.\n" +
      "Lấy token miễn phí tại: https://huggingface.co/settings/tokens\n" +
      "Sau đó thêm vào .env: IMAGE_API_KEY=hf_xxx"
    );
  }

  const resp = await fetch(HF_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: prompt }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    // Model đang load — HF cần ~20-60s khởi động model lần đầu
    if (resp.status === 503) {
      throw new Error("Model đang khởi động, thử lại sau 30 giây.");
    }
    throw new Error(`Hugging Face API lỗi: HTTP ${resp.status} — ${text.slice(0, 200)}`);
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  return { buffer: buf, revisedPrompt: prompt };
}

/**
 * @deprecated Không còn cần thiết — generateImage trả về Buffer trực tiếp.
 */
export async function downloadImage(url: string): Promise<Buffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Không download được ảnh: HTTP ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}
