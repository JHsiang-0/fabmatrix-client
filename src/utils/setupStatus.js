export const SETUP_MODE = Object.freeze({
  SETUP: 'setup',
  LOGIN: 'login'
})

/**
 * Resolve the public login page mode from the server-owned setup status.
 * Any successful response other than setupAvailable=true keeps normal login
 * available; a failed check is also deliberately fail-open for usability.
 */
export const resolveSetupStatus = ({ data, failed = false } = {}) => ({
  mode: failed === true || data?.setupAvailable !== true
    ? SETUP_MODE.LOGIN
    : SETUP_MODE.SETUP,
  statusError: failed === true
})

export const isSetupConflict = error => (
  Number(error?.status ?? error?.response?.status ?? error?.code) === 409
)
