<template>
  <main class="management app-scroll-region">
    <header>
      <div>
        <h1>组织与农场管理</h1>
        <p>云端账号 {{ session.user?.username }} · {{ roleLabel(role) }}</p>
      </div>
      <div class="actions">
        <t-button variant="outline" @click="router.push('/cloud')">返回设备看板</t-button>
        <t-button variant="outline" @click="store.logout">退出云端</t-button>
      </div>
    </header>
    <t-alert v-if="!session.token" theme="warning">请先前往云端看板登录</t-alert>
    <template v-else>
      <t-card>
        <div class="actions">
          <t-select
            :value="session.organizationId"
            aria-label="管理组织"
            placeholder="选择组织"
            :options="organizationOptions"
            :disabled="state.busy"
            @change="changeOrganization"
          />
          <t-button :disabled="state.busy" @click="openForm('organization-create')"
            >新建组织</t-button
          >
          <t-button
            v-if="manages"
            variant="outline"
            :disabled="state.busy"
            @click="openForm('farm-create')"
            >新建农场</t-button
          >
          <t-button variant="text" :disabled="state.busy" @click="refreshContext"
            >刷新权限与列表</t-button
          >
        </div>
        <div v-if="session.organizationId" class="actions scope">
          <t-button
            :variant="!farmMode ? 'base' : 'outline'"
            :disabled="state.busy"
            @click="showOrganization"
            >组织概览</t-button
          >
          <t-select
            :value="session.farmId || undefined"
            aria-label="管理农场"
            placeholder="选择农场查看详情"
            :options="farmOptions"
            :disabled="state.busy"
            @change="changeFarm"
          />
        </div>
        <t-empty v-if="!session.organizations.length" description="暂无组织，可新建组织" />
      </t-card>
      <t-alert v-if="state.error" theme="error" :close-btn="false">{{ state.error }}</t-alert>
      <t-card v-if="session.organizationId" :title="farmMode ? '农场管理' : '组织管理'">
        <t-tabs :value="section" @change="changeSection">
          <t-tab-panel value="overview" label="概览与资料" />
          <t-tab-panel v-if="manages" value="members" :label="farmMode ? '成员授权' : '组织成员'" />
          <t-tab-panel v-if="manages && farmMode" value="gateways" label="网关管理" />
          <t-tab-panel v-if="manages && !farmMode" value="audit" label="操作记录" />
        </t-tabs>
        <t-loading :loading="state.busy" show-overlay>
          <section class="content">
            <template v-if="section === 'overview' && state.detail">
              <div class="resource-heading">
                <h2>{{ state.detail.name }}</h2>
                <div v-if="manages" class="actions">
                  <t-button
                    variant="outline"
                    :disabled="state.busy"
                    @click="openForm(farmMode ? 'farm-edit' : 'organization-edit', state.detail)"
                    >编辑资料</t-button
                  >
                  <t-button
                    v-if="farmMode || role === 'OWNER'"
                    theme="danger"
                    variant="outline"
                    :disabled="state.busy"
                    @click="confirmDelete"
                    >删除{{ farmMode ? '农场' : '组织' }}</t-button
                  >
                </div>
              </div>
              <p>{{ state.detail.description || '尚未填写说明' }}</p>
              <p v-if="farmMode">地点 / 车间 {{ state.detail.location || '尚未填写' }}</p>
              <p v-else>
                所有者 {{ state.detail.ownerUsername || '未知' }} · 可访问农场
                {{ state.detail.farmCount
                }}<span v-if="state.detail.memberCount != null">
                  · 成员 {{ state.detail.memberCount }}</span
                >
              </p>
              <p>创建时间 {{ formatTime(state.detail.createdAt) }}</p>
              <CloudResourceSummary :summary="state.detail.summary" />
              <template v-if="!farmMode">
                <h3>可访问的农场</h3>
                <t-empty v-if="!state.farms.length" description="暂无可访问农场" />
                <div class="farm-list">
                  <t-card v-for="farm in state.farms" :key="farm.id" :title="farm.name">
                    <t-button variant="text" @click="changeFarm(farm.id)">查看农场</t-button>
                  </t-card>
                </div>
              </template>
              <t-button v-else variant="outline" @click="router.push('/cloud')"
                >查看此农场设备</t-button
              >
            </template>
            <template v-else-if="section === 'members'">
              <t-button v-if="!farmMode" :disabled="state.busy" @click="openForm('member-create')"
                >创建成员</t-button
              >
              <p v-else>所有者和管理员自动拥有农场权限，其他岗位需显式授权。</p>
              <t-table
                :row-key="farmMode ? 'userId' : 'id'"
                :data="state.rows"
                :columns="memberColumns"
                :pagination="{ pageSize: 20 }"
              >
                <template #role="{ row }">{{ roleLabel(row.role) }}</template>
                <template #access="{ row }"
                  ><t-switch
                    :value="row.explicitAccess || ['OWNER', 'ADMIN'].includes(row.role)"
                    :disabled="state.busy || ['OWNER', 'ADMIN'].includes(row.role)"
                    @change="(value) => changeAccess(row, value)"
                /></template>
                <template #operation="{ row }">
                  <div v-if="canManageMember(row)" class="actions">
                    <t-button size="small" variant="text" @click="openForm('member-role', row)"
                      >修改角色</t-button
                    >
                    <t-button
                      v-if="row.canResetPassword"
                      size="small"
                      variant="text"
                      @click="openForm('member-password', row)"
                      >重置密码</t-button
                    >
                    <t-button size="small" theme="danger" variant="text" @click="removeMember(row)"
                      >移除成员</t-button
                    >
                  </div>
                </template>
              </t-table>
            </template>
            <template v-else-if="section === 'gateways'">
              <t-button :disabled="state.busy" @click="openForm('gateway-create')"
                >新增网关</t-button
              >
              <p>
                每台现场 Server 使用独立网关身份。绑定码仅显示一次，有效期内请在目标 Server
                完成绑定。
              </p>
              <t-table row-key="id" :data="state.rows" :columns="gatewayColumns">
                <template #status="{ row }">{{
                  row.revoked ? '凭据已吊销' : row.bound ? '已绑定' : '待绑定'
                }}</template>
                <template #operation="{ row }"
                  ><div class="actions">
                    <t-button size="small" variant="text" @click="openForm('gateway-edit', row)"
                      >修改名称</t-button
                    >
                    <t-button size="small" variant="text" @click="rebindGateway(row)"
                      >重新绑定</t-button
                    >
                    <t-button
                      v-if="!row.revoked"
                      size="small"
                      theme="danger"
                      variant="text"
                      @click="revokeGateway(row)"
                      >吊销凭据</t-button
                    >
                    <t-button
                      v-if="row.revoked"
                      size="small"
                      theme="danger"
                      variant="text"
                      @click="deleteGateway(row)"
                      >删除网关</t-button
                    >
                  </div></template
                >
              </t-table>
            </template>
            <template v-else-if="section === 'audit'">
              <div class="actions">
                <t-input
                  v-model="auditAction"
                  aria-label="审计动作前缀"
                  placeholder="动作前缀，如 FARM_"
                  :maxlength="64"
                /><t-button :disabled="state.busy" @click="loadAudit(1)">查询记录</t-button>
              </div>
              <t-table row-key="id" :data="state.rows" :columns="auditColumns"
                ><template #created_at="{ row }">{{
                  formatTime(row.created_at)
                }}</template></t-table
              >
              <t-pagination
                :current="state.page"
                :total="state.total"
                :page-size="30"
                :show-page-size="false"
                @change="(value) => loadAudit(value.current)"
              />
            </template>
            <t-empty v-else-if="!state.busy && !state.error" description="暂无资料，请刷新" />
          </section>
        </t-loading>
        <t-button variant="text" :disabled="state.busy" @click="reload">刷新当前页面</t-button>
      </t-card>
    </template>
    <t-dialog
      v-if="form.visible"
      :visible="form.visible"
      :header="form.title"
      :confirm-btn="{ content: '保存', loading: state.busy, disabled: !formValid }"
      :cancel-btn="{ disabled: state.busy }"
      :close-on-overlay-click="false"
      @confirm="saveForm"
      @close="closeForm"
    >
      <form @submit.prevent="saveForm">
        <t-form-item
          v-if="!['member-role', 'member-password'].includes(form.kind)"
          :label="form.kind === 'member-create' ? '用户名' : '名称'"
          ><t-input
            v-model="form.name"
            aria-label="资料名称"
            :maxlength="form.kind === 'member-create' ? 64 : 100"
            :disabled="state.busy"
        /></t-form-item>
        <t-form-item v-if="profileForm" label="说明"
          ><t-textarea
            v-model="form.description"
            aria-label="资料说明"
            :maxlength="500"
            :disabled="state.busy"
        /></t-form-item>
        <t-form-item v-if="form.kind.startsWith('farm-')" label="地点 / 车间"
          ><t-input
            v-model="form.location"
            aria-label="农场地点"
            :maxlength="200"
            :disabled="state.busy"
        /></t-form-item>
        <t-form-item
          v-if="['member-create', 'member-password'].includes(form.kind)"
          label="临时密码"
          ><t-input
            v-model="form.password"
            aria-label="成员临时密码"
            type="password"
            :maxlength="64"
            :disabled="state.busy"
          /><small>6–64 字符，首次登录需修改</small></t-form-item
        >
        <t-form-item v-if="['member-create', 'member-role'].includes(form.kind)" label="角色"
          ><t-select v-model="form.role" :options="roleOptions" :disabled="state.busy"
        /></t-form-item>
        <t-alert v-if="form.visible && state.error" theme="error">{{ state.error }}</t-alert>
      </form>
    </t-dialog>
    <t-dialog
      :visible="Boolean(state.ticket)"
      header="一次性网关绑定码"
      :footer="false"
      :close-on-overlay-click="false"
      @close="clearTicket"
    >
      <template v-if="state.ticket"
        ><p>网关 {{ state.ticket.gatewayId }}</p>
        <p>有效至 {{ formatTime(state.ticket.expiresAt) }}</p>
        <t-textarea :value="state.ticket.bindingToken" readonly aria-label="一次性绑定码" />
        <p>请复制至现场 Server，关闭此窗口后无法再次查看。</p>
        <t-button @click="clearTicket">我已记录</t-button></template
      >
    </t-dialog>
  </main>
