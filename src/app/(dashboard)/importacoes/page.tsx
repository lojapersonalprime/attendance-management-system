import { ImportUploader } from "@/components/imports/import-uploader";
import { PageHeader } from "@/components/layout/page-header";
import { formatBusinessDate } from "@/lib/dates/business";
import { getPrisma } from "@/lib/db/prisma";
import { requireActiveProfile } from "@/modules/auth/server/session";
import { confirmImportCoverageAction } from "@/app/(dashboard)/importacoes/actions";
import { getCalculationRunStatusLabel } from "@/lib/presentation/labels";
import { AsyncFeedback, LoadingButton } from "@/components/ui/async-feedback";

function importStatusLabel(status: "PROCESSING" | "COMPLETED" | "FAILED" | "DUPLICATE") {
  return status === "COMPLETED" ? "Concluído" : status === "FAILED" ? "Falhou" : status === "DUPLICATE" ? "Concluído" : "Processando";
}

export default async function ImportsPage({ searchParams }: { searchParams: Promise<{ sucesso?: string; erro?: string }> }) {
  const [profile, query, imports] = await Promise.all([requireActiveProfile(), searchParams, getPrisma().importFile.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { device: { select: { name: true } }, importedBy: { select: { name: true } }, calculationRuns: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, processedDays: true, failedDays: true } } },
  })]);
  const canManage = profile.role === "RH_ADMIN";
  const errorMessage = query.erro === "motivo-obrigatorio" ? "Informe um motivo com pelo menos 3 caracteres." : query.erro === "periodo-invalido" ? "A data final não pode ser anterior à data inicial." : query.erro ? "Revise os dados da confirmação de cobertura." : undefined;

  return (
    <>
      <PageHeader title="Importar ponto" description="Envie o arquivo retirado do relógio para atualizar os registros do período." />
      <div className="mb-4"><AsyncFeedback error={errorMessage} status={errorMessage ? "error" : query.sucesso ? "success" : undefined} success={query.sucesso} /></div>
      <ImportUploader />
      <section className="mt-7 rounded-lg border bg-white p-6">
        <div><h2 className="font-semibold">Histórico de importações</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Consulte arquivos anteriores e confirme o período identificado quando necessário.</p></div>
        {imports.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Nenhuma importação concluída ainda.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                <tr><th className="px-2 py-3">Arquivo</th><th className="px-2 py-3">Período identificado</th><th className="px-2 py-3">Data da importação</th><th className="px-2 py-3">Registros</th><th className="px-2 py-3">Situação</th><th className="px-2 py-3">Ação</th></tr>
              </thead>
              <tbody>
                {imports.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-2 py-3 font-medium"><span className="block">{item.originalFilename}</span><span className="mt-1 block text-xs font-normal text-[var(--muted-foreground)]">{item.device.name}</span></td>
                    <td className="px-2 py-3">{item.coverageFrom && item.coverageTo ? `${formatBusinessDate(item.coverageFrom, "dd/MM/yyyy")} a ${formatBusinessDate(item.coverageTo, "dd/MM/yyyy")}` : "Aguardando análise"}<span className="mt-1 block text-xs text-[var(--muted-foreground)]">{item.coverageStatus === "CONFIRMED" ? "Período confirmado" : "Confirmação do RH pendente"}</span></td>
                    <td className="px-2 py-3">{formatBusinessDate(item.createdAt, "dd/MM/yyyy")}</td>
                    <td className="px-2 py-3">{item.acceptedRows - item.duplicatedRows} novos · {item.duplicatedRows} duplicados</td>
                    <td className="px-2 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "COMPLETED" ? "bg-emerald-50 text-emerald-800" : item.status === "FAILED" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>{importStatusLabel(item.status)}</span><span className="mt-1 block text-xs text-[var(--muted-foreground)]">{item.calculationRuns[0] ? `${getCalculationRunStatusLabel(item.calculationRuns[0].status)} · ${item.calculationRuns[0].processedDays} dias` : item.coverageStatus === "CONFIRMED" ? "Cálculo aguardando atualização" : "Aguardando confirmação"}</span></td>
                    <td className="px-2 py-3">{canManage ? <form action={confirmImportCoverageAction} className="grid min-w-64 gap-1"><input type="hidden" name="importFileId" value={item.id} /><label className="text-xs">Data inicial<input className="input" required type="date" name="coverageFrom" defaultValue={item.coverageFrom?.toISOString().slice(0, 10) ?? item.earliestPunchAt?.toISOString().slice(0, 10) ?? ""} aria-label={`Início do período de ${item.originalFilename}`} /></label><label className="text-xs">Data final<input className="input" required type="date" name="coverageTo" defaultValue={item.coverageTo?.toISOString().slice(0, 10) ?? item.latestPunchAt?.toISOString().slice(0, 10) ?? ""} aria-label={`Fim do período de ${item.originalFilename}`} /></label><label className="text-xs">Justificativa<input className="input" required minLength={3} name="reason" placeholder="Ex.: período completo exportado" /></label><LoadingButton className="mt-1 min-h-8 px-2 py-1 text-xs" loadingLabel="Salvando período…">{item.coverageStatus === "CONFIRMED" ? "Corrigir período" : "Confirmar período"}</LoadingButton></form> : item.importedBy?.name ?? "Não informado"}</td>
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
