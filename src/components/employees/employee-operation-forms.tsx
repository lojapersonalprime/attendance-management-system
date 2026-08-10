"use client";

import { useFormStatus } from "react-dom";
import { LoadingButton } from "@/components/ui/async-feedback";

type ServerAction = (formData: FormData) => void | Promise<void>;
type NamedOption = { id: string; name: string };

export function ProfessionalDeviceLinkForm({ action, employeeId, devices }: { action: ServerAction; employeeId: string; devices: NamedOption[] }) {
  return <form action={action} className="grid gap-3 rounded-xl border bg-white p-5 shadow-sm md:grid-cols-2"><h2 className="md:col-span-2 text-lg font-semibold">Adicionar vínculo com o relógio</h2><input name="employeeId" type="hidden" value={employeeId} /><label className="grid gap-1 text-sm font-medium">Dispositivo<select className="input" name="deviceId"><option value="">Selecione</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Código no relógio<input className="input" name="externalEmployeeNumber" /></label><label className="grid gap-1 text-sm font-medium">Início<input className="input" name="validFrom" type="date" /></label><OperationHint steps={["Validando vínculo…", "Salvando vínculo…", "Atualizando o registro do ponto…"]} /><LoadingButton loadingLabel="Salvando vínculo…">Salvar vínculo</LoadingButton></form>;
}

