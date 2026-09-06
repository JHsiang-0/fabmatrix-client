<template>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" class="icon-bed">
        <path d="M3 18h18v2H3z" />
        <path d="M6 14v-2c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2v2" />
        <path d="M8 6v2M12 5v3M16 6v2" stroke-dasharray="2 2" stroke-width="1.5" stroke="var(--app-danger)" />
    </svg>
</template>

<script setup>
/**
 * IconBed - 热床图标组件
 * 用于显示 3D 打印机的热床温度
 *
 * @example
 * <IconBed />
 * <IconBed style="color: var(--app-warning); font-size: 16px;" />
 */
defineOptions({
    name: 'IconBed'
})
</script>

<style scoped>
.icon-bed {
    width: 1em;
    height: 1em;
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
}
</style>
