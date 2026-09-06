<template>
  <div class="app-page-shell app-page-background">
    <PageHeader title="操作日志">
      <template #actions>
      <div class="app-page-toolbar__actions">
        <t-button :icon="renderIcon(Refresh)" :loading="loading" @click="fetchData">刷新</t-button>
      </div>
      </template>
    </PageHeader>

    <t-card class="app-page-card management-card">
      <t-form :data="query" layout="inline" label-align="top" class="app-query-toolbar audit-filter-form">
        <t-form-item label="操作者 ID" class="audit-filter-form__field">
          <t-input v-model="query.actorId" class="audit-filter-form__control" placeholder="操作者 ID" clearable @enter="handleQuery" />
        </t-form-item>
        <t-form-item label="动作" class="audit-filter-form__field">
          <t-input v-model="query.action" class="audit-filter-form__control" placeholder="如 JOB_CREATE" clearable @enter="handleQuery" />
        </t-form-item>
        <t-form-item label="目标类型" class="audit-filter-form__field">
          <t-input v-model="query.targetType" class="audit-filter-form__control" placeholder="目标类型" clearable @enter="handleQuery" />
        </t-form-item>
        <t-form-item label="目标 ID" class="audit-filter-form__field">
          <t-input v-model="query.targetId" class="audit-filter-form__control" placeholder="目标 ID" clearable @enter="handleQuery" />
        </t-form-item>
        <t-form-item label="结果" class="audit-filter-form__field">
          <t-select v-model="query.result" class="audit-filter-form__control" placeholder="全部结果" clearable @change="handleQuery">
            <t-option label="成功" value="SUCCESS" />
            <t-option label="失败" value="FAILURE" />
          </t-select>
        </t-form-item>
        <t-form-item label="时间范围" class="audit-filter-form__field audit-filter-form__field--date">
          <t-date-range-picker
            v-model="query.dateRange"
            class="audit-filter-form__control"
            value-type="YYYY-MM-DD HH:mm:ss"
            :default-time="['00:00:00', '23:59:59']"
            :placeholder="['开始时间', '结束时间']"
            separator="至"
          />
        </t-form-item>
        <t-form-item label="操作" class="audit-filter-form__field audit-filter-form__field--actions">
          <div class="audit-filter-form__actions">
            <t-button theme="primary" :loading="loading" @click="handleQuery">查询</t-button>
            <t-button @click="handleReset">重置</t-button>
          </div>
        </t-form-item>
      </t-form>

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
      <TdTable v-if="logs.length" :data="logs" :loading="loading" :height="logsTableHeight" class="management-table" @row-click="openDetail">
        <TdTableColumn prop="actorUsername" label="操作者" min-width="140">
          <template #default="{ row }">
            <span>{{ row.actorUsername || (row.actorId ? `用户 #${row.actorId}` : '未识别用户') }}</span>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="actorRole" label="角色" width="110">
          <template #default="{ row }">
            <t-tag size="small" variant="light-outline">{{ row.actorRole || '-' }}</t-tag>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="action" label="动作" min-width="180">
          <template #default="{ row }"><span>{{ getAuditActionLabel(row.action) }}</span></template>
        </TdTableColumn>
        <TdTableColumn prop="targetType" label="目标" min-width="180">
          <template #default="{ row }">
            <span>{{ getAuditTargetLabel(row) }}</span>
          </template>
        </TdTableColumn>
        <TdTableColumn prop="occurredAt" label="发生时间" min-width="180">
          <template #default="{ row }">{{ formatDateTime(row.occurredAt) }}</template>
        </TdTableColumn>
        <TdTableColumn prop="result" label="结果" width="100">
          <template #default="{ row }">
            <t-tag :theme="getAuditResultView(row.result).theme" size="small">
              {{ getAuditResultView(row.result).label }}
            </t-tag>
          </template>
        </TdTableColumn>
        <TdTableColumn label="详情" width="90">
          <template #default="{ row }"><t-button variant="text" size="small" @click.stop="openDetail(row)">查看</t-button></template>
        </TdTableColumn>
      </TdTable>

      <t-pagination
        v-model:current="pagination.pageNum"
        v-model:pageSize="pagination.pageSize"
        :total="pagination.total"
        :page-size-options="[10, 20, 50, 100]"
        class="mt-4 justify-center"
        @change="handlePaginationChange"
      />
    </t-card>

    <t-drawer v-model:visible="detailVisible" header="审计日志详情" :footer="false" size="480px">
      <t-alert class="mb-4" theme="info" :close-btn="false">仅展示后端审计安全视图中的白名单字段。</t-alert>
      <t-descriptions v-if="selectedLog" bordered :column="1">
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
import { getAuditLogs } from '@/api/user'
import AsyncState from '@/components/AsyncState.vue'
import PageHeader from '@/components/layout/PageHeader.vue'
import TdTable from '@/components/TdTable.vue'
import TdTableColumn from '@/components/TdTableColumn.vue'
import { formatDateTime } from '@/utils/formatters'
import { message } from '@/utils/message'
import { renderIcon } from '@/utils/tdesign'
import { getAuditActionLabel, getAuditResultView, getAuditTargetLabel } from '@/utils/auditView'

defineOptions({ name: 'AuditLog' })

const loading = ref(false)
const loadError = ref('')
const logs = ref([])
const logsTableHeight = computed(() => logs.value.length > 12
  ? '100%'
  : undefined)
const detailVisible = ref(false)
const selectedLog = ref(null)
const query = reactive({ actorId: '', action: '', targetType: '', targetId: '', result: '', dateRange: [] })
const pagination = reactive({ pageNum: 1, pageSize: 20, total: 0 })

const buildParams = () => {
  const params = {
    pageNum: pagination.pageNum,
    pageSize: pagination.pageSize,
    actorId: query.actorId.trim() || undefined,
    action: query.action.trim() || undefined,
    targetType: query.targetType.trim() || undefined,
    targetId: query.targetId.trim() || undefined,
    result: query.result || undefined
  }
  if (query.dateRange.length === 2) {
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

fetchData()
</script>

<style scoped>
.audit-filter-form {
  display: grid;
  grid-template-columns: minmax(120px, 0.9fr) minmax(160px, 1.2fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(120px, 0.9fr) minmax(250px, 1.8fr) auto;
  align-items: end;
  column-gap: var(--app-spacing-4);
  row-gap: var(--app-spacing-3);
}

.audit-filter-form :deep(.t-form__item) {
  min-width: 0;
  margin: 0;
}

.audit-filter-form :deep(.audit-filter-form__control),
.audit-filter-form :deep(.audit-filter-form__control .t-input),
.audit-filter-form :deep(.audit-filter-form__control .t-select),
.audit-filter-form :deep(.audit-filter-form__control .t-date-range-picker) {
  width: 100%;
}

.audit-filter-form__actions {
  display: flex;
  gap: var(--app-spacing-2);
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .audit-filter-form {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .audit-filter-form__field--date {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .audit-filter-form {
    grid-template-columns: minmax(0, 1fr);
  }

  .audit-filter-form__field--date {
    grid-column: auto;
  }

  .audit-filter-form__actions :deep(.t-button) {
    flex: 1 1 0;
  }
}
</style>
