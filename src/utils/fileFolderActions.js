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

/**
 * 从 TDesign TreeNodeModel 中取出 FileFolderTree 创建的真实业务目录对象。
 * TreeNodeModel.data 是树节点外层对象，业务目录位于该对象的 data 字段。
 *
 * @param {Object|null|undefined} node - TDesign TreeNodeModel
 * @returns {Object|null} 真实文件夹对象
 */
export const unwrapFolderTreeNode = node => {
  const folder = node?.data?.data
  return folder && typeof folder === 'object' ? folder : null
}

/**
 * 将 TDesign Dropdown click 参数和 TreeNodeModel 统一转换为父组件事件载荷。
 *
 * @param {string|number|Object|null|undefined} action - 下拉操作参数
 * @param {Object|null|undefined} node - TDesign TreeNodeModel
 * @returns {{folder: Object, action: string|number}|null} 文件夹操作载荷
 */
export const resolveFolderActionPayload = (action, node) => {
  const folder = unwrapFolderTreeNode(node)
  const actionValue = resolveFolderActionValue(action)
  return folder && actionValue ? { folder, action: actionValue } : null
}
