"use client";

import Link from "next/link";
import { FileText, FolderUp, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorState, InlineSpinner, ProgressBar, ProgressStep, RetryButton, SuccessState } from "@/components/ui/async-feedback";
import { Button } from "@/components/ui/button";
import { canConfirmImport, importResultPresentation, importWorkflowStepState, importWorkflowSteps } from "@/modules/imports/domain/import-workflow-presentation";

interface ImportPreview {
  fileHash: string;
  deviceUid?: string;
  deviceModel?: string;
  dataType?: string;
  declaredLogCount?: number;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  existingRows: number;
  newRows: number;
  identifiedEmployees: number;
  earliestBusinessDate: string | null;
  latestBusinessDate: string | null;
  duplicateFile: boolean;
  errors: Array<{ rowNumber: number; errorCode: string; message: string }>;
}

interface ImportSummary {
  originalFilename: string;
  deviceUid?: string;
  totalRows: number;
  validRows: number;
  newRows: number;
  duplicatedRows: number;
  rejectedRows: number;
  identifiedEmployees: number;
  provisionalEmployeesCreated: number;
  recalculatedDays: number;
  failedCalculationDays: number;
  calculationRunId: string | null;
  earliestPunchAt: string | null;
  latestPunchAt: string | null;
  coverageFrom: string | null;
  coverageTo: string | null;
  coverageStatus: "SUGGESTED" | "CONFIRMED";
}

interface ImportFailureResponse { code: string; message: string; requestId: string; importAttemptId?: string; }

type ImportStatus = "idle" | "previewing" | "ready" | "importing" | "done" | "error";
type FailureStage = "preview" | "import";

function formatBytes(size: number) {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(size / 1_024 / 1_024) + " MB";
}

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)) : "—";
}

