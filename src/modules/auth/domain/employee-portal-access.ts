export type ProfileAvailabilityIssue = "PROFILE_MISSING" | "PROFILE_INACTIVE";

export type EmployeePortalAccessIssue = ProfileAvailabilityIssue | "ROLE_NOT_EMPLOYEE" | "EMPLOYEE_ACCESS_MISSING" | "EMPLOYEE_ACCESS_INACTIVE";

type ProfileAccess = {
  active: boolean;
  role: string;
  employeeMobileAccess?: { active: boolean } | null;
};

export function profileAvailabilityIssue(profile: Pick<ProfileAccess, "active"> | null): ProfileAvailabilityIssue | null {
  if (!profile) return "PROFILE_MISSING";
  return profile.active ? null : "PROFILE_INACTIVE";
}

/** Authorization for portal navigation only; punch-specific eligibility remains in mobile attendance. */
export function employeePortalAccessIssue(profile: ProfileAccess | null): EmployeePortalAccessIssue | null {
  if (!profile) return "PROFILE_MISSING";
  if (!profile.active) return "PROFILE_INACTIVE";
  if (profile.role !== "EMPLOYEE") return "ROLE_NOT_EMPLOYEE";
  if (!profile.employeeMobileAccess) return "EMPLOYEE_ACCESS_MISSING";
  return profile.employeeMobileAccess.active ? null : "EMPLOYEE_ACCESS_INACTIVE";
}

export function hasActiveProfile<T extends { active: boolean }>(profile: T | null): profile is T & { active: true } {
  return Boolean(profile?.active);
}

export function hasEmployeePortalAccess<T extends ProfileAccess>(profile: T | null): profile is T & { role: "EMPLOYEE"; employeeMobileAccess: { active: true } } {
  return Boolean(profile?.active && profile.role === "EMPLOYEE" && profile.employeeMobileAccess?.active);
}
