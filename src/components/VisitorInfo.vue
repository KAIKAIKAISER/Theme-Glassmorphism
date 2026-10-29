<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'

interface VisitorData {
  ip: string
  country: string
}

interface VisitorProvider {
  url: string
  normalize: (data: unknown) => VisitorData | null
}

type JsonRecord = Record<string, unknown>

const visitorFetchTimeout = 8000
const mobileScrollIdleDelay = 700
const mobileViewportQuery = '(max-width: 767px)'

const show = ref(false)
const visitorLoading = ref(true)
const mobileScrolling = ref(false)
const visitor = ref<VisitorData>({
  ip: '',
  country: '',
})

const visitorProviders: VisitorProvider[] = [
  {
    url: 'https://ipwho.is/',
    normalize: normalizeIpwhoData,
  },
  {
    url: 'https://ipapi.co/json/',
    normalize: normalizeIpapiData,
  },
  {
    url: 'https://api.ip.sb/geoip',
    normalize: normalizeIpSbData,
  },
]

const displayIp = computed(() => visitor.value.ip || (visitorLoading.value ? '获取中' : '未获取到'))
const displayCountry = computed(() => visitor.value.country || (visitorLoading.value ? '定位中' : '未知地区'))

let mobileViewport: MediaQueryList | null = null
let scrollIdleTimer: number | undefined

function handleScroll(): void {
  if (!mobileViewport?.matches)
    return

  mobileScrolling.value = true
  if (scrollIdleTimer !== undefined)
    window.clearTimeout(scrollIdleTimer)
  scrollIdleTimer = window.setTimeout(() => {
    mobileScrolling.value = false
    scrollIdleTimer = undefined
  }, mobileScrollIdleDelay)
}

onMounted(async () => {
  mobileViewport = window.matchMedia(mobileViewportQuery)
  window.addEventListener('scroll', handleScroll, { passive: true })

  window.setTimeout(() => {
    show.value = true
  }, 600)

  try {
    const data = await fetchVisitorData()
    if (data) {
      visitor.value = data
      return
    }
  }
  finally {
    visitorLoading.value = false
  }
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (scrollIdleTimer !== undefined)
    window.clearTimeout(scrollIdleTimer)
})

async function fetchVisitorData(): Promise<VisitorData | null> {
  for (const provider of visitorProviders) {
    const data = await fetchProviderData(provider)
    if (data)
      return data
  }

  return null
}

async function fetchProviderData(provider: VisitorProvider): Promise<VisitorData | null> {
  try {
    const data = await fetchJsonWithTimeout(provider.url)
    return provider.normalize(data)
  }
  catch {
    return null
  }
}

async function fetchJsonWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), visitorFetchTimeout)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok)
      throw new Error(`Visitor info request failed: ${response.status}`)

    return await response.json()
  }
  finally {
    window.clearTimeout(timeoutId)
  }
}

function normalizeIpwhoData(data: unknown): VisitorData | null {
  if (!isRecord(data) || data.success === false)
    return null

  return createVisitorData({
    ip: data.ip,
    country: data.country,
  })
}

function normalizeIpapiData(data: unknown): VisitorData | null {
  if (!isRecord(data) || data.error === true)
    return null

  return createVisitorData({
    ip: data.ip,
    country: data.country_name,
  })
}

function normalizeIpSbData(data: unknown): VisitorData | null {
  if (!isRecord(data))
    return null

  return createVisitorData({
    ip: data.ip,
    country: data.country,
  })
}

function createVisitorData(data: { ip?: unknown; country?: unknown }): VisitorData | null {
  const ip = readString(data.ip)
  if (!ip)
    return null

  return {
    ip,
    country: readString(data.country),
  }
}

function isRecord(data: unknown): data is JsonRecord {
  return typeof data === 'object' && data !== null
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
</script>

<template>
  <!-- 底部居中 IP 条（仅显示 IP 和国家/地区） -->
  <Transition name="slide-up">
    <div
      v-if="show && !mobileScrolling"
      data-visitor-compact-bar
      class="visitor-compact-bar fixed left-1/2 z-50 flex w-max -translate-x-1/2
             items-center gap-1.5 rounded-full px-3 py-1.5 md:gap-2 md:px-4
             bg-white/55 dark:bg-black/50
             backdrop-blur-md
             border border-white/40 dark:border-white/10
             shadow-lg text-[12px] md:text-[13px] select-none whitespace-nowrap"
    >
      <Icon icon="icon-park-outline:earth" :width="14" :height="14" class="text-blue-500 shrink-0" />
      <span class="hidden text-muted-foreground sm:inline">Your IP:</span>
      <span class="min-w-0 truncate font-semibold text-foreground">{{ displayIp }}</span>
      <span class="text-muted-foreground/40 shrink-0">|</span>
      <span class="max-w-28 shrink-0 truncate text-muted-foreground sm:max-w-none">{{ displayCountry }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.visitor-compact-bar {
  bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
  bottom: calc(0.75rem + var(--komari-safe-area-bottom, env(safe-area-inset-bottom, 0px)));
  max-width: calc(100vw - 1.5rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
  max-width: calc(
    100vw - 1.5rem - var(--komari-safe-area-left, env(safe-area-inset-left, 0px)) -
      var(--komari-safe-area-right, env(safe-area-inset-right, 0px))
  );
}

@media (min-width: 768px) {
  .visitor-compact-bar {
    bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    bottom: calc(1rem + var(--komari-safe-area-bottom, env(safe-area-inset-bottom, 0px)));
  }
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