</template>

<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { confirmMessage } from '@/utils/message'
import { cloudApi } from '@/api/cloud'
import CloudResourceSummary from '@/components/cloud/CloudResourceSummary.vue'
import { useCloudStore } from '@/stores/cloud'
import { createCloudManagement, createManagementState } from '@/utils/cloudManagement'

defineOptions({ name: 'CloudManagement' })
const router = useRouter(),
  store = useCloudStore(),
  session = store.state
const state = reactive(createManagementState())
const management = createCloudManagement(cloudApi, session, state, () => store.logout())
const section = ref('overview'),
  auditAction = ref('')
const role = computed(
  () => session.organizations.find((o) => o.id === session.organizationId)?.role,
)
const manages = computed(() => ['OWNER', 'ADMIN'].includes(role.value))
const farmMode = computed(() => Boolean(session.farmId))
const organizationOptions = computed(() =>
  session.organizations.map((o) => ({ label: o.name, value: o.id })),
)
const farmOptions = computed(() => session.farms.map((f) => ({ label: f.name, value: f.id })))
const roleLabel = (value) =>
  ({ OWNER: '所有者', ADMIN: '管理员', OPERATOR: '操作员', VIEWER: '查看员' })[value] ||
  '未选择组织'
const roleOptions = computed(() =>
  (role.value === 'OWNER' ? ['ADMIN', 'OPERATOR', 'VIEWER'] : ['OPERATOR', 'VIEWER']).map(
    (value) => ({ value, label: roleLabel(value) }),
  ),
)
const memberColumns = computed(() => [
  { colKey: 'username', title: '用户名' },
  { colKey: 'role', title: '岗位' },
  {
    colKey: farmMode.value ? 'access' : 'operation',
    title: farmMode.value ? '农场读取权限' : '管理操作',
  },
])
const gatewayColumns = [
  { colKey: 'name', title: '名称' },
  { colKey: 'id', title: '网关标识' },
  { colKey: 'status', title: '绑定状态' },
  { colKey: 'operation', title: '操作', width: 350 },
]
const auditColumns = [
  { colKey: 'action', title: '动作' },
  { colKey: 'actor_id', title: '操作人标识' },
  { colKey: 'target_id', title: '目标标识' },
  { colKey: 'created_at', title: '时间' },
]
const formatTime = (value) => (value ? new Date(value).toLocaleString('zh-CN') : '未知')
const canManageMember = (row) =>
  row.id !== session.user?.id &&
  row.role !== 'OWNER' &&
  (role.value === 'OWNER' || row.role !== 'ADMIN')