export function EmploymentPolicyForm({ action, employeeId, employmentType, policies, outlined = false }: { action: ServerAction; employeeId: string; employmentType: string; policies: NamedOption[]; outlined?: boolean }) {
  return <details className="rounded-xl border bg-white p-5 shadow-sm"><summary className="cursor-pointer text-sm font-semibold text-[var(--primary)]">Alterar vínculo ou política de cálculo</summary><form action={action} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><input name="employeeId" type="hidden" value={employeeId} /><label className="grid gap-1 text-sm font-medium">Tipo de vínculo<select className="input" defaultValue={employmentType} name="employmentType"><option value="EMPLOYEE">CLT/Funcionário</option><option value="INTERN">Estagiário</option><option value="APPRENTICE">Jovem aprendiz</option><option value="CONTRACTOR">PJ/Prestador</option><option value="OTHER">Outro</option></select></label><label className="grid gap-1 text-sm font-medium">Política<select className="input" name="calculationPolicyId"><option value="">Selecione</option>{policies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Início<input className="input" name="validFrom" type="date" /></label><label className="grid gap-1 text-sm font-medium">Fim (opcional)<input className="input" name="validUntil" type="date" /></label><label className="grid gap-1 text-sm font-medium md:col-span-2">Motivo<input className="input" name="reason" placeholder="Ex.: alteração contratual confirmada pelo RH" /></label><label className="flex items-center gap-2 text-sm"><input name="closePrevious" type="checkbox" />Encerrar vínculo anterior</label><label className="flex items-center gap-2 text-sm"><input name="retroactiveConfirmed" type="checkbox" />Confirmo a alteração retroativa</label><OperationHint steps={["Validando período…", "Salvando vínculo e política…", "Recalculando o período afetado…"]} /><LoadingButton className={outlined ? "border bg-white text-slate-900 hover:bg-slate-50" : undefined} loadingLabel="Salvando vínculo…">Salvar vínculo e política</LoadingButton></form></details>;
}

export function ScheduleAssignmentForm({ action, employeeId, schedules, currentScheduleName }: { action: ServerAction; employeeId: string; schedules: NamedOption[]; currentScheduleName?: string }) {
  return <form action={action} className="grid gap-3 rounded-xl border bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)] md:col-span-2 xl:col-span-3">Alterar configuração</p><h2 className="md:col-span-2 xl:col-span-3 text-lg font-semibold">Trocar modelo de horário</h2><p className="md:col-span-2 xl:col-span-3 text-sm text-[var(--muted-foreground)]">A nova vigência preserva o histórico. Se o recálculo falhar, a atribuição continua salva e pode ser tentada novamente.</p><input name="employeeId" type="hidden" value={employeeId} /><label className="grid gap-1 text-sm font-medium">Novo modelo<select className="input" name="scheduleTemplateId"><option value="">Selecione</option>{schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.name}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Início da vigência<input className="input" name="validFrom" type="date" /></label><label className="grid gap-1 text-sm font-medium">Fim (opcional)<input className="input" name="validUntil" type="date" /></label><label className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><input name="closePrevious" type="checkbox" />Encerrar o modelo atual no dia anterior</label><label className="flex items-center gap-2 text-sm"><input name="retroactiveConfirmed" type="checkbox" />Confirmo a alteração retroativa</label><label className="flex items-center gap-2 text-sm"><input defaultChecked name="recalculate" type="checkbox" />Solicitar recálculo dos dias afetados</label><label className="grid gap-1 text-sm font-medium">Recálculo até<input className="input" name="recalculateUntil" type="date" /></label><label className="grid gap-1 text-sm font-medium md:col-span-2">Motivo<input className="input" name="reason" placeholder="Ex.: horário da manhã confirmado pelo RH" /></label><div className="rounded-lg bg-orange-50 p-3 text-sm text-orange-950 md:col-span-2 xl:col-span-3"><p className="font-semibold">Impacto previsto</p><p className="mt-1">Modelo anterior: {currentScheduleName ?? "nenhum"}. Meses fechados e dias sem cobertura continuam protegidos.</p></div><OperationHint steps={["Validando período…", "Salvando modelo de horário…", "Recalculando registros…"]} /><LoadingButton loadingLabel="Salvando modelo e recalculando…">Salvar modelo e solicitar recálculo</LoadingButton></form>;
}

export function EmployeeRecalculationForm({ action, employeeId }: { action: ServerAction; employeeId: string }) {
  return <form action={action} className="grid gap-3 rounded-xl border bg-white p-5 shadow-sm md:grid-cols-3"><h2 className="md:col-span-3 text-lg font-semibold">Recalcular período</h2><input name="employeeId" type="hidden" value={employeeId} /><label className="grid gap-1 text-sm font-medium">Data inicial<input className="input" name="validFrom" type="date" /></label><label className="grid gap-1 text-sm font-medium">Data final<input className="input" name="validUntil" type="date" /></label><label className="grid gap-1 text-sm font-medium">Motivo<input className="input" name="reason" /></label><OperationHint steps={["Validando período…", "Recalculando registros…", "Atualizando saldos e pendências…"]} /><LoadingButton loadingLabel="Recalculando registros…">Prévia e recálculo controlado</LoadingButton></form>;
}

type MobileAccess = {
  active: boolean;
  pinConfiguredAt: Date | null;
  profile: { email: string; active: boolean; role: "EMPLOYEE" | "RH_ADMIN" | "RH_ANALYST" };
  allowedUnit: { id: string; name: string };
  authorizedLocation: { id: string; name: string; active: boolean; unitId: string } | null;
};

type AuthorizedLocationOption = { id: string; name: string };

export function EmployeeMobileAccessCard({
  accountAction,
  activationAction,
  access: accessValue,
  canManage,
  employeeId,
  employeeIsEligible,
  locations,
  locationAction,
  pinAction,
  unitName,
}: {
  accountAction: ServerAction;
  activationAction: ServerAction;
  access?: MobileAccess | null;
  canManage: boolean;
  employeeId: string;
  employeeIsEligible: boolean;
  locations: AuthorizedLocationOption[];
  locationAction: ServerAction;
  pinAction: ServerAction;
  unitName?: string;
}) {
  const accountReady = Boolean(accessValue?.profile.email && accessValue.profile.active && accessValue.profile.role === "EMPLOYEE");
  const pinReady = Boolean(accessValue?.pinConfiguredAt);
  const locationReady = Boolean(accessValue?.authorizedLocation?.active);
  const readyToActivate = employeeIsEligible && accountReady && pinReady && locationReady;
  const access = accessValue ? { ...accessValue, active: Boolean(accessValue.active && readyToActivate) } : null;
  return <section className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--primary)]">Registro pelo celular</p><h2 className="mt-1 text-lg font-semibold">Acesso ao ponto pelo celular</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Configure a conta, o PIN e o local antes de ativar o acesso.</p></div><span className={`rounded-full px-3 py-1 text-sm font-semibold ${access?.active ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{access?.active ? "Ativo" : "Desativado"}</span></div><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><AccessStatus label="Unidade autorizada" value={access?.allowedUnit.name ?? unitName ?? "Não configurada"} ready={Boolean(access?.allowedUnit.name ?? unitName)} /><AccessStatus label="Local de registro" value={access?.authorizedLocation?.name ?? "Não configurado"} ready={locationReady} /><AccessStatus label="Conta de acesso" value={access?.profile.email ?? "Não configurada"} ready={accountReady} /><AccessStatus label="PIN" value={pinReady ? "Configurado" : "Não configurado"} ready={pinReady} /></dl>{!employeeIsEligible ? <p className="mt-5 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">O funcionário precisa estar ativo, com cadastro completo e vinculado a uma unidade para usar o ponto pelo celular.</p> : null}{!access ? <form action={accountAction} className="mt-5 grid gap-3 rounded-lg border bg-slate-50 p-4 sm:grid-cols-[minmax(0,1fr)_auto]"><input name="employeeId" type="hidden" value={employeeId} /><label className="grid gap-1 text-sm font-medium">Etapa 1 · Conta de acesso<input autoComplete="email" className="input" disabled={!canManage || !employeeIsEligible} name="email" placeholder="bruna@empresa.com" required type="email" /></label><div className="self-end"><LoadingButton disabled={!canManage || !employeeIsEligible} loadingLabel="Criando acesso…">Criar/convidar acesso</LoadingButton></div><p className="text-xs text-[var(--muted-foreground)] sm:col-span-2">Se o e-mail já existir no Supabase Auth, a conta é vinculada com segurança; caso contrário, a pessoa recebe um convite para criar a própria senha.</p></form> : <div className="mt-5 grid gap-4"><form action={pinAction} className="grid gap-3 rounded-lg border p-4 md:grid-cols-2"><input name="employeeId" type="hidden" value={employeeId} /><div className="md:col-span-2"><p className="font-semibold">Etapa 2 · {pinReady ? "Redefinir PIN" : "Definir PIN"}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">Use 6 dígitos. O PIN não é exibido nem registrado em texto puro.</p></div><label className="grid gap-1 text-sm font-medium">PIN<input autoComplete="new-password" className="input" disabled={!canManage} inputMode="numeric" maxLength={6} name="pin" pattern="[0-9]{6}" required type="password" /></label><label className="grid gap-1 text-sm font-medium">Confirmar PIN<input autoComplete="new-password" className="input" disabled={!canManage} inputMode="numeric" maxLength={6} name="confirmPin" pattern="[0-9]{6}" required type="password" /></label><LoadingButton disabled={!canManage} loadingLabel="Salvando PIN…">{pinReady ? "Redefinir PIN" : "Definir PIN"}</LoadingButton></form><form action={locationAction} className="grid gap-3 rounded-lg border p-4 md:grid-cols-[minmax(0,1fr)_auto]"><input name="employeeId" type="hidden" value={employeeId} /><div><p className="font-semibold">Etapa 3 · Local autorizado</p><label className="mt-2 grid gap-1 text-sm font-medium">Local de registro<select className="input" defaultValue={access.authorizedLocation?.id ?? ""} disabled={!canManage || locations.length === 0} name="authorizedLocationId" required><option value="">Selecione um local ativo da unidade</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>{locations.length === 0 ? <p className="mt-2 text-sm text-amber-900">Configure um local autorizado para esta unidade.</p> : null}</div><div className="self-end"><LoadingButton disabled={!canManage || locations.length === 0} loadingLabel="Salvando local…">Salvar local</LoadingButton></div></form><form action={activationAction} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"><input name="employeeId" type="hidden" value={employeeId} /><div><p className="font-semibold">Etapa 4 · {access.active ? "Acesso ativo" : "Ativar acesso"}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{access.active ? "A pessoa pode acessar /meu-ponto usando somente os próprios dados." : readyToActivate ? "Tudo pronto para ativar o ponto pelo celular." : "Configure a conta de acesso, defina um PIN e escolha um local autorizado."}</p></div><input name="active" type="hidden" value={access.active ? "" : "on"} />{access.active ? <LoadingButton className="border bg-white text-slate-900 hover:bg-slate-50" disabled={!canManage} loadingLabel="Desativando…">Desativar acesso</LoadingButton> : <LoadingButton disabled={!canManage || !readyToActivate} loadingLabel="Ativando acesso…">Ativar acesso</LoadingButton>}</form>{access.active ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">Acesso ao ponto pelo celular ativado. URL: <span className="font-semibold">/meu-ponto</span></p> : null}</div>}</section>;
}

function AccessStatus({ label, ready, value }: { label: string; ready: boolean; value: string }) {
  return <div className="rounded-lg bg-slate-50 px-3 py-3"><dt className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">{label}</dt><dd className={`mt-1 font-semibold ${ready ? "text-slate-950" : "text-slate-600"}`}>{value}</dd></div>;
}

function OperationHint({ steps }: { steps: string[] }) {
  const { pending } = useFormStatus();
  return pending ? <p aria-live="polite" className="rounded-lg bg-orange-50 p-3 text-sm text-orange-950" role="status">{steps.join(" ")}</p> : null;
}
