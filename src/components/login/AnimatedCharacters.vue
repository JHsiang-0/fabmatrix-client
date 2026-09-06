<template>
  <div class="animated-characters-container" aria-hidden="true">
    <div v-if="loginSuccess" class="confetti-container">
      <i v-for="(piece, index) in confetti" :key="index" class="confetti-piece" :style="piece" />
    </div>

    <div class="character-stage">
      <div class="character purple-character" :class="stateClass" :style="purpleStyle">
        <div class="eyes purple-eyes" :style="eyeStyle">
          <i class="eyeball"><b /></i><i class="eyeball"><b /></i>
        </div>
        <i class="purple-mouth" :class="mouthClass" />
      </div>

      <div class="character black-character" :class="stateClass" :style="blackStyle">
        <div class="eyes black-eyes" :style="eyeStyle">
          <i class="eyeball"><b /></i><i class="eyeball"><b /></i>
        </div>
      </div>

      <div class="character orange-character" :class="stateClass" :style="orangeStyle">
        <div class="eyes orange-eyes" :style="eyeStyle">
          <i class="pupil" /><i class="pupil" />
        </div>
        <i class="orange-mouth" :class="mouthClass" />
      </div>

      <div class="character yellow-character" :class="stateClass" :style="yellowStyle">
        <div class="eyes yellow-eyes" :style="eyeStyle">
          <i class="pupil" /><i class="pupil" />
        </div>
        <svg class="yellow-mouth" viewBox="0 0 80 20">
          <path :class="mouthClass" d="M0 10 Q10 10, 20 10 Q30 10, 40 10 Q50 10, 60 10 Q70 10, 80 10" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'

const props = defineProps({
  isTyping: Boolean,
  showPassword: Boolean,
  passwordLength: { type: Number, default: 0 },
  loginFailed: Boolean,
  loginSuccess: Boolean
})

const mouse = reactive({ x: 0, y: 0 })
const entered = ref(false)

const updateMouse = event => {
  mouse.x = event.clientX
  mouse.y = event.clientY
}

const look = computed(() => {
  const x = Math.max(-6, Math.min(6, (mouse.x - window.innerWidth / 2) / 45))
  const y = Math.max(-5, Math.min(5, (mouse.y - window.innerHeight / 2) / 45))
  return { x, y }
})

const eyeStyle = computed(() => ({
  transform: `translate(${look.value.x}px, ${look.value.y}px)`
}))

const stateClass = computed(() => ({
  'entrance-complete': entered.value,
  'is-typing': props.isTyping,
  'is-hidden-password': props.passwordLength > 0 && !props.showPassword,
  'is-visible-password': props.passwordLength > 0 && props.showPassword,
  'is-failed': props.loginFailed,
  'is-success': props.loginSuccess
}))

const mouthClass = computed(() => ({
  'mouth-typing': props.isTyping && !props.loginFailed && !props.loginSuccess,
  'mouth-sad': props.loginFailed,
  'mouth-happy': props.loginSuccess
}))

const purpleStyle = computed(() => ({
  transform: props.isTyping ? 'skewX(-8deg) translateX(16px)' : undefined
}))

const blackStyle = computed(() => ({
  transform: props.isTyping ? 'skewX(5deg)' : undefined
}))

const orangeStyle = computed(() => ({
  transform: props.isTyping ? 'skewX(-4deg)' : undefined
}))

const yellowStyle = computed(() => ({
  transform: props.isTyping ? 'skewX(4deg)' : undefined
}))

const colors = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a78bfa', '#ff9b6b', '#6bcb77']
const confetti = Array.from({ length: 42 }, (_, index) => ({
  left: `${(index * 23) % 100}%`,
  backgroundColor: colors[index % colors.length],
  animationDelay: `${(index % 8) * 0.12}s`,
  transform: `rotate(${index * 37}deg)`
}))

onMounted(() => {
  window.addEventListener('mousemove', updateMouse, { passive: true })
  requestAnimationFrame(() => { entered.value = true })
})

onUnmounted(() => {
  window.removeEventListener('mousemove', updateMouse)
})
</script>

<style scoped>
.animated-characters-container {
  position: relative;
  width: 550px;
  height: 400px;
  max-width: 100%;
}

.character-stage {
  position: relative;
  width: 550px;
  height: 400px;
  transform-origin: bottom center;
}

.character {
  position: absolute;
  bottom: 0;
  transition: transform 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: bottom center;
  will-change: transform;
}

.purple-character {
  left: 70px;
  z-index: 1;
  width: 180px;
  height: 400px;
  background: var(--app-primary-active);
  animation: character-enter 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

.black-character {
  left: 240px;
  z-index: 2;
  width: 120px;
  height: 310px;
  background: var(--app-text-primary);
  animation: character-enter 1s 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}

.orange-character {
  left: 0;
  z-index: 3;
  width: 240px;
  height: 150px;
  background: #ff9b6b;
  border-radius: 120px 120px 0 0;
  animation: character-enter 1.1s 0.1s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}

.yellow-character {
  left: 310px;
  z-index: 4;
  width: 140px;
  height: 230px;
  background: #e8d754;
  border-radius: 70px 70px 0 0;
  animation: character-enter 1s 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
}

.entrance-complete {
  animation: none;
}

.eyes {
  position: absolute;
  display: flex;
  transition: transform 0.15s ease-out;
}

.purple-eyes { left: 75px; top: 25px; gap: 32px; }
.black-eyes { left: 26px; top: 32px; gap: 24px; }
.orange-eyes { left: 112px; top: 60px; gap: 32px; }
.yellow-eyes { left: 52px; top: 40px; gap: 24px; }

.eyeball,
.pupil {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
}

.eyeball b,
.pupil {
  display: block;
  width: 7px;
  height: 7px;
  background: var(--app-text-primary);
  border-radius: 50%;
}

.pupil {
  width: 12px;
  height: 12px;
}

.purple-mouth,
.orange-mouth {
  position: absolute;
  display: block;
  background: #2d2d2d;
  transition: all 0.35s ease;
}

.purple-mouth {
  left: 97px;
  top: 57px;
  width: 24px;
  height: 8px;
  border-radius: 0 0 12px 12px;
}

.orange-mouth {
  left: 126px;
  top: 92px;
  width: 26px;
  height: 13px;
  border-radius: 0 0 13px 13px;
}

.mouth-typing { width: 8px; height: 28px; border-radius: 0; }
.mouth-sad { border-radius: 12px 12px 0 0; }
.mouth-happy { height: 16px; border-radius: 0 0 15px 15px; }

.yellow-mouth {
  position: absolute;
  left: 40px;
  top: 88px;
  width: 80px;
  height: 20px;
}

.yellow-mouth path {
  fill: none;
  stroke: var(--app-text-primary);
  stroke-width: 3;
  stroke-linecap: round;
}

.confetti-container {
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
}

.confetti-piece {
  position: absolute;
  top: -20px;
  width: 7px;
  height: 14px;
  animation: confetti-fall 4.5s linear forwards;
}

@keyframes character-enter {
  from { opacity: 0; transform: translateY(70px) scale(0.4); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes confetti-fall {
  to { opacity: 0.9; translate: 30px 110vh; rotate: 720deg; }
}

@media (max-width: 1200px) {
  .character-stage { transform: scale(0.86); transform-origin: bottom center; }
}
</style>
