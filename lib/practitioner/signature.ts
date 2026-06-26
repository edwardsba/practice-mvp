import { createAdminClient } from "@/lib/supabase/admin"

const BUCKET = "signature-images"

export async function getSignatureAsDataUrl(
  path: string
): Promise<string | null> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.storage.from(BUCKET).download(path)

    if (error || !data) return null

    const buffer = Buffer.from(await data.arrayBuffer())
    const base64 = buffer.toString("base64")
    const ext = path.split(".").pop() ?? "png"
    const mimeType =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : "image/png"

    return `data:${mimeType};base64,${base64}`
  } catch {
    return null
  }
}
