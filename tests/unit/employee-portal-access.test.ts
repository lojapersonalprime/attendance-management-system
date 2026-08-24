import { describe, expect, it } from "vitest";
import { employeePortalAccessIssue, profileAvailabilityIssue } from "@/modules/auth/domain/employee-portal-access";

describe("employee portal authorization", () => {
  it("permite EMPLOYEE com perfil e acesso mobile ativos", () => {
    expect(employeePortalAccessIssue({ active: true, role: "EMPLOYEE", employeeMobileAccess: { active: true } })).toBeNull();
  });

  it("distingue ausência e inatividade de perfil", () => {
    expect(profileAvailabilityIssue(null)).toBe("PROFILE_MISSING");
    expect(profileAvailabilityIssue({ active: false })).toBe("PROFILE_INACTIVE");
    expect(employeePortalAccessIssue({ active: false, role: "EMPLOYEE", employeeMobileAccess: { active: true } })).toBe("PROFILE_INACTIVE");
  });

  it("distingue RH de falhas de acesso mobile do funcionário", () => {
    expect(employeePortalAccessIssue({ active: true, role: "RH_ADMIN", employeeMobileAccess: null })).toBe("ROLE_NOT_EMPLOYEE");
    expect(employeePortalAccessIssue({ active: true, role: "EMPLOYEE", employeeMobileAccess: null })).toBe("EMPLOYEE_ACCESS_MISSING");
    expect(employeePortalAccessIssue({ active: true, role: "EMPLOYEE", employeeMobileAccess: { active: false } })).toBe("EMPLOYEE_ACCESS_INACTIVE");
  });
});
