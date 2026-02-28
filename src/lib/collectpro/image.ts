// ─────────────────────────────────────────────────────────────────────────────
// CollectPro — Image utilities
//
// compressImage   — compress File to ≤ targetKB, returns base64 data URL
// uploadCardImage — compress + upload to Supabase Storage, returns public URL
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from "@/integrations/supabase/client";

const BUCKET = "collectpro-images";

/** Compress image file to a JPEG ≤ targetKB. Returns base64 data URL. */
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

/**
 * Compress a card image and upload it to Supabase Storage.
 * Returns the public URL of the uploaded file.
 *
 * Path format: `{userId}/{itemId}.jpg`
 * If itemId is not yet known (new item), pass a temp UUID — caller can rename later.
 */
export async function uploadCardImage(file: File, pathKey: string): Promise<string> {
  // 1. Compress to data URL
  const dataUrl = await compressImage(file, 120);

  // 2. Convert data URL → Blob
  const res  = await fetch(dataUrl);
  const blob = await res.blob();

  // 3. Upload to Supabase Storage (upsert so re-uploads overwrite)
  const path = `${pathKey}.jpg`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  // 4. Return public URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
