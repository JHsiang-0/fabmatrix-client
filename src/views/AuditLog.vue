<template>
  <div class="audit-log-page app-page-shell app-page-background">
    <PageHeader title="操作日志">
      <template #actions>
      <div class="app-page-toolbar__actions">
        <t-button :icon="renderIcon(Refresh)" :loading="loading" @click="fetchData">刷新</t-button>
      </div>
      </template>
    </PageHeader>

    <t-card bordered hover-shadow class="app-page-card management-card audit-log-card">
      <QueryToolbar class="audit-filter-toolbar" label="操作日志筛选条件">
        <div class="audit-filter-field audit-filter-field--actor">
          <span class="audit-filter-field__label">操作者</span>
          <t-select
            v-model="query.actorId"
            placeholder="全部用户"
            clearable
            filterable
            :loading="actorLoading"
            @change="handleQuery"
          >
            <t-option v-for="user in actorOptions" :key="String(user.id)" :label="user.username" :value="String(user.id)" />
          </t-select>
        </div>
        <div class="audit-filter-field audit-filter-field--action">
          <span class="audit-filter-field__label">操作类型</span>
          <t-select v-model="query.action" placeholder="全部操作" clearable filterable @change="handleQuery">
            <t-option v-for="option in AUDIT_ACTION_OPTIONS" :key="option.value" :label="option.label" :value="option.value" />
          </t-select>
        </div>
        <div class="audit-filter-field">
          <span class="audit-filter-field__label">结果</span>
          <t-select v-model="query.result" placeholder="全部结果" clearable @change="handleQuery">
            <t-option label="成功" value="SUCCESS" />
            <t-option label="失败" value="FAILURE" />
          </t-select>
        </div>
        <div class="audit-filter-field audit-filter-field--date">
          <span class="audit-filter-field__label">时间范围</span>
          <t-date-range-picker
            v-model="query.dateRange"
            value-type="YYYY-MM-DD HH:mm:ss"
            :default-time="['00:00:00', '23:59:59']"
            :placeholder="['开始时间', '结束时间']"
            separator="至"
          />
        </div>
        <div v-if="showAdvancedFilters" class="audit-filter-field">
          <span class="audit-filter-field__label">目标类型</span>
          <t-select v-model="query.targetType" placeholder="全部目标" clearable @change="handleQuery">
            <t-option v-for="option in AUDIT_TARGET_OPTIONS" :key="option.value" :label="option.label" :value="option.value" />
          </t-select>
        </div>
        <div v-if="showAdvancedFilters" class="audit-filter-field audit-filter-field--target-id">
          <span class="audit-filter-field__label">目标 ID</span>
          <t-input v-model="query.targetId" placeholder="输入目标 ID" clearable @enter="handleQuery" />
        </div>
        <template #actions>
          <t-button variant="text" @click="showAdvancedFilters = !showAdvancedFilters">
            {{ showAdvancedFilters ? '收起筛选' : '高级筛选' }}
          </t-button>
          <t-button theme="primary" :loading="loading" @click="handleQuery">查询</t-button>
          <t-button theme="default" variant="outline" @click="handleReset">重置</t-button>
        </template>
      </QueryToolbar>

      <AsyncState
        v-if="logs.length === 0"
        :loading="loading"
        :error="loadError"
        :empty="!loading && !loadError"
        empty-description="暂无操作日志"
        @retry="fetchData"
      />
      <t-alert v-if="loadError && logs.length" theme="error" :close-btn="false" class="mb-3">
        {{ loadError }}
        <template #operation><t-button size="small" variant="outline" @click="fetchData">重试</t-button></template>
      </t-alert>
      <TdTable
        v-if="logs.length"
        :data="logs"
        :loading="loading"
        :height="logsTableHeight"
        :row-attributes="getAuditRowAttributes"
        :row-class-name="getAuditRowClassName"
        class="management-table audit-log-table"
        hover
        @row-click="openDetail"
      >
        <TdTableColumn prop="actorUsername" label="操作者" min-width="190">
          <template #default="{ row }">
            <div class="audit-cell">
              <span class="audit-cell__primary audit-cell__text">{{ row.actorUsername || (row.actorId ? `用户 #${row.actorId}` : '未识别用户') }}</span>
              <span class="audit-cell__secondary">{{ getRoleLabel(row.actorRole) }}<template v-if="row.actorId"> · 用户 #{{ row.actorId }}</template></span>
            </div>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="action" label="操作" min-width="200">
          <template #default="{ row }"><span class="audit-cell__primary audit-cell__text">{{ getAuditActionLabel(row.action) }}</span></template>
        </TdTableColumn>
        <TdTableColumn prop="targetType" label="操作对象" min-width="240">
          <template #default="{ row }">
            <div class="audit-cell">
              <span class="audit-cell__primary audit-cell__text">{{ getAuditTargetLabel(row) }}</span>
              <span class="audit-cell__secondary">{{ getAuditTargetTypeLabel(row.targetType) }}</span>
            </div>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="result" label="结果" width="120" align="center">
          <template #default="{ row }">
            <t-tag :theme="getAuditResultView(row.result).theme" size="small" variant="light">
              {{ getAuditResultView(row.result).label }}
            </t-tag>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="occurredAt" label="发生时间" min-width="190">
          <template #default="{ row }"><span class="audit-time">{{ formatDateTime(row.occurredAt) }}</span></template>
        </TdTableColumn>
      </TdTable>

      <div class="audit-log-footer">
        <span class="audit-log-footer__summary">共 <strong>{{ pagination.total }}</strong> 条操作日志</span>
        <t-pagination
          v-if="pagination.total > pagination.pageSize"
          v-model:current="pagination.pageNum"
          v-model:pageSize="pagination.pageSize"
          :total="pagination.total"
          :page-size-options="[10, 20, 50, 100]"
          class="audit-log-pagination"
          @change="handlePaginationChange"
        />
      </div>
    </t-card>

    <t-drawer v-model:visible="detailVisible" header="审计日志详情" :footer="false" size="480px" class="audit-detail-drawer">
      <t-alert class="mb-4" theme="info" :close-btn="false">仅展示后端审计安全视图中的白名单字段。</t-alert>
      <t-descriptions v-if="selectedLog" bordered size="small" :column="1" class="audit-detail-descriptions">
        <t-descriptions-item label="日志 ID">{{ selectedLog.id || '—' }}</t-descriptions-item>
        <t-descriptions-item label="操作者">{{ selectedLog.actorUsername || '—' }}（{{ selectedLog.actorId || '—' }}）</t-descriptions-item>
        <t-descriptions-item label="角色">{{ selectedLog.actorRole || '—' }}</t-descriptions-item>
        <t-descriptions-item label="动作">{{ getAuditActionLabel(selectedLog.action) }}</t-descriptions-item>
        <t-descriptions-item label="目标">{{ getAuditTargetLabel(selectedLog) }}</t-descriptions-item>
        <t-descriptions-item label="结果">{{ getAuditResultView(selectedLog.result).label }}</t-descriptions-item>
        <t-descriptions-item label="错误码">{{ selectedLog.errorCode || '—' }}</t-descriptions-item>
        <t-descriptions-item label="发生时间">{{ formatDateTime(selectedLog.occurredAt) }}</t-descriptions-item>
        <t-descriptions-item label="追踪 ID">{{ selectedLog.traceId || '—' }}</t-descriptions-item>
      </t-descriptions>
    </t-drawer>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { RefreshIcon as Refresh } from 'tdesign-icons-vue-next'
