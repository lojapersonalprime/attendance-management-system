import { PageHeader } from "@/components/layout/page-header";
import { getPrisma } from "@/lib/db/prisma";

export default async function SettingsPage() {
  const devices = await getPrisma().device.findMany({ orderBy: { name: "asc" } });
  return <><PageHeader title="Configurações" description="Parâmetros de tolerância, excedentes, limites de arquivo e equipamentos." /><section className="rounded-lg border bg-white p-5"><h2 className="font-semibold">Políticas iniciais</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">Upload máximo de 10 MB; tolerância de zero minuto; excedentes ficam pendentes de validação e não são aprovados automaticamente.</p></section><section className="mt-5 rounded-lg border bg-white p-5"><h2 className="font-semibold">Equipamentos</h2>{devices.length === 0 ? <p className="mt-2 text-sm text-[var(--muted-foreground)]">Nenhum equipamento identificado. O primeiro TXT AttendLog criará o dispositivo pelo DeviceUID.</p> : <ul className="mt-3 divide-y">{devices.map((device) => <li className="py-3 text-sm" key={device.id}><span className="font-medium">{device.name}</span> · {device.deviceUid} · {device.active ? "ativo" : "inativo"}</li>)}</ul>}</section></>;
}