const initialForm = () => ({
  visible: false,
  kind: '',
  title: '',
  id: '',
  name: '',
  description: '',
  location: '',
  password: '',
  role: 'OPERATOR',
})
const form = reactive(initialForm())
const profileForm = computed(() => /^(organization|farm)-/.test(form.kind))
const formValid = computed(
  () =>
    (!['member-role', 'member-password'].includes(form.kind) ? Boolean(form.name.trim()) : true) &&
    (!['member-create', 'member-password'].includes(form.kind) ||
      (form.password.length >= 6 && new TextEncoder().encode(form.password).length <= 72)),
)
const closeForm = () => {
  if (!state.busy) Object.assign(form, initialForm())
}
let ticketTimer, confirmation
const clearTicket = () => {
  clearTimeout(ticketTimer)
  state.ticket = null
}
const openForm = (kind, row = {}) => {
  clearTicket()
  Object.assign(form, initialForm(), {
    visible: true,
    kind,
    id: row.id || '',
    name: row.name || row.username || '',
    description: row.description || '',
    location: row.location || '',
    role: row.role || 'OPERATOR',
    title: {
      'organization-create': '新建组织',
      'organization-edit': '编辑组织资料',
      'farm-create': '新建农场',
      'farm-edit': '编辑农场资料',
      'member-create': '创建成员',
      'member-role': '修改成员角色',
      'member-password': '重置成员密码',
      'gateway-create': '新增网关',
      'gateway-edit': '修改网关名称',
    }[kind],
  })
}
const reload = () => management.load(section.value, state.page, auditAction.value)
const clearContext = () => {
  management.cancel()
  Object.assign(form, initialForm())
  clearTicket()
  confirmation?.abort()
  section.value = 'overview'
}
watch(
  () => [
    session.token,
    session.apiUrl,
    session.organizationId,
    session.farmId,
    role.value,
    session.user?.mustChangePassword,
  ],
  () => {
    clearContext()
    if (session.user?.mustChangePassword) router.replace('/cloud')
    else if (session.token && session.organizationId) reload()
  },
  { immediate: true },
)
const changeSection = (value) => {
  management.cancel()
  clearTicket()
  section.value = value
  reload()
}
const showOrganization = () => store.selectFarm('')
const changeOrganization = (id) => store.selectOrganization(id).then(showOrganization)
const changeFarm = (id) => store.selectFarm(id)
const refreshContext = async () => {
  management.cancel()
  if (await store.refreshScopes()) reload()
  else state.error = session.error || '刷新权限失败，请重试'
}
const showTicket = () => {
  if (!state.ticket) return
  clearTimeout(ticketTimer)
  ticketTimer = setTimeout(clearTicket, Math.max(0, state.ticket.expiresAt - Date.now()))
}
const saveForm = async () => {
  if (state.busy || !formValid.value) return
  const kind = form.kind,
    org = management.orgPath(),
    farm = management.farmPath()
  let method = 'put',
    path,
    data
  if (profileForm.value) {
    data = { name: form.name.trim(), description: form.description.trim() }
    if (kind.startsWith('farm-')) data.location = form.location.trim()
    path = kind.startsWith('farm-') ? farm + '/profile' : org + '/profile'
    if (kind.endsWith('create')) {
      method = 'post'
      path = kind.startsWith('farm-') ? org + '/farms' : '/api/v1/organizations'
    }
  } else if (kind.startsWith('gateway-')) {
    data = { name: form.name.trim() }
    path = farm + '/gateways'
    if (kind.endsWith('create')) method = 'post'
    else path += '/' + encodeURIComponent(form.id)
  } else {
    path = org + '/members/' + encodeURIComponent(form.id)
    if (kind === 'member-create') {
      method = 'post'
      path = org + '/members'
      data = { username: form.name.trim(), password: form.password, role: form.role }
    }
    if (kind === 'member-role') {
      path += '/role'
      data = { role: form.role }
    }
    if (kind === 'member-password') {
      method = 'post'
      path += '/reset-password'
      data = { password: form.password }
    }
  }
  const success = await management.mutate(method, path, data, { ticket: kind === 'gateway-create' })
  form.password = ''
  if (!success) return
  closeForm()
  if (kind === 'gateway-create') {
    showTicket()
    reload()
  } else if (profileForm.value || /^(organization|farm)-/.test(kind)) await refreshContext()
  else reload()
}
const confirmAction = async (header, body, operation) => {
  const context = [session.token, session.organizationId, session.farmId].join('|')
  confirmation?.abort()
  const controller = new AbortController()
  confirmation = controller
  try {
    await confirmMessage(body, header, {
      signal: controller.signal,
      confirmButtonText: '确认',
      closeOnOverlayClick: false,
    })
  } catch {
    return
  } finally {
    if (confirmation === controller) confirmation = null
  }
  if (
    state.busy ||
    controller.signal.aborted ||
    context !== [session.token, session.organizationId, session.farmId].join('|')
  )
    return
  await operation()
}
const confirmDelete = () =>
  confirmAction(
    `删除${farmMode.value ? '农场' : '组织'}`,
    `确认删除 ${state.detail?.name}？存在下级资源或成员时后端会拒绝删除，审计记录保留。`,
    async () => {
      if (
        await management.mutate(
          'delete',
          farmMode.value ? management.farmPath() : management.orgPath(),
        )
      )
        await refreshContext()
    },
  )