import { getAdminUsers, getAuditLogs } from '@/api/user'
import AsyncState from '@/components/AsyncState.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import QueryToolbar from '@/components/layout/QueryToolbar.vue'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'
import { formatDateTime } from '@/utils/formatters'
import { message } from '@/utils/message'
import { renderIcon } from '@/utils/tdesign'
import {
  AUDIT_ACTION_OPTIONS,
  AUDIT_TARGET_OPTIONS,
  getAuditActionLabel,
  getAuditResultView,
  getAuditTargetLabel,
  getAuditTargetTypeLabel
} from '@/utils/auditView'

defineOptions({ name: 'AuditLog' })

const loading = ref(false)
const loadError = ref('')
const logs = ref([])
const logsTableHeight = computed(() => logs.value.length > 12
  ? '100%'
  : undefined)
const detailVisible = ref(false)
const selectedLog = ref(null)
const showAdvancedFilters = ref(false)
const actorLoading = ref(false)
const actorOptions = ref([])
const query = reactive({ actorId: '', action: '', targetType: '', targetId: '', result: '', dateRange: [] })
const pagination = reactive({ pageNum: 1, pageSize: 20, total: 0 })

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    actorId: String(query.actorId || '').trim() || undefined,
    action: String(query.action || '').trim() || undefined,
    targetType: String(query.targetType || '').trim() || undefined,
    targetId: String(query.targetId || '').trim() || undefined,
    result: query.result || undefined
  }
  if (Array.isArray(query.dateRange) && query.dateRange.length === 2) {
    params.from = query.dateRange[0]
    params.to = query.dateRange[1]
  }
  return params
}

const fetchData = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const response = await getAuditLogs(buildParams())
    logs.value = response.data?.records || []
    pagination.total = response.data?.total || 0
  } catch (error) {
    loadError.value = error?.message || '操作日志加载失败，请重试'
    message.error(loadError.value)
  } finally {
    loading.value = false
  }
}

const handleQuery = () => {
  pagination.pageNum = 1
  fetchData()
}

const handleReset = () => {
  Object.assign(query, { actorId: '', action: '', targetType: '', targetId: '', result: '', dateRange: [] })
  pagination.pageNum = 1
  fetchData()
}

const handlePaginationChange = ({ current, pageSize }) => {
  pagination.pageNum = current
  pagination.pageSize = pageSize
  fetchData()
}

const openDetail = row => {
  selectedLog.value = row
  detailVisible.value = true
}

const getRoleLabel = role => ({ ADMIN: '管理员', OPERATOR: '操作员' })[role] || '未知角色'

