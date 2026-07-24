import { NextResponse } from "next/server";
import { toBusinessDate } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { getAuthenticatedUser } from "@/modules/auth/server/session";
import { readAndValidateUpload } from "@/modules/imports/application/upload-validation";
import { previewImport } from "@/modules/imports/application/preview";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Selecione um arquivo TXT." }, { status: 400 });
    const upload = await readAndValidateUpload(file);
    const { fileHash, parsed } = previewImport(upload.content);
    const [existingFile, existingRows] = await Promise.all([
      getPrisma().importFile.findUnique({ where: { fileHash }, select: { id: true, status: true } }),
      parsed.punches.length > 0 ? getPrisma().rawPunch.count({ where: { fingerprint: { in: parsed.punches.map((punch) => punch.fingerprint) } } }) : 0,
    ]);
    const dates = parsed.punches.map((punch) => punch.occurredAt).sort((left, right) => left.getTime() - right.getTime());
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    return NextResponse.json({
      fileHash,
      deviceUid: parsed.metadata.deviceUid,
      deviceModel: parsed.metadata.deviceModel,
      dataType: parsed.metadata.dataType,
      declaredLogCount: parsed.metadata.declaredLogCount,
      totalRows: parsed.totalDataRows,
      validRows: parsed.punches.length,
      rejectedRows: parsed.errors.filter((error) => error.rowNumber > 0).length,
      existingRows,
      newRows: Math.max(0, parsed.punches.length - existingRows),
      identifiedEmployees: new Set(parsed.punches.map((punch) => punch.externalEmployeeNumber)).size,
      earliestBusinessDate: firstDate ? toBusinessDate(firstDate) : null,
      latestBusinessDate: lastDate ? toBusinessDate(lastDate) : null,
      duplicateFile: Boolean(existingFile && existingFile.status === "COMPLETED"),
      errors: parsed.errors.map(({ rowNumber, errorCode, message }) => ({ rowNumber, errorCode, message })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível analisar o arquivo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