const memberPath = (row) => `${management.orgPath()}/members/${encodeURIComponent(row.id)}`
const removeMember = (row) =>
  confirmAction('移除组织成员', `确认移除 ${row.username}？其农场授权将同时撤销。`, async () => {
    if (await management.mutate('delete', memberPath(row))) reload()
  })
const changeAccess = (row, grant) =>
  confirmAction(
    grant ? '授予农场权限' : '撤销农场权限',
    `确认${grant ? '授予' : '撤销'} ${row.username} 的农场读取权限？`,
    async () => {
      if (
        await management.mutate(
          grant ? 'put' : 'delete',
          `${management.farmPath()}/members/${encodeURIComponent(row.userId)}`,
        )
      )
        reload()
    },
  )
const gatewayPath = (row) => `${management.farmPath()}/gateways/${encodeURIComponent(row.id)}`
const rebindGateway = (row) =>
  confirmAction(
    '重新绑定网关',
    `确认重新绑定 ${row.name}？旧凭据立即失效，需要在现场重新绑定后恢复上报。`,
    async () => {
      if (await management.mutate('post', gatewayPath(row) + '/rebind', {}, { ticket: true })) {
        showTicket()
        reload()
      }
    },
  )
const revokeGateway = (row) =>
  confirmAction('吊销网关凭据', `确认吊销 ${row.name}？该网关将停止向云端上报。`, async () => {
    if (await management.mutate('post', gatewayPath(row) + '/revoke', {})) reload()
  })
