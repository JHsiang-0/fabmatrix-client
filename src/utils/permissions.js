export const ROUTE_ACCESS = Object.freeze({
  ALLOW: 'allow',
  LOGIN_REQUIRED: 'login-required',
  RESTORE_REQUIRED: 'restore-required',
  AUTHENTICATED_LOGIN: 'authenticated-login',
  UNKNOWN_ROLE: 'unknown-role',
  FORBIDDEN: 'forbidden'
})

const isAuthenticated = ({ token, restoreState }) => Boolean(
  token && restoreState === 'authenticated'
)

/**
 * Resolve route access without touching router or Pinia, keeping the guard
 * matrix independently testable.
 */
export const resolveRouteAccess = ({
  path,
  requiresAuth,
  roleRequirements = [],
  token,
  restoreState,
  role
}) => {
  if (requiresAuth && !token) return ROUTE_ACCESS.LOGIN_REQUIRED
  if (token && restoreState !== 'authenticated') return ROUTE_ACCESS.RESTORE_REQUIRED
  if (path === '/login' && isAuthenticated({ token, restoreState })) {
    return ROUTE_ACCESS.AUTHENTICATED_LOGIN
  }
  if (requiresAuth && !['ADMIN', 'OPERATOR', 'VIEWER'].includes(String(role || '').toUpperCase())) {
    return ROUTE_ACCESS.UNKNOWN_ROLE
  }
  if (roleRequirements.some(roles => !roles.includes(String(role || '').toUpperCase()))) {
    return ROUTE_ACCESS.FORBIDDEN
  }
  return ROUTE_ACCESS.ALLOW
}
