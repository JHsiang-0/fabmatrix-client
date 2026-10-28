const AUTH_ROLES = ['ADMIN', 'OPERATOR', 'VIEWER']

const normalizeId = value => {
  if (value === undefined || value === null || value === '') return null
  return String(value)
}

const normalizeExpiresIn = value => {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

/**
 * Normalize an identity returned by either login or /auth/me.
 * The backend uses Long IDs, so the browser keeps them as strings.
 */
export const normalizeAuthIdentity = data => {
  if (!data || typeof data !== 'object') return null

  const id = normalizeId(data.userId ?? data.id)
  const username = typeof data.username === 'string' ? data.username : ''
  const role = String(data.role || '').toUpperCase()

  if (!id || !username || !AUTH_ROLES.includes(role)) return null

  return {
    ...data,
    id,
    userId: id,
    role
  }
}

/**
 * Convert a LoginResult expiresIn value (seconds) into an absolute timestamp.
 */
export const calculateExpiresAt = (expiresIn, now = Date.now()) => {
  const seconds = normalizeExpiresIn(expiresIn)
  return seconds === null ? null : now + seconds * 1000
}

export const isSessionExpired = (expiresAt, now = Date.now()) => {
  const timestamp = Number(expiresAt)
  return Number.isFinite(timestamp) && timestamp <= now
}

/**
 * Build the persisted session from a successful login or first-admin setup.
 */
export const createAuthSession = (data, now = Date.now()) => {
  const identity = normalizeAuthIdentity(data)
  const expiresIn = normalizeExpiresIn(data?.expiresIn)

  if (!data?.token || !identity || expiresIn === null) return null

  return {
    token: String(data.token),
    userInfo: identity,
    expiresIn,
    expiresAt: calculateExpiresAt(expiresIn, now)
  }
}

/**
 * Merge the trusted /auth/me identity into an existing token session.
 */
export const refreshAuthSession = (session, profile) => {
  const identity = normalizeAuthIdentity(profile)
  if (!session?.token || !identity) return null

  return {
    ...session,
    userInfo: {
      ...session.userInfo,
      ...identity
    }
  }
}

export { AUTH_ROLES }
