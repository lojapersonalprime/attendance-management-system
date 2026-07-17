import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatDashboardMinutes, getDashboardData } from "@/modules/dashboard/server/get-dashboard-data";

export default async function DashboardPage() {
  const dashboard = await getDashboardData();
  const cards = [
    ["Última importação", dashboard.latestImportLabel, dashboard.latestImportHint],
    ["Funcionários encontrados", String(dashboard.employeeCount), "Inclui cadastros provisórios"],
    ["Cadastros pendentes", String(dashboard.provisionalEmployeeCount), "Vinculados pelo EnNo do relógio"],
    ["Inconsistências abertas", String(dashboard.openInconsistencyCount), "Dias críticos não podem ser fechados"],
    ["Dias regulares", String(dashboard.regularDayCount), "Na competência atual"],
    ["Horas positivas", formatDashboardMinutes(dashboard.positiveMinutes), "Excedentes exigem validação do RH"],
    ["Horas negativas", formatDashboardMinutes(dashboard.negativeMinutes), "Saldo negativo na competência atual"],
    ["Arquivos importados", String(dashboard.importedFileCount), `Competência ${dashboard.currentPeriodStatus.toLowerCase()}`],
  ] as const;

  return (
    <>
      <PageHeader title="Visão geral" description="Acompanhe a situação após a última importação manual." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, hint]) => <StatCard key={label} label={label} value={value} hint={hint} />)}
      </div>
      <section className="mt-7 rounded-lg border border-orange-200 bg-orange-50 p-5">
        <h2 className="font-semibold text-orange-950">Próximo passo</h2>
        <p className="mt-1 text-sm text-orange-900">Selecione um relatório TXT do relógio em Importações. O arquivo original será preservado em armazenamento privado antes de gravar as marcações.</p>
      </section>
    </>
  );
}
