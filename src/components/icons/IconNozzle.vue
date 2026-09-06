<template>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round" class="icon-nozzle">
        <path d="M8 2h8v4H8z" />
        <path d="M8 6l-2 8h12l-2-8" />
        <path d="M10 14v4l2 2 2-2v-4" />
    </svg>
</template>

<script setup>
/**
 * IconNozzle - 挤出头图标组件
 * 用于显示 3D 打印机的喷头/挤出头温度
 *
 * @example
 * <IconNozzle />
 * <IconNozzle style="color: var(--app-danger); font-size: 16px;" />
 */
defineOptions({
    name: 'IconNozzle'
})
</script>

<style scoped>
.icon-nozzle {
    width: 1em;
    height: 1em;
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
}
</style>
