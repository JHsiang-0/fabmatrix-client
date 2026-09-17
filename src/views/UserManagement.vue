<template>
  <div class="app-page-shell app-page-background">
    <PageHeader title="用户管理" description="管理操作员账号、角色和启用状态">
      <template #actions>
        <t-button theme="primary" @click="openCreate">新增用户</t-button>
      </template>
    </PageHeader>

    <t-card class="app-page-card management-card user-management-card">
      <QueryToolbar class="user-filter-toolbar" label="用户筛选条件">
        <div class="user-filter-field user-filter-field--role">
          <span class="user-filter-field__label">角色</span>
          <t-radio-group v-model="query.role" variant="default-filled" @change="handleQuery">
            <t-radio-button value="">全部</t-radio-button>
            <t-radio-button value="ADMIN">管理员</t-radio-button>
            <t-radio-button value="OPERATOR">操作员</t-radio-button>
          </t-radio-group>
        </div>
        <div class="user-filter-field">
          <span class="user-filter-field__label">账号状态</span>
          <t-select v-model="query.enabled" placeholder="全部状态" clearable @change="handleQuery">
            <t-option label="启用" :value="true" />
            <t-option label="停用" :value="false" />
          </t-select>
        </div>
        <div class="user-filter-field user-filter-field--search">
          <span class="user-filter-field__label">用户名</span>
          <t-input v-model="query.username" placeholder="搜索用户名" clearable @enter="handleQuery" />
        </div>
        <div class="user-filter-field user-filter-field--search">
          <span class="user-filter-field__label">邮箱</span>
          <t-input v-model="query.email" placeholder="搜索邮箱" clearable @enter="handleQuery" />
        </div>
        <template #actions>
          <t-button theme="primary" :loading="loading" @click="handleQuery">查询</t-button>
          <t-button theme="default" variant="outline" @click="handleReset">重置</t-button>
        </template>
      </QueryToolbar>
      <AsyncState
        v-if="users.length === 0"
        :loading="loading"
        :error="loadError"
        :empty="!loading && !loadError"
        empty-description="暂无用户"
        @retry="fetchUsers"
      />
      <t-alert v-if="loadError && users.length" theme="error" :close-btn="false" class="mb-3">
        {{ loadError }}
        <template #operation><t-button size="small" variant="outline" @click="fetchUsers">重试</t-button></template>
      </t-alert>
      <TdTable v-if="users.length" :data="users" :loading="loading" :height="usersTableHeight" class="management-table user-management-table" hover>
        <TdTableColumn prop="username" label="用户信息" min-width="220">
          <template #default="{ row }">
            <div class="user-table-cell">
              <span class="user-table-cell__primary">{{ row.username || '未命名用户' }}</span>
              <span class="user-table-cell__secondary">用户 #{{ row.id }}</span>
            </div>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="email" label="联系方式" min-width="280">
          <template #default="{ row }">
            <div class="user-table-cell">
              <span class="user-table-cell__primary user-table-cell__ellipsis">{{ row.email || '未填写邮箱' }}</span>
              <span class="user-table-cell__secondary">{{ row.phone || '未填写手机号' }}</span>
            </div>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="role" label="角色" width="130" align="center">
          <template #default="{ row }">
            <t-tag :theme="row.role === 'ADMIN' ? 'primary' : 'default'" variant="light">{{ getRoleLabel(row.role) }}</t-tag>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="enabled" label="账号状态" width="120" align="center">
          <template #default="{ row }"><t-tag :theme="row.enabled ? 'success' : 'default'" variant="light">{{ row.enabled ? '启用' : '停用' }}</t-tag></template>
        </TdTableColumn>
        <TdTableColumn prop="createdAt" label="创建时间" min-width="180">
          <template #default="{ row }"><span class="user-table-time">{{ row.createdAt ? formatDateTime(row.createdAt) : '—' }}</span></template>
        </TdTableColumn>
        <TdTableColumn label="操作" width="176" align="center" fixed="right">
          <template #default="{ row }">
            <t-space size="small" class="user-table-actions">
              <t-button size="small" theme="primary" @click="openEdit(row)">编辑</t-button>
              <t-tooltip :content="isCurrentUser(row) ? '当前登录管理员不能停用自己的账号' : ''" :disabled="!isCurrentUser(row)">
                <span>
                  <t-button
                    size="small"
                    :theme="row.enabled ? 'danger' : 'success'"
                    :variant="row.enabled ? 'outline' : 'base'"
                    :disabled="isCurrentUser(row)"
                    @click="toggleUser(row)"
                  >
                    {{ row.enabled ? '停用' : '启用' }}
                  </t-button>
                </span>
              </t-tooltip>
            </t-space>
          </template>
        </TdTableColumn>
      </TdTable>
      <div class="user-management-footer">
        <span class="user-management-footer__summary">共 <strong>{{ pagination.total }}</strong> 个用户</span>
        <t-pagination
          v-if="pagination.total > pagination.pageSize"
          v-model:current="pagination.pageNum"
          v-model:pageSize="pagination.pageSize"
          :total="pagination.total"
          @change="fetchUsers"
        />
      </div>
    </t-card>

    <t-dialog v-model:visible="dialogVisible" :header="dialogTitle" @confirm="submitUser" @cancel="closeDialog"
      :confirm-btn="{ loading: submitting }">
      <t-alert v-if="dialogError" class="mb-4" theme="error" :close-btn="false">{{ dialogError }}</t-alert>
      <t-form ref="formRef" :data="form" :rules="formRules" label-align="top">
        <t-form-item name="username" label="用户名">
          <t-input v-model="form.username" :disabled="isEditing" autocomplete="username" />
        </t-form-item>
        <template v-if="!isEditing">
          <t-form-item name="password" label="密码"><t-input v-model="form.password" type="password" autocomplete="new-password" /></t-form-item>
          <t-form-item name="confirmPassword" label="确认密码"><t-input v-model="form.confirmPassword" type="password" autocomplete="new-password" /></t-form-item>
        </template>
        <t-form-item name="email" label="邮箱"><t-input v-model="form.email" clearable /></t-form-item>
        <t-form-item name="phone" label="手机号"><t-input v-model="form.phone" clearable /></t-form-item>
        <t-form-item v-if="isEditing" name="role" label="角色">
          <t-select v-model="form.role" :disabled="isCurrentUser(form)">
            <t-option label="管理员" value="ADMIN" /><t-option label="操作员" value="OPERATOR" />
          </t-select>
          <template #help v-if="isCurrentUser(form)">当前管理员不能在此处修改自己的角色。</template>
        </t-form-item>
      </t-form>
    </t-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { confirmMessage, message } from '@/utils/message'
