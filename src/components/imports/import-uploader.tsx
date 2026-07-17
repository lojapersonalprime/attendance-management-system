"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ImportPreview {
  fileHash: string;
  deviceUid?: string;
  deviceModel?: string;
  dataType?: string;
  declaredLogCount?: number;
  totalRows: number;
  validRows: number;
  rejectedRows: number;
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
  earliestPunchAt: string | null;
  latestPunchAt: string | null;
}

interface ImportFailureResponse {
  code: string;
  message: string;
  requestId: string;
  importAttemptId?: string;
}

export function ImportUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<"idle" | "previewing" | "importing" | "done">("idle");
  const [result, setResult] = useState<string>();
  const [summary, setSummary] = useState<ImportSummary>();
  const [failure, setFailure] = useState<ImportFailureResponse>();

  async function requestPreview() {
    if (!file) return;
    setError(undefined);
    setFailure(undefined);
    setResult(undefined);
    setSummary(undefined);
    setStatus("previewing");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/imports/preview", { method: "POST", body: formData });
      const body = (await response.json()) as ImportPreview & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Não foi possível analisar o arquivo.");
      setPreview(body);
      setStatus("idle");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível analisar o arquivo.");
      setStatus("idle");
    }
  }

  async function confirmImport() {
    if (!file) return;
    setError(undefined);
    setFailure(undefined);
    setStatus("importing");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const response = await fetch("/api/imports", { method: "POST", body: formData });
      const body = (await response.json()) as {
        duplicateFile?: boolean;
        summary?: ImportSummary;
        error?: ImportFailureResponse;
      };
      if (!response.ok) {
        if (body.error) setFailure(body.error);
        throw new Error(body.error?.message ?? "Não foi possível concluir a importação.");
      }
      if (body.duplicateFile) {
        setResult("Este arquivo já havia sido importado. Nenhuma marcação foi duplicada.");
      } else if (body.summary) {
        setSummary(body.summary);
        setResult(`Importação concluída: ${body.summary.newRows} registros novos, ${body.summary.duplicatedRows} duplicados e ${body.summary.rejectedRows} rejeitados.`);
      }
      setStatus("done");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível concluir a importação.");
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-5 rounded-lg border bg-white p-6 shadow-sm">
      <div>
        <label className="block text-sm font-semibold" htmlFor="attendance-file">Relatório TXT do relógio</label>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Limite inicial: 10 MB. O navegador apenas seleciona o arquivo; a análise é feita no servidor.</p>
        <input id="attendance-file" className="mt-3 block w-full rounded-md border bg-white p-2 text-sm" type="file" accept=".txt,text/plain" onChange={(event) => { setFile(event.target.files?.[0]); setPreview(undefined); setResult(undefined); setSummary(undefined); setFailure(undefined); }} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={requestPreview} disabled={!file || status !== "idle"}>{status === "previewing" ? "Analisando…" : "Analisar arquivo"}</Button>
        {preview ? <Button type="button" onClick={confirmImport} disabled={status !== "idle"}>{status === "importing" ? "Importando…" : "Confirmar importação"}</Button> : null}
      </div>
      {error ? <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800"><p>{error}</p>{failure ? <p className="mt-1 text-xs">Código da tentativa: {failure.requestId}</p> : null}{file ? <Button className="mt-3" type="button" onClick={confirmImport} disabled={status !== "idle"}>Tentar novamente</Button> : null}</div> : null}
      {result ? <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{result}</p> : null}
      {summary ? <section className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><h2 className="font-semibold">Resumo final</h2><dl className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><div><dt className="text-emerald-800">Arquivo</dt><dd>{summary.originalFilename}</dd></div><div><dt className="text-emerald-800">Dispositivo</dt><dd>{summary.deviceUid ?? "Não identificado"}</dd></div><div><dt className="text-emerald-800">Funcionários identificados</dt><dd>{summary.identifiedEmployees}</dd></div><div><dt className="text-emerald-800">Provisórios criados</dt><dd>{summary.provisionalEmployeesCreated}</dd></div><div><dt className="text-emerald-800">Linhas válidas</dt><dd>{summary.validRows}</dd></div><div><dt className="text-emerald-800">Registros novos</dt><dd>{summary.newRows}</dd></div><div><dt className="text-emerald-800">Duplicados</dt><dd>{summary.duplicatedRows}</dd></div><div><dt className="text-emerald-800">Datas recalculadas</dt><dd>{summary.recalculatedDays}</dd></div></dl></section> : null}
      {preview ? (
        <section aria-label="Prévia da importação" className="rounded-md border bg-slate-50 p-4">
          <h2 className="font-semibold">Prévia</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-[var(--muted-foreground)]">Dispositivo</dt><dd className="font-medium">{preview.deviceUid ?? "Não identificado"}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Modelo</dt><dd className="font-medium">{preview.deviceModel ?? "Não informado"}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">DataType</dt><dd className="font-medium">{preview.dataType ?? "Não informado"}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Linhas encontradas</dt><dd className="font-medium">{preview.totalRows}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Linhas válidas</dt><dd className="font-medium">{preview.validRows}</dd></div>
            <div><dt className="text-[var(--muted-foreground)]">Linhas rejeitadas</dt><dd className="font-medium">{preview.rejectedRows}</dd></div>
          </dl>
          {preview.errors.length ? <p className="mt-4 text-sm text-[var(--warning)]">Foram encontradas {preview.errors.length} ocorrências para revisão. Linhas inválidas não serão gravadas.</p> : null}
        </section>
      ) : null}
    </div>
  );
}
