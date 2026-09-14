const BASE_WIDTH = 1920
const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 20
const BASE_FONT_SIZE = 16

const setRootFontSize = () => {
  const width = window.innerWidth
  let fontSize = (width / BASE_WIDTH) * BASE_FONT_SIZE
  fontSize = Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, fontSize))
  document.documentElement.style.fontSize = `${fontSize}px`
  document.documentElement.dataset.scale = (fontSize / BASE_FONT_SIZE).toFixed(3)
}

const debounce = (callback, wait) => {
  let timeout
  return (...args) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => callback(...args), wait)
  }
}

if (typeof window !== 'undefined') {
  setRootFontSize()
  window.addEventListener('resize', debounce(setRootFontSize, 100))
  window.addEventListener('orientationchange', setRootFontSize)
}