const deleteGateway = (row) =>
  confirmAction('删除网关', `确认删除 ${row.name}？已有上报数据的网关会被后端保护。`, async () => {
    if (await management.mutate('delete', gatewayPath(row))) reload()
  })
const loadAudit = (page) => {
  if (!/^[A-Z0-9_]{0,64}$/.test(auditAction.value)) {
    state.error = '动作前缀仅支持大写字母、数字和下划线'
    return
  }
  management.load('audit', page, auditAction.value)
}
onUnmounted(() => {
  management.cancel()
  clearTicket()
  confirmation?.abort()
  form.password = ''
})
</script>

<style scoped>
.management {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
header,
.resource-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
h1 {
  margin: 0;
  font-size: 24px;
}
h2 {
  font-size: 20px;
}
p {
  color: var(--td-text-color-secondary);
  line-height: 1.7;
}
.actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.actions :deep(.t-select__wrap),
.actions :deep(.t-input__wrap) {
  width: min(280px, 100%);
}
.scope {
  margin-top: 16px;
}
.content {
  min-height: 100px;
  padding: 20px 0;
  overflow-x: auto;
}
.farm-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
form :deep(.t-form__item) {
  margin-bottom: 20px;
}
@media (max-width: 640px) {
  .management {
    padding: 16px;
  }
}
</style>