const getAuditRowClassName = ({ row, type }) => {
  if (type !== 'body') return ''
  return detailVisible.value && selectedLog.value && String(selectedLog.value.id) === String(row.id)
    ? 'audit-log-row audit-log-row--selected'
    : 'audit-log-row'
}

const getAuditRowAttributes = ({ row, type }) => {
  if (type !== 'body') return {}
  return {
    tabindex: 0,
    role: 'button',
    'aria-label': `查看${getAuditActionLabel(row.action)}日志详情`,
    onKeydown: event => {
      if (!['Enter', ' '].includes(event.key)) return
      event.preventDefault()
      openDetail(row)
    }
  }
}

const loadActorOptions = async () => {
  actorLoading.value = true
  try {
    const response = await getAdminUsers({ pageNum: 1, pageSize: 100 })
    actorOptions.value = response.data?.records || []
  } catch {
    actorOptions.value = []
  } finally {
    actorLoading.value = false
  }
}

fetchData()
loadActorOptions()
</script>

<style scoped>
.audit-log-page,
.audit-log-card {
  min-width: 0;
}

.audit-log-card {
  border-color: var(--app-border);
  background: var(--app-surface);
}

.audit-log-card :deep(.t-card__body) {
  display: flex;
  padding: var(--app-spacing-4);
}

.audit-filter-toolbar {
  flex: 0 0 auto;
}

.audit-filter-field {
  display: flex;
  min-width: 158px;
  align-items: center;
  gap: var(--app-spacing-2);
}

.audit-filter-field--actor {
  min-width: 190px;
}

.audit-filter-field--action {
  min-width: 220px;
}

.audit-filter-field--date {
  min-width: 330px;
  flex: 1 1 330px;
}

.audit-filter-field--target-id {
  min-width: 180px;
}

.audit-filter-field__label {
  flex: 0 0 auto;
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  white-space: nowrap;
}

.audit-filter-field :deep(.t-select),
.audit-filter-field :deep(.t-input),
.audit-filter-field :deep(.t-date-range-picker) {
  flex: 1 1 auto;
  min-width: 0;
}

.audit-filter-field--actor :deep(.t-select) {
  width: 128px;
}

.audit-filter-field--action :deep(.t-select) {
  width: 150px;
}

.audit-filter-field--date :deep(.t-date-range-picker) {
  width: 270px;
}

.audit-log-table {
  min-width: 0;
}

.audit-log-table :deep(.t-table) {
  width: 100%;
  min-width: 0;
}

.audit-log-table :deep(.t-table__content) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: auto;
}

.audit-log-table :deep(.t-table th) {
  height: 48px;
  padding: 0 var(--app-spacing-3);
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  font-weight: 500;
  background: var(--app-surface-muted);
}

.audit-log-table :deep(.t-table td) {
  height: 58px;
  padding: var(--app-spacing-2) var(--app-spacing-3);
  color: var(--app-text-primary);
  font-size: var(--td-font-size-body-small);
  vertical-align: middle;
  border-bottom-color: var(--app-border);
}

.audit-log-table :deep(.t-table__body tr) {
  cursor: pointer;
  transition: background-color 180ms ease;
}

.audit-log-table :deep(.t-table__body tr:hover > td) {
  background: var(--app-surface-hover);
}

.audit-log-table :deep(.t-table__body tr:hover > td:first-child) {
  box-shadow: inset 3px 0 0 var(--td-brand-color);
}

.audit-log-table :deep(.audit-log-row--selected > td),
.audit-log-table :deep(.audit-log-row:focus > td) {
  background: var(--app-primary-light);
}

.audit-log-table :deep(.audit-log-row--selected > td:first-child),
.audit-log-table :deep(.audit-log-row:focus > td:first-child) {
  box-shadow: inset 3px 0 0 var(--td-brand-color);
}

.audit-log-table :deep(.audit-log-row:focus) {
  outline: none;
}

.audit-cell {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.audit-cell__text {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audit-cell__primary {
  color: var(--app-text-primary);
  font-weight: 600;
}

.audit-cell__secondary,
.audit-time {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
}

.audit-log-footer {
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

.audit-log-footer__summary {
  color: var(--app-text-secondary);
  font-size: var(--td-font-size-body-small);
  white-space: nowrap;
}

.audit-log-footer__summary strong {
  color: var(--app-text-primary);
}

.audit-log-pagination {
  flex-wrap: wrap;
}

.audit-detail-drawer :deep(.t-drawer__body) {
  overflow: auto;
}

.audit-detail-descriptions {
  word-break: break-word;
}

@media (max-width: 900px) {
  .audit-filter-field,
  .audit-filter-field--actor,
  .audit-filter-field--action,
  .audit-filter-field--date,
  .audit-filter-field--target-id {
    width: 100%;
    min-width: 0;
    flex: 1 1 100%;
  }

  .audit-filter-field :deep(.t-select),
  .audit-filter-field :deep(.t-input),
  .audit-filter-field :deep(.t-date-range-picker) {
    width: auto;
  }
}

@media (max-width: 640px) {
  .audit-log-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
