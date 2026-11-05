<template>
  <section v-if="summary" class="summary" aria-label="设备与网关概览">
    <article v-for="item in counts" :key="item.label">
      <strong>{{ item.value }}</strong
      ><span>{{ item.label }}</span>
    </article>
    <p>
      最近接收
      {{
        summary.lastReceivedAt
          ? new Date(summary.lastReceivedAt).toLocaleString('zh-CN')
          : '尚无数据'
      }}
    </p>
    <p>统计为本次刷新时的可见设备。未知包含过期、未监控及操作状态不完整的设备。</p>
  </section>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ summary: { type: Object, default: null } })
const counts = computed(() => [
  { label: '设备总数', value: props.summary.totalDevices },
  { label: '在线设备', value: props.summary.onlineDevices },
  { label: '打印中', value: props.summary.printingDevices },
  { label: '已暂停', value: props.summary.pausedDevices },
  { label: '故障', value: props.summary.errorDevices },
  { label: '离线', value: props.summary.offlineDevices },
  { label: '未知', value: props.summary.unknownDevices },
  {
    label: '在线网关 / 总数',
    value: `${props.summary.onlineGateways} / ${props.summary.totalGateways}`,
  },
])
</script>
<style scoped>
.summary {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 20px 0;
}
.summary article {
  min-width: 100px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.summary strong {
  font-size: 24px;
  font-weight: 600;
}
.summary span,
.summary p {
  color: var(--td-text-color-secondary);
  font-size: 13px;
}
.summary p {
  flex-basis: 100%;
  margin: 0;
}
</style>
