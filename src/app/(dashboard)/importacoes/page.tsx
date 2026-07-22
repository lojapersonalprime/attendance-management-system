import { ImportUploader } from "@/components/imports/import-uploader";
import { PageHeader } from "@/components/layout/page-header";
import { formatInTimeZone } from "date-fns-tz";
import { getPrisma } from "@/lib/db/prisma";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { confirmImportCoverageAction } from "@/app/(dashboard)/importacoes/actions";

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const [profile, query, imports] = await Promise.all([requireActiveProfile(), searchParams, getPrisma().importFile.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { device: { select: { name: true, deviceUid: true } }, importedBy: { select: { name: true } }, calculationRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, processedDays: true, failedDays: true } } },
  })]);
  const canManage = profile.role === "RH_ADMIN";

  return (
    <>
      <PageHeader title="Importações" description="Analise o TXT, confirme a importação e preserve o arquivo original em bucket privado." />
      {query.sucesso ? <p role="status" className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{query.sucesso}</p> : null}
      {query.erro ? <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">{query.erro}</p> : null}
      <ImportUploader />
      <section className="mt-7 rounded-lg border bg-white p-6">
        <h2 className="font-semibold">Histórico de importações</h2>
        {imports.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Nenhuma importação concluída ainda.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                <tr><th className="px-2 py-3">Arquivo</th><th className="px-2 py-3">Dispositivo</th><th className="px-2 py-3">Cobertura</th><th className="px-2 py-3">Resultado físico</th><th className="px-2 py-3">Cálculo</th><th className="px-2 py-3">Confirmação RH</th></tr>
              </thead>
              <tbody>
                {imports.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-2 py-3 font-medium">{item.originalFilename}</td>
                    <td className="px-2 py-3">{item.device.deviceUid}</td>
                    <td className="px-2 py-3">{item.coverageFrom && item.coverageTo ? `${formatInTimeZone(item.coverageFrom, "America/Fortaleza", "dd/MM/yyyy")} a ${formatInTimeZone(item.coverageTo, "America/Fortaleza", "dd/MM/yyyy")} · ${item.coverageStatus === "CONFIRMED" ? "confirmada" : "sugerida"}` : "Aguardando sugestão"}</td>
                    <td className="px-2 py-3">{item.acceptedRows - item.duplicatedRows} novos · {item.duplicatedRows} duplicados · {item.rejectedRows} rejeitados</td>
                    <td className="px-2 py-3">{item.calculationRuns[0] ? `${item.calculationRuns[0].status} · ${item.calculationRuns[0].processedDays} dias · ${item.calculationRuns[0].failedDays} falhas` : "Ainda não iniciado"}</td>
                    <td className="px-2 py-3">{canManage ? <form action={confirmImportCoverageAction} className="grid min-w-64 gap-1"><input type="hidden" name="importFileId" value={item.id} /><input className="input" type="date" name="coverageFrom" defaultValue={item.coverageFrom?.toISOString().slice(0, 10) ?? item.earliestPunchAt?.toISOString().slice(0, 10) ?? ""} aria-label={`Início da cobertura de ${item.originalFilename}`} /><input className="input" type="date" name="coverageTo" defaultValue={item.coverageTo?.toISOString().slice(0, 10) ?? item.latestPunchAt?.toISOString().slice(0, 10) ?? ""} aria-label={`Fim da cobertura de ${item.originalFilename}`} /><input className="input" name="reason" placeholder="Motivo da confirmação" /><button className="rounded border px-2 py-1 text-xs font-semibold" type="submit">{item.coverageStatus === "CONFIRMED" ? "Corrigir cobertura" : "Confirmar cobertura"}</button></form> : item.importedBy?.name ?? "Não informado"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