export function ImportUploader() {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<ImportPreview>();
  const [summary, setSummary] = useState<ImportSummary>();
  const [status, setStatus] = useState<ImportStatus>("idle");
  const [error, setError] = useState<string>();
  const [failureStage, setFailureStage] = useState<FailureStage>("preview");
  const [duplicateMessage, setDuplicateMessage] = useState<string>();

  const selectFile = (candidate: File | undefined) => {
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".txt")) { setError("Selecione um arquivo TXT retirado do relógio."); setFailureStage("preview"); return; }
    if (candidate.size > 10 * 1_024 * 1_024) { setError("O arquivo deve ter no máximo 10 MB."); setFailureStage("preview"); return; }
    setFile(candidate); setPreview(undefined); setSummary(undefined); setDuplicateMessage(undefined); setError(undefined); setStatus("idle");
  };
  const removeFile = () => { setFile(undefined); setPreview(undefined); setSummary(undefined); setDuplicateMessage(undefined); setError(undefined); setStatus("idle"); if (input.current) input.current.value = ""; };

  async function requestPreview() {
    if (!file || status === "previewing" || status === "importing") return;
    setError(undefined); setSummary(undefined); setDuplicateMessage(undefined); setStatus("previewing"); setFailureStage("preview");
    try {
      const formData = new FormData(); formData.set("file", file);
      const response = await fetch("/api/imports/preview", { method: "POST", body: formData });
      const body = (await response.json()) as ImportPreview & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Não foi possível analisar o arquivo.");
      setPreview(body); setStatus("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível analisar o arquivo."); setStatus("error");
    }
  }

  async function confirmImport() {
    if (!file || !preview || preview.newRows === 0 || status === "importing") return;
    setError(undefined); setDuplicateMessage(undefined); setStatus("importing"); setFailureStage("import");
    try {
      const formData = new FormData(); formData.set("file", file);
      const response = await fetch("/api/imports", { method: "POST", body: formData });
      const body = (await response.json()) as { duplicateFile?: boolean; summary?: ImportSummary; error?: ImportFailureResponse };
      if (!response.ok) throw new Error(body.error?.message ?? "Não foi possível concluir a importação.");
      if (body.duplicateFile) setDuplicateMessage("Este arquivo já foi importado. Nenhuma marcação foi duplicada.");
      if (body.summary) setSummary(body.summary);
      setStatus("done"); router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a importação."); setStatus("error");
    }
  }

  const retry = failureStage === "preview" ? requestPreview : confirmImport;
  const hasNoNewRows = Boolean(preview && !canConfirmImport(preview));
  const resultPresentation = summary ? importResultPresentation({ duplicate: false, failedCalculationDays: summary.failedCalculationDays }) : undefined;
  return <section aria-busy={status === "previewing" || status === "importing"} className="surface space-y-5 rounded-[1.5rem] p-5 lg:p-6">
    <ol aria-label="Etapas da importação" className="grid gap-4 border-b pb-5 sm:grid-cols-2 xl:grid-cols-6">{importWorkflowSteps.map((title, index) => <ProgressStep index={index + 1} key={title} state={importWorkflowStepState(status, index)} title={title} />)}</ol>
    {status === "importing" ? <div aria-live="polite" className="rounded-xl bg-orange-50 p-4 text-orange-950" role="status"><div className="flex items-center gap-2 font-semibold"><InlineSpinner />Importando registros</div><p className="mt-1 text-sm">Enviando o arquivo, salvando marcações e atualizando a apuração. A contagem será exibida quando o servidor concluir cada etapa.</p><ProgressBar className="mt-4" label="Importação em andamento" /></div> : null}
    {!summary && !duplicateMessage ? <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]"><div><input accept=".txt,text/plain" className="sr-only" id="attendance-file" onChange={(event) => selectFile(event.target.files?.[0])} ref={input} type="file" /><div className={`grid min-h-56 place-items-center rounded-[1.25rem] border-2 border-dashed p-6 text-center transition ${dragging ? "border-orange-400 bg-orange-50" : "border-slate-200 bg-slate-50"}`} onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { event.preventDefault(); setDragging(false); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-[rgb(244_122_32_/_12%)] text-[var(--primary)]">{file ? <FileText size={24} aria-hidden="true" /> : <UploadCloud size={24} aria-hidden="true" />}</span><p className="eyebrow mt-5 text-[var(--primary)]">ARQUIVO ATTENDLOG</p><h2 className="font-display mt-1 text-3xl font-semibold leading-none">{file ? file.name : "Envie o arquivo do relógio"}</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">{file ? formatBytes(file.size) : "Arraste o TXT ou selecione o arquivo para começar."}</p>{file ? <div className="mt-5 flex flex-wrap justify-center gap-2"><Button disabled={status === "previewing" || status === "importing"} onClick={requestPreview} type="button">{status === "previewing" ? <><InlineSpinner />Analisando arquivo…</> : "Analisar arquivo"}</Button><button className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold" disabled={status === "previewing" || status === "importing"} onClick={removeFile} type="button"><Trash2 size={15} aria-hidden="true" />Remover</button></div> : <Button className="mt-5" onClick={() => input.current?.click()} type="button">Selecionar arquivo TXT</Button>}<p className="mt-4 text-xs text-[var(--muted-foreground)]">Formato TXT · Limite de 10 MB</p></div></div></div><aside className="surface-elevated rounded-[1.25rem] p-5"><p className="eyebrow text-[var(--primary)]">ANTES DE IMPORTAR</p><ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--muted-foreground)]"><li>O arquivo original é preservado em armazenamento privado.</li><li>As marcações já existentes são identificadas por fingerprint.</li><li>O RH confirma a cobertura antes de validar ausências.</li></ul></aside></div> : null}
    {status === "previewing" ? <p aria-live="polite" className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700" role="status">Validando formato, período e possíveis duplicidades.</p> : null}
    {preview ? <section aria-label="Resumo do arquivo" className="rounded-xl border bg-slate-50 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Resumo do arquivo</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Arquivo analisado com sucesso.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{preview.deviceUid ? "Relógio identificado" : "Relógio será confirmado na importação"}</span></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><Metric label="Período" value={`${formatDate(preview.earliestBusinessDate)} a ${formatDate(preview.latestBusinessDate)}`} /><Metric label="Marcações encontradas" value={String(preview.validRows)} /><Metric label="Novas" value={String(preview.newRows)} /><Metric label="Já existentes" value={String(preview.existingRows)} /><Metric label="Funcionários" value={String(preview.identifiedEmployees)} /><Metric label="Avisos" value={String(preview.rejectedRows)} /></dl>{preview.errors.length > 0 ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{preview.errors.length} registro(s) precisam de revisão e não serão gravados.</p> : null}{hasNoNewRows ? <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-800">Este arquivo não possui novas marcações.</p> : null}<div className="mt-5 flex flex-wrap gap-2"><button className="rounded-md border px-3 py-2 text-sm font-semibold" onClick={removeFile} type="button">Escolher outro arquivo</button>{hasNoNewRows ? <button className="rounded-md bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-white" onClick={removeFile} type="button">Voltar</button> : <Button disabled={status !== "ready"} onClick={confirmImport} type="button"><FolderUp size={16} aria-hidden="true" />Confirmar importação</Button>}</div></section> : null}
    {error ? <ErrorState description={error} title={failureStage === "preview" ? "Não foi possível analisar o arquivo" : "Não foi possível importar o arquivo"}><RetryButton disabled={!file || status === "previewing" || status === "importing"} onClick={retry}>Tentar novamente</RetryButton></ErrorState> : null}
    {duplicateMessage ? <SuccessState description={duplicateMessage} title="Arquivo já processado"><div className="flex flex-wrap gap-2"><button className="rounded-md border bg-white px-3 py-2 text-sm font-semibold" onClick={removeFile} type="button">Importar outro arquivo</button><Link className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white" href="/apuracao">Ver Registro do ponto</Link></div></SuccessState> : null}
    {summary && resultPresentation ? <SuccessState description={resultPresentation.description} title={resultPresentation.title}><dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5"><Metric label="Registros novos" value={String(summary.newRows)} /><Metric label="Duplicados ignorados" value={String(summary.duplicatedRows)} /><Metric label="Funcionários identificados" value={String(summary.identifiedEmployees)} /><Metric label="Dias calculados" value={String(summary.recalculatedDays)} /><Metric label="Pendências encontradas" value={String(summary.rejectedRows + summary.failedCalculationDays)} /></dl><div className="mt-5 flex flex-wrap gap-2">{summary.failedCalculationDays > 0 ? <Link className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900" href="/apuracao">Tentar cálculo novamente</Link> : null}<Link className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white" href="/apuracao">Ver Registro do ponto</Link><Link className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900" href="/inconsistencias">Ver pendências</Link><button className="rounded-md border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-900" onClick={removeFile} type="button">Importar outro arquivo</button></div></SuccessState> : null}
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><dt className="eyebrow text-[var(--muted-foreground)]">{label}</dt><dd className="numeric font-display mt-1 text-2xl font-semibold leading-none text-slate-900">{value}</dd></div>; }
