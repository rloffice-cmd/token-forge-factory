// ─────────────────────────────────────────────────────────────────────────────
// CollectPro — Image utilities
// Compresses an uploaded image to ≤ targetKB before base64 storage.
// ─────────────────────────────────────────────────────────────────────────────

export function compressImage(file: File, targetKB = 120): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const MAX_DIM = 800;
        let w = img.width;
        let h = img.height;
        if (w > MAX_DIM || h > MAX_DIM) {
          const r = Math.min(MAX_DIM / w, MAX_DIM / h);
          w = Math.round(w * r);
          h = Math.round(h * r);
        }
        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);

        let quality = 0.85;
        const compress = (): string => {
          const url  = canvas.toDataURL("image/jpeg", quality);
          const size = Math.round((url.length * 3) / 4 / 1024);
          if (size > targetKB && quality > 0.2) {
            quality = Math.max(0.2, quality - 0.1);
            return compress();
          }
          return url;
        };
        resolve(compress());
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  });
}
