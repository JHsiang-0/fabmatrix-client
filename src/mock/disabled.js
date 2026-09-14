export const isMockEnabled = false

export const mockRequest = async () => {
  const error = new Error('当前构建未启用测试传输')
  error.code = 'ERR_DISABLED_TRANSPORT'
  throw error
}