import { createAdminUser, getAdminUsers, setAdminUserEnabled, updateAdminUser } from '@/api/user'
import { useUserStore } from '@/stores/user'
import { isValidPassword, PASSWORD_RULE_MESSAGE } from '@/utils/password'
import AsyncState from '@/components/AsyncState.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import QueryToolbar from '@/components/layout/QueryToolbar.vue'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'
import { formatDateTime } from '@/utils/formatters'

defineOptions({ name: 'UserManagement' })
const userStore = useUserStore()
const currentUserId = computed(() => userStore.userInfo.id)
const loading = ref(false)
const loadError = ref('')
const submitting = ref(false)
const dialogVisible = ref(false)
const dialogError = ref('')
const formRef = ref(null)
const users = ref([])
const usersTableHeight = computed(() => users.value.length > 8
  ? '100%'
  : undefined)
const query = reactive({ username: '', email: '', role: '', enabled: undefined })
const pagination = reactive({ pageNum: 1, pageSize: 10, total: 0 })
const form = reactive({ id: null, username: '', password: '', confirmPassword: '', email: '', phone: '', role: 'OPERATOR' })
const editingUserId = ref(null)
const isEditing = computed(() => editingUserId.value !== null)
const dialogTitle = computed(() => isEditing.value ? '编辑用户' : '新增操作员')
const formRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { min: 3, max: 20, message: '用户名长度必须为 3-20 位', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { validator: value => isValidPassword(value) ? true : { result: false, message: PASSWORD_RULE_MESSAGE }, trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    { validator: value => value === form.password ? true : { result: false, message: '两次输入的密码不一致' }, trigger: 'blur' }
  ],
  email: [{ validator: value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? true : { result: false, message: '邮箱格式不正确' }, trigger: 'blur' }],
  phone: [{ validator: value => !value || /^1[3-9]\d{9}$/.test(value) ? true : { result: false, message: '手机号格式不正确' }, trigger: 'blur' }],
  role: [{ enum: ['ADMIN', 'OPERATOR'], message: '角色只能是管理员或操作员', trigger: 'change' }]
}

const normalizeOptional = value => String(value || '').trim() || null
const isCurrentUser = user => String(user?.id) === String(currentUserId.value)
const getUserErrorMessage = (error, fallback) => {
  if (error?.status === 409) return '操作发生冲突，请刷新用户列表后重试。'
  if (error?.status === 404) return '用户不存在，请刷新用户列表。'
  if (error?.status === 403) return '当前账号无权执行此操作。'
  return error?.message || fallback
}
const getRoleLabel = role => ({ ADMIN: '管理员', OPERATOR: '操作员' })[role] || '未知角色'

