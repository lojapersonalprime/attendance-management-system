import { formatMinutesForCsv } from "@/lib/dates/business";

function escapeCsv(value: string | number | undefined | null): string {
  const text = value === undefined || value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function formatBrazilianDateOnly(date: Date): string {
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

export interface MonthlyAttendanceCsvRow {
  employee: string;
  registration?: string | null;
  date: Date;
  workedMinutes: number;
  expectedMinutes: number;
  balanceMinutes: number;
  status: string;
}

/** Excel pt-BR friendly UTF-8 BOM CSV with semicolon separator and HH:mm durations. */
export function createMonthlyAttendanceCsv(rows: MonthlyAttendanceCsvRow[]): string {
  const header = ["Funcionário", "Matrícula", "Data", "Trabalhado", "Previsto", "Saldo", "Status"];
  const body = rows.map((row) => [
    row.employee,
    row.registration,
    formatBrazilianDateOnly(row.date),
    formatMinutesForCsv(row.workedMinutes),
    formatMinutesForCsv(row.expectedMinutes),
    formatMinutesForCsv(row.balanceMinutes),
    row.status,
  ].map(escapeCsv).join(";"));
  return `\uFEFF${[header.map(escapeCsv).join(";"), ...body].join("\r\n")}\r\n`;
}
