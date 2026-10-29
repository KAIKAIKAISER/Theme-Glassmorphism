import { useAppStore } from '@/stores/app'
import { useNodesStore } from '@/stores/nodes'
import { getSharedApi } from '@/utils/api'
import { abortNodes, getApiBase, getAuthToken, getServerByUuid, readNodes, updateServersSnapshot } from '@/monitor/transport'
import { mapServerToNode } from '@/monitor/mapping'

let socket: WebSocket | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let reconnect: ReturnType<typeof setTimeout> | undefined
let stopped = false
let generation = 0
const FAILURE_LIMIT = 3
let failures = 0
let updatedAt = 0
let resumedAt = 0

function interval() {
  return Math.max(3000, useAppStore().dataUpdateInterval * 1000)
}

function apply(data: Awaited<ReturnType<typeof readNodes>>) {
  useNodesStore().initNodes(data.clients, data.statuses)
  useAppStore().connectionError = false
  failures = 0
  updatedAt = Date.now()
}

async function poll(current = generation) {
  if (stopped || current !== generation) return
  let delay = interval()
  try {
    const nodes = await readNodes()
    if (current === generation && !stopped) apply(nodes)
  }
  catch {
    if (current === generation && !stopped) {
      failures++
      if (failures >= FAILURE_LIMIT) useAppStore().connectionError = true
      else delay = Math.min(delay, failures * 1000)
    }
  }
  if (!stopped && current === generation) timer = setTimeout(() => poll(current), delay)
}

function connect() {
  if (stopped) return
  const base = getApiBase()
  let wsUrl = ''
  if (base.startsWith('https://')) wsUrl = base.replace('https://', 'wss://')
  else if (base.startsWith('http://')) wsUrl = base.replace('http://', 'ws://')
  else if (typeof window !== 'undefined' && window.location) {
    wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
  }
  else return

  wsUrl += '/api/ws'
  const token = getAuthToken()
  if (token) wsUrl += `?token=${encodeURIComponent(token)}`

  try {
    socket = new WebSocket(wsUrl)
  }
  catch {
    if (!stopped) reconnect = setTimeout(connect, 10000)
    return
  }

  const activeSocket = socket
  socket.onopen = () => {
    useNodesStore().wsConnectionState = 'connected'
    activeSocket.send(JSON.stringify({ type: 'subscribe', scope: 'all' }))
  }

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data)
      if (msg.type === 'batchUpdate' && Array.isArray(msg.updates)) {
        const nodesStore = useNodesStore()
        for (const update of msg.updates) {
          const uuid = String(update.id)
          const cached = getServerByUuid(uuid)
          if (cached) {
            Object.assign(cached, update)
            const { client, status } = mapServerToNode(cached)
            nodesStore.initNodes({ [uuid]: client }, { [uuid]: status })
          }
        }
      }
      else if (msg.type === 'ping') {
        activeSocket.send(JSON.stringify({ type: 'pong', ts: Date.now() }))
      }
      else if (Array.isArray(msg.servers)) {
        const data = updateServersSnapshot(msg.servers)
        apply(data)
      }
    }
    catch {
      // ignore
    }
  }

  socket.onerror = () => activeSocket.close()
  socket.onclose = () => {
    useNodesStore().wsConnectionState = 'disconnected'
    if (!stopped) reconnect = setTimeout(connect, 10000)
  }
}

function pause() {
  generation++
  clearTimeout(timer)
  clearTimeout(reconnect)
  abortNodes()
  failures = 0
  if (socket) {
    socket.onclose = null
    socket.close()
    socket = undefined
  }
}

function resume() {
  pause()
  resumedAt = Date.now()
  connect()
  void poll()
}

function onVisibility() {
  if (stopped || useAppStore().loading) return
  if (document.hidden) pause()
  else resume()
}

function onWake() {
  if (stopped || useAppStore().loading || document.hidden) return
  if (Date.now() - Math.max(updatedAt, resumedAt) > interval() * 2) resume()
}

export async function initApp() {
  destroyInitManager()
  stopped = false
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pageshow', onWake)
  window.addEventListener('focus', onWake)
  const current = ++generation
  const store = useAppStore()
  store.loading = true

  try {
    const api = getSharedApi()
    for (;;) {
      try {
        const [settings, me, nodes] = await Promise.all([
          api.getPublicSettings(),
          api.getMe(),
          readNodes(),
        ])
        if (current !== generation) return
        store.publicSettings = settings
        store.updateLoginState(me.logged_in, me)
        document.title = settings.sitename || 'Server Monitor'
        apply(nodes)
        connect()
        break
      }
      catch {
        if (current !== generation) return
        failures++
        if (failures >= FAILURE_LIMIT) {
          store.connectionError = true
          break
        }
        await new Promise(resolve => setTimeout(resolve, failures * 1000))
        if (current !== generation) return
      }
    }
  }
  finally {
    if (current === generation) {
      store.loading = false
      if (!stopped) timer = setTimeout(() => poll(current), interval())
    }
  }
}

export function destroyInitManager() {
  stopped = true
  generation++
  clearTimeout(timer)
  clearTimeout(reconnect)
  abortNodes()
  if (socket) {
    socket.onclose = null
    socket.close()
    socket = undefined
  }
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pageshow', onWake)
  window.removeEventListener('focus', onWake)
}

export async function retryInitApp() {
  await initApp()
  return !useAppStore().connectionError
}

export function getInitManager() {
  return null
}
