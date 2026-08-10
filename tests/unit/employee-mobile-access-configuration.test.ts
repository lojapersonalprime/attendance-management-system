import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { employeeMobileAccessLocationSchema, employeeMobileAccessPinSchema, employeeMobileAccountSchema } from "@/modules/mobile-attendance/application/validation";
import { mobileAccessActivationIssue, mobileAccessActivationMessage } from "@/modules/mobile-attendance/domain/access-configuration";

const base = {
  employeeStatus: "ACTIVE",
  employeeProvisional: false,
  employeeUnitId: "golden",
  employeeUnitActive: true,
  accountActive: true,
  accountRole: "EMPLOYEE",
  pinConfigured: true,
  allowedUnitId: "golden",
  allowedUnitActive: true,
  authorizedLocation: { active: true, unitId: "golden" },
};

describe("employee mobile access configuration", () => {
  it("exige conta EMPLOYEE, PIN e local ativo compatível antes da ativação", () => {
    expect(mobileAccessActivationIssue(base)).toBeNull();
    expect(mobileAccessActivationIssue({ ...base, accountActive: false })).toBe("ACCOUNT_NOT_CONFIGURED");
    expect(mobileAccessActivationIssue({ ...base, accountRole: "RH_ADMIN" })).toBe("ACCOUNT_NOT_CONFIGURED");
    expect(mobileAccessActivationIssue({ ...base, pinConfigured: false })).toBe("PIN_NOT_CONFIGURED");
    expect(mobileAccessActivationIssue({ ...base, authorizedLocation: null })).toBe("LOCATION_NOT_CONFIGURED");
    expect(mobileAccessActivationIssue({ ...base, authorizedLocation: { active: false, unitId: "golden" } })).toBe("LOCATION_NOT_CONFIGURED");
    expect(mobileAccessActivationIssue({ ...base, authorizedLocation: { active: true, unitId: "matriz" } })).toBe("LOCATION_NOT_CONFIGURED");
    expect(mobileAccessActivationIssue({ ...base, employeeUnitId: "matriz" })).toBe("UNIT_MISMATCH");
    expect(mobileAccessActivationIssue({ ...base, employeeStatus: "INACTIVE" })).toBe("EMPLOYEE_NOT_ELIGIBLE");
    expect(mobileAccessActivationMessage("PIN_NOT_CONFIGURED")).toBe("Defina um PIN antes de ativar o acesso.");
  });

  it("valida conta, confirmação de PIN e local obrigatório sem expor segredos", () => {
    expect(employeeMobileAccountSchema.parse({ employeeId: "employee-1", email: "bruna@empresa.com" }).email).toBe("bruna@empresa.com");
    expect(() => employeeMobileAccountSchema.parse({ employeeId: "employee-1", email: "invalido" })).toThrow();
    expect(() => employeeMobileAccessPinSchema.parse({ employeeId: "employee-1", pin: "123456", confirmPin: "654321" })).toThrow(/PINs informados não conferem/);
    expect(() => employeeMobileAccessPinSchema.parse({ employeeId: "employee-1", pin: "12345", confirmPin: "12345" })).toThrow();
    expect(() => employeeMobileAccessLocationSchema.parse({ employeeId: "employee-1", authorizedLocationId: "" })).toThrow();
  });

  it("usa o funcionário existente, trata Auth existente antes do convite e audita sem senha/PIN", () => {
    const source = readFileSync(resolve(process.cwd(), "src/modules/mobile-attendance/application/mobile-attendance-service.ts"), "utf8");
    const accountSource = source.slice(source.indexOf("export async function createOrLinkEmployeeMobileAccount"), source.indexOf("export async function setEmployeeMobileAccessPin"));
    const pinSource = source.slice(source.indexOf("export async function setEmployeeMobileAccessPin"), source.indexOf("export async function setEmployeeMobileAuthorizedLocation"));
    expect(accountSource).toContain("findAuthUserByEmail(input.email)");
    expect(accountSource.indexOf("findAuthUserByEmail(input.email)")).toBeLessThan(accountSource.indexOf("inviteUserByEmail"));
    expect(accountSource).toContain("employeeMobileAccess.create");
    expect(accountSource).not.toContain("employee.create");
    expect(accountSource).toContain('role !== "EMPLOYEE"');
    const pinAudit = pinSource.slice(pinSource.indexOf("await writeAuditLog"));
    expect(pinAudit).not.toContain("input.pin");
    expect(pinAudit).not.toContain("pinHash");
  });

  it("mantém RH_ADMIN como único configurador e EMPLOYEE restrito ao próprio portal", () => {
    const actions = readFileSync(resolve(process.cwd(), "src/app/(dashboard)/funcionarios/actions.ts"), "utf8");
    const auditContext = readFileSync(resolve(process.cwd(), "src/modules/audit/server/request-context.ts"), "utf8");
    const session = readFileSync(resolve(process.cwd(), "src/modules/auth/server/session.ts"), "utf8");
    const dashboard = readFileSync(resolve(process.cwd(), "src/app/(dashboard)/layout.tsx"), "utf8");
    const employeePortal = readFileSync(resolve(process.cwd(), "src/app/(employee)/meu-ponto/layout.tsx"), "utf8");
    expect(actions).toContain("createOrLinkEmployeeMobileAccountAction");
    expect(actions).toContain("setEmployeeMobileAccessPinAction");
    expect(actions).toContain("setEmployeeMobileAuthorizedLocationAction");
    expect(actions).toContain("setEmployeeMobileAccessActiveAction");
    expect(auditContext).toContain("requireRhAdmin()");
    expect(session).toContain('if (profile.role === "EMPLOYEE") redirect("/meu-ponto"');
    expect(dashboard).toContain("requireRhStaff()");
    expect(employeePortal).toContain("requireEmployeeMobileAccess()");
  });

  it("mantém RawPunch e MobilePunch intactos e deixa o local escolhido na cadeia de Haversine", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260810150000_employee_mobile_access_authorized_location/migration.sql"), "utf8");
    const service = readFileSync(resolve(process.cwd(), "src/modules/mobile-attendance/application/mobile-attendance-service.ts"), "utf8");
    const registerSource = service.slice(service.indexOf("export async function registerMobilePunch"), service.indexOf("export async function createAttendanceCorrectionRequest"));
    expect(schema).toContain("model RawPunch {");
    expect(schema).toContain("model MobilePunch {");
    expect(migration).not.toContain("RawPunch");
    expect(migration).not.toContain("MobilePunch");
    expect(registerSource).toContain("access.authorizedLocation");
    expect(registerSource).toContain("evaluateLocation");
    expect(registerSource).not.toMatch(/Photon|Google|place-search/i);
  });
});
