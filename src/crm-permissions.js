// Shared display policy. Database RLS and authenticated APIs enforce authorization.
export const EMPLOYEE_ROLES = ['owner', 'manager', 'staff'];
export const READ_ROLES = [...EMPLOYEE_ROLES, 'viewer'];
export const canViewFinancials = role => role === 'owner' || role === 'viewer';
export function canUseEmployeeApi(role, method, allowViewerRead = false, allowedRoles = EMPLOYEE_ROLES) {
  if (role === 'viewer') return allowViewerRead && ['GET', 'HEAD'].includes(method);
  return allowedRoles.includes(role);
}
