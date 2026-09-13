export const PASSWORD_MIN_LENGTH = 7
export const PASSWORD_MAX_LENGTH = 20
export const PASSWORD_RULE_MESSAGE = '密码长度必须为 7-20 位，仅限制长度。'

export const isValidPassword = value => (
  typeof value === 'string'
  && value.length >= PASSWORD_MIN_LENGTH
  && value.length <= PASSWORD_MAX_LENGTH
  && /\S/.test(value)
)
