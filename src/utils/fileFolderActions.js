/**
 * 将 TDropdown 的 click 参数统一转换为文件夹操作值。
 * tdesign-vue-next 使用 options 时可能传递完整选项对象，也兼容直接传值的调用方。
 *
 * @param {string|number|Object|null|undefined} action - 下拉操作参数
 * @returns {string|number|undefined} 文件夹操作值
 */
export const resolveFolderActionValue = action => (
  typeof action === 'object' && action !== null ? action.value : action
)
