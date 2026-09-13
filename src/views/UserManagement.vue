<template>
  <div class="app-page-shell app-page-background">
    <PageHeader title="用户管理" description="管理操作员账号、角色和启用状态">
      <template #actions>
        <t-button theme="primary" @click="openCreate">新增用户</t-button>
      </template>
    </PageHeader>

    <t-card class="app-page-card management-card">
      <t-form :data="query" layout="inline" label-align="top" class="app-query-toolbar">
        <t-form-item label="用户名">
          <t-input v-model="query.username" placeholder="按用户名搜索" clearable @enter="fetchUsers" />
        </t-form-item>
        <t-form-item label="邮箱">
          <t-input v-model="query.email" placeholder="按邮箱搜索" clearable @enter="fetchUsers" />
        </t-form-item>
        <t-form-item label="角色">
          <t-select v-model="query.role" placeholder="全部角色" clearable style="width: 150px" @change="fetchUsers">
            <t-option label="管理员" value="ADMIN" /><t-option label="操作员" value="OPERATOR" />
          </t-select>
        </t-form-item>
        <t-form-item label="启用状态">
          <t-select v-model="query.enabled" placeholder="全部状态" clearable style="width: 150px" @change="fetchUsers">
            <t-option label="启用" :value="true" /><t-option label="停用" :value="false" />
          </t-select>
        </t-form-item>
        <t-form-item label="查询">
          <t-button theme="primary" @click="fetchUsers" :loading="loading">查询</t-button>
        </t-form-item>
      </t-form>
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
      <TdTable v-if="users.length" :data="users" :loading="loading" :height="usersTableHeight" class="management-table">
        <TdTableColumn prop="id" label="ID" width="80" />
        <TdTableColumn prop="username" label="用户名" />
        <TdTableColumn prop="role" label="角色" />
        <TdTableColumn prop="email" label="邮箱" />
        <TdTableColumn prop="phone" label="手机号" />
        <TdTableColumn prop="enabled" label="状态">
          <template #default="{ row }"><t-tag :theme="row.enabled ? 'success' : 'default'">{{ row.enabled ? '启用' : '停用' }}</t-tag></template>
        </TdTableColumn>
        <TdTableColumn label="操作" width="190">
          <template #default="{ row }">
            <t-button size="small" variant="text" @click="openEdit(row)">编辑</t-button>
            <t-button size="small" variant="text" :disabled="isCurrentUser(row)" @click="toggleUser(row)">{{ row.enabled ? '停用' : '启用' }}</t-button>
          </template>
        </TdTableColumn>
      </TdTable>
      <t-pagination v-if="pagination.total > pagination.pageSize" v-model:current="pagination.pageNum" v-model:pageSize="pagination.pageSize" :total="pagination.total" class="mt-4 justify-center" @change="fetchUsers" />
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
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'

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
