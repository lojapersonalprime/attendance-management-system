import { z } from "zod";

export const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

const uploadNameSchema = z
  .string()
  .min(1)
  .max(180)
  .refine((name) => /\.txt$/i.test(name), "Selecione um arquivo TXT.");

export function sanitizeFilename(filename: string): string {
  const extension = filename.toLowerCase().endsWith(".txt") ? ".txt" : "";
  const base = filename
    .slice(0, extension ? -extension.length : filename.length)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return `${base || "attendance-import"}${extension || ".txt"}`;
}

export async function readAndValidateUpload(file: File, maxBytes = DEFAULT_MAX_UPLOAD_BYTES) {
  uploadNameSchema.parse(file.name);
  if (file.size === 0) throw new Error("O arquivo está vazio.");
  if (file.size > maxBytes) throw new Error(`O arquivo excede o limite de ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
  return {
    originalFilename: file.name,
    safeFilename: sanitizeFilename(file.name),
    content: Buffer.from(await file.arrayBuffer()),
  };
}
