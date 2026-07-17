import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const fixturePath = resolve("tests/fixtures/attendlog-synthetic.txt");

const contents = [
  "# DeviceModel = S362E Excel",
  "# DeviceUID = SYNTHETIC-DEVICE-001",
  "# DataType = AttendLog",
  "# StartPos = 0, LogCount = 9, LimitPos = 100000",
  "No\tTMNo\tEnNo\tName\t\tGMNo\tMode\tIN/OUT\tAntipass\tDaiGong\tDateTime\tTR\t",
  "1\t1\t1001\tAna Teste\t\t1\t1\tS\t0\t0\t2026-01-05  08:00:00\tEntrada inicial\t",
  "2\t1\t1001\tAna Teste\t\t1\t1\tE\t0\t0\t2026-01-05  12:00:00\tSaída para intervalo\t",
  "3\t1\t1001\tAna Teste\t\t1\t1\tA\t0\t0\t2026-01-05  13:00:00\tRetorno do intervalo\t",
  "4\t1\t1001\tAna Teste\t\t1\t1\tF\t0\t0\t2026-01-05  17:00:00\tSaída final\t",
  "5\t1\t1002\tBruno Exemplo\t\t1\t1\tS\t0\t0\t2026-01-05  08:05:00\tEntrada inicial\t",
  "6\t1\t1002\tBruno Exemplo\t\t1\t1\tE\t0\t0\t2026-01-05  12:00:00\tSaída para intervalo\t",
  "7\t1\t1002\tBruno Exemplo\t\t1\t1\tA\t0\t0\t2026-01-05  13:00:00\tRetorno do intervalo\t",
  "8\t1\t1001\tAna Teste\t\t1\t1\tS\t0\t0\t2026-01-06  08:00:00\tEntrada inicial\t",
  "9\t1\t1001\tAna Teste\t\t1\t1\tS\t0\t0\t2026-01-06  08:01:00\tPossível duplicidade\t",
].join("\r\n");

await mkdir(dirname(fixturePath), { recursive: true });
await writeFile(fixturePath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(contents, "utf16le")]));

console.log("Fixture AttendLog sintético gerado.");
