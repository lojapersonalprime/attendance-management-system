import { ImportUploader } from "@/components/imports/import-uploader";
import { PageHeader } from "@/components/layout/page-header";
import { formatInTimeZone } from "date-fns-tz";
import { getPrisma } from "@/lib/db/prisma";

export default async function ImportsPage() {
  const imports = await getPrisma().importFile.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { device: { select: { name: true, deviceUid: true } }, importedBy: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader title="Importações" description="Analise o TXT, confirme a importação e preserve o arquivo original em bucket privado." />
      <ImportUploader />
      <section className="mt-7 rounded-lg border bg-white p-6">
        <h2 className="font-semibold">Histórico de importações</h2>
        {imports.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">Nenhuma importação concluída ainda.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                <tr><th className="px-2 py-3">Arquivo</th><th className="px-2 py-3">Dispositivo</th><th className="px-2 py-3">Período</th><th className="px-2 py-3">Resultado</th><th className="px-2 py-3">Importado por</th></tr>
              </thead>
              <tbody>
                {imports.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-2 py-3 font-medium">{item.originalFilename}</td>
                    <td className="px-2 py-3">{item.device.deviceUid}</td>
                    <td className="px-2 py-3">{item.earliestPunchAt && item.latestPunchAt ? `${formatInTimeZone(item.earliestPunchAt, "America/Fortaleza", "dd/MM/yyyy")} a ${formatInTimeZone(item.latestPunchAt, "America/Fortaleza", "dd/MM/yyyy")}` : "Não identificado"}</td>
                    <td className="px-2 py-3">{item.acceptedRows - item.duplicatedRows} novos · {item.duplicatedRows} duplicados · {item.rejectedRows} rejeitados</td>
                    <td className="px-2 py-3">{item.importedBy?.name ?? "Não informado"}</td>
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
