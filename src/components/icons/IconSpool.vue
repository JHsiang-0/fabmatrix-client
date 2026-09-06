<template>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" class="icon-spool">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 20v4" />
        <path d="M4 12H2M22 12h-2" />
    </svg>
</template>

<script setup>
/**
 * IconSpool - 耗材卷轴图标组件
 * 用于显示 3D 打印机的耗材使用量
 *
 * @example
 * <IconSpool />
 * <IconSpool style="color: var(--app-success); font-size: 16px;" />
 */
defineOptions({
    name: 'IconSpool'
})
</script>

<style scoped>
.icon-spool {
    width: 1em;
    height: 1em;
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
}
</style>