const fetchUsers = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const res = await getAdminUsers({ ...query, ...pagination })
    users.value = res.data?.records || []
    pagination.total = res.data?.total || 0
  } catch (error) {
    loadError.value = error?.message || '用户列表加载失败，请重试'
  } finally { loading.value = false }
}
const handleQuery = () => {
  pagination.pageNum = 1
  fetchUsers()
}
const handleReset = () => {
  Object.assign(query, { username: '', email: '', role: '', enabled: undefined })
  pagination.pageNum = 1
  fetchUsers()
}
const resetForm = () => {
  Object.assign(form, { id: null, username: '', password: '', confirmPassword: '', email: '', phone: '', role: 'OPERATOR' })
  editingUserId.value = null
  dialogError.value = ''
  formRef.value?.clearValidate?.()
}
const openCreate = () => { resetForm(); dialogVisible.value = true }
const openEdit = user => {
  Object.assign(form, {
    id: user.id,
    username: user.username || '',
    password: '',
    confirmPassword: '',
    email: user.email || '',
    phone: user.phone || '',
    role: user.role || 'OPERATOR'
  })
  editingUserId.value = user.id
  dialogError.value = ''
  dialogVisible.value = true
}
const closeDialog = () => { dialogVisible.value = false; resetForm() }
const submitUser = async () => {
  const validateResult = await formRef.value?.validate()
  if (validateResult !== true) return
  submitting.value = true
  dialogError.value = ''
  try {
    if (isEditing.value) {
      const data = { id: form.id, email: normalizeOptional(form.email), phone: normalizeOptional(form.phone) }
      if (!isCurrentUser(form)) data.role = form.role
      await updateAdminUser(form.id, data)
      message.success('用户资料已更新')
    } else {
      await createAdminUser({
        username: form.username.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        email: normalizeOptional(form.email),
        phone: normalizeOptional(form.phone)
      })
      message.success('操作员创建成功')
    }
    dialogVisible.value = false
    resetForm()
    await fetchUsers()
  } catch (error) {
    dialogError.value = getUserErrorMessage(error, isEditing.value ? '用户更新失败，请重试。' : '操作员创建失败，请重试。')
  } finally {
    submitting.value = false
  }
}
const toggleUser = async user => {
  if (isCurrentUser(user)) return
  const enabled = !user.enabled
  if (!enabled) {
    try {
      await confirmMessage('禁用后该用户的既有会话将被服务端拒绝，确认继续吗？', '确认禁用用户', {
        confirmButtonText: '确认禁用',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
  }
  try {
    await setAdminUserEnabled(user.id, enabled)
    message.success(enabled ? '用户已启用' : '用户已停用')
    await fetchUsers()
  } catch (error) {
    message.error(getUserErrorMessage(error, enabled ? '启用用户失败，请重试。' : '禁用用户失败，请重试。'))
    await fetchUsers()
  }
}
onMounted(fetchUsers)
</script>

<style scoped>
.user-management-card :deep(.t-card__body) {
  display: flex;
  padding: var(--app-spacing-4);
}

.user-filter-toolbar {
  flex: 0 0 auto;
}

.user-filter-field {
  display: flex;
  min-width: 148px;
  align-items: center;
  gap: var(--app-spacing-2);
}

.user-filter-field--role {
  min-width: 288px;
}

.user-filter-field--search {
  min-width: 210px;
  flex: 1 1 210px;
  max-width: 260px;
}

.user-filter-field__label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  white-space: nowrap;
}

.user-filter-field :deep(.t-select) {
  width: 140px;
}

.user-filter-field :deep(.t-input) {
  width: 100%;
}

.user-management-table :deep(.t-table) {
  width: 100%;
  min-width: 0;
}

.user-management-table :deep(.t-table__content) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: auto;
}

.user-management-table :deep(.t-table th) {
  height: 48px;
  padding: 0 var(--app-spacing-3);
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  font-weight: 500;
  background: var(--app-surface-muted);
}

.user-management-table :deep(.t-table td) {
  height: 58px;
  padding: var(--app-spacing-2) var(--app-spacing-3);
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-small);
  vertical-align: middle;
  border-bottom-color: var(--app-border);
}

.user-management-table :deep(.t-table__body tr) {
  transition: background-color 180ms ease;
}

.user-management-table :deep(.t-table__body tr:hover > td) {
  background: var(--app-surface-hover);
}

.user-management-table :deep(.t-table__body tr:hover > td:first-child) {
  box-shadow: inset 3px 0 0 var(--td-brand-color);
}

.user-table-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.user-table-cell__primary {
  color: var(--app-text-primary);
  font-weight: 600;
}

.user-table-cell__secondary,
.user-table-time {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.user-table-cell__ellipsis {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-table-actions {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
}

.user-table-actions :deep(.t-button) {
  min-width: 58px;
}

.user-management-footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: var(--app-spacing-4);
  min-width: 0;
  margin-top: var(--app-spacing-3);
  padding-top: var(--app-spacing-3);
  border-top: 1px solid var(--app-border);
}

.user-management-footer__summary {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  white-space: nowrap;
}

.user-management-footer__summary strong {
  color: var(--app-text-primary);
}

@media (max-width: 900px) {
  .user-filter-field,
  .user-filter-field--role,
  .user-filter-field--search {
    width: 100%;
    max-width: none;
  }

  .user-filter-field :deep(.t-input),
  .user-filter-field :deep(.t-select),
  .user-filter-field :deep(.t-radio-group) {
    flex: 1 1 auto;
    width: auto;
  }
}

@media (max-width: 640px) {
  .user-management-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
