import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("MobilePunch persistence contract", () => {
  it("is additive, idempotent and has no mutable update timestamp", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const model = schema.match(/model MobilePunch \{([\s\S]*?)^\}/m)?.[1] ?? "";
    expect(model).toMatch(/requestId\s+String\s+@unique\s+@db\.Uuid/);
    expect(model).toContain("receiptHash");
    expect(model).not.toContain("updatedAt");
    expect(schema).toContain("model RawPunch {");
  });
});
