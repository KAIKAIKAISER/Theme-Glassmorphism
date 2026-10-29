import type { CFHistoryPoint, CFServer, CFServersResponse } from './types'
import type { Client, NodeStatus, PingRecord, PingTaskInfo, StatusRecord } from '@/utils/rpc'
import { mapServerToNode } from './mapping.ts'

export const CFSM_PING_DEFINITIONS = [
  { id: 1, key: 'ct', name: '电信 V4', pingField: 'ping_ct', lossField: 'loss_ct', color: '#38bdf8' },
  { id: 2, key: 'cu', name: '联通 V4', pingField: 'ping_cu', lossField: 'loss_cu', color: '#fb923c' },
  { id: 3, key: 'cm', name: '移动 V4', pingField: 'ping_cm', lossField: 'loss_cm', color: '#34d399' },
  { id: 4, key: 'node_1', name: '电信 V6', pingField: 'ping_node_1', lossField: 'loss_node_1', color: '#f472b6' },
  { id: 5, key: 'node_2', name: '联通 V6', pingField: 'ping_node_2', lossField: 'loss_node_2', color: '#facc15' },
  { id: 6, key: 'node_3', name: '移动 V6', pingField: 'ping_node_3', lossField: 'loss_node_3', color: '#2dd4bf' },
  { id: 7, key: 'bd', name: 'BGP', pingField: 'ping_bd', lossField: 'loss_bd', color: '#a78bfa' },
] as const

const serverCache = new Map<string, CFServer>()
let cachedNodes: { clients: Record<string, Client>, statuses: Record<string, NodeStatus> } = { clients: {}, statuses: {} }
let lastFetchTime = 0
let pendingFetch: Promise<typeof cachedNodes> | undefined
let activeController: AbortController | undefined

export function getApiBase(): string {
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="apiBase"]')
    if (meta) {
      const content = meta.getAttribute('content')
      if (content) {
        const first = content.split(',')[0]?.trim()
        if (first) return first.replace(/\/+$/, '')
      }
    }
  }
  const envBase = import.meta.env.VITE_API_BASE
  if (envBase) return String(envBase).trim().replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

export function getAuthToken(): string {
  if (typeof window === 'undefined') return ''
  try {
    return window.localStorage.getItem('cfsm_jwt') || window.localStorage.getItem('jwt') || ''
  }
  catch {
    return ''
  }
}

export async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  const base = getApiBase()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const url = `${base}${cleanPath}`

  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const token = getAuthToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const timeout = AbortSignal.timeout(15000)
  const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout

  const response = await fetch(url, {
    headers,
    signal: combinedSignal,
    credentials: 'same-origin',
  })

  if (!response.ok) {
    throw new Error(`CF-Server-Monitor API Error: ${response.status} for ${cleanPath}`)
  }
  return response.json()
}

export function updateServersSnapshot(servers: CFServer[]) {
  const clients: Record<string, Client> = {}
  const statuses: Record<string, NodeStatus> = {}

  for (const s of servers) {
    const uuid = String(s.id)
    serverCache.set(uuid, s)
    const { client, status } = mapServerToNode(s)
    clients[uuid] = client
    statuses[uuid] = status
  }

  cachedNodes = { clients, statuses }
  lastFetchTime = Date.now()
  return cachedNodes
}

export async function readNodes() {
  if (Date.now() - lastFetchTime < 1500 && Object.keys(cachedNodes.clients).length > 0) {
    return cachedNodes
  }
  if (pendingFetch) return pendingFetch

  activeController = new AbortController()
  const current = request<CFServersResponse>('/api/servers', activeController.signal)
    .then((data) => {
      const servers = Array.isArray(data?.servers) ? data.servers : []
      return updateServersSnapshot(servers)
    })
    .finally(() => {
      if (pendingFetch === current) pendingFetch = undefined
    })

  pendingFetch = current
  return current
}

export function abortNodes() {
  activeController?.abort()
  pendingFetch = undefined
}

export function mappedNodes(_nodes?: unknown) {
  return cachedNodes
}

export function historyHours(_days: unknown, _authed: boolean): number {
  return 168 // 7 days
}

export function historyWindows(presets: number[], maxHours: number): number[] {
  return presets.filter(h => h <= maxHours)
}

export function windowLabel(hours: number): string {
  return hours % 24 === 0 ? `${hours / 24} 天` : `${hours} 小时`
}

export function getServerByUuid(uuid: string): CFServer | undefined {
  return serverCache.get(String(uuid))
}

export async function records(params: Record<string, unknown>, ping = false) {
  const uuid = String(params.uuid || '')
  const hours = Number(params.hours || 1)

  if (ping) {
    // Ping records for NodeMultiPing
    const server = getServerByUuid(uuid)
    if (!server) {
      return { records: [], tasks: [] }
    }

    const tasks: PingTaskInfo[] = []
    const recordsList: PingRecord[] = []

    const pingWindow = Array.isArray(server.ping) ? server.ping : []
    const lossWindow = Array.isArray(server.loss) ? server.loss : []
    const lossMap = new Map<number, Record<string, number | null>>()
    for (const l of lossWindow) {
      if (l && typeof l.ts === 'number') lossMap.set(l.ts, l)
    }

    for (const def of CFSM_PING_DEFINITIONS) {
      const rawPing = (server as unknown as Record<string, unknown>)[def.pingField]
      const rawLoss = (server as unknown as Record<string, unknown>)[def.lossField]
      if (rawPing === false && rawLoss === false && pingWindow.length === 0) {
        continue
      }

      const lossVal = typeof rawLoss === 'number' && Number.isFinite(rawLoss) ? rawLoss : 0
      const currentPing = typeof rawPing === 'number' && Number.isFinite(rawPing) && rawPing >= 0
        ? rawPing
        : rawPing === null ? -1 : undefined

      tasks.push({
        id: def.id,
        name: def.name,
        interval: 60,
        loss: lossVal,
        clients: [uuid],
        avg: currentPing !== undefined && currentPing >= 0 ? currentPing : undefined,
      })

      // Generate points from 2-hour window samples
      for (const p of pingWindow) {
        if (!p || typeof p.ts !== 'number') continue
        const val = p[def.key]
        if (val === undefined || val === null) continue
        const numVal = typeof val === 'number' && Number.isFinite(val) && val >= 0 ? val : -1
        const sampleLoss = lossMap.get(p.ts)?.[def.key]
        const bucketLoss = typeof sampleLoss === 'number' && Number.isFinite(sampleLoss) ? sampleLoss : 0

        recordsList.push({
          client: uuid,
          task_id: def.id,
          time: new Date(p.ts * 1000).toISOString(),
          value: numVal,
          monitor_bucket_loss: bucketLoss,
          monitor_window_loss: lossVal,
        })
      }

      // If ping window is empty but current ping exists, append latest point
      if (recordsList.filter(r => r.task_id === def.id).length === 0 && currentPing !== undefined) {
        recordsList.push({
          client: uuid,
          task_id: def.id,
          time: new Date(server.last_updated || server.timestamp || Date.now()).toISOString(),
          value: currentPing,
          monitor_bucket_loss: lossVal,
          monitor_window_loss: lossVal,
        })
      }
    }

    return { records: recordsList, tasks }
  }

  // Load records for InstanceDetail (history load metrics)
  if (!uuid) return { records: [] }
  try {
    const data = await request<{ history: Record<string, CFHistoryPoint[]> }>(`/api/history?id=${encodeURIComponent(uuid)}&hours=${hours}`)
    const points = data?.history?.[uuid] || []
    const mapped: StatusRecord[] = points.map((p) => {
      const server = getServerByUuid(uuid)
      const memTotal = Math.max(0, (Number(p.ram_total || server?.ram_total) || 0) * 1024 * 1024)
      const diskTotal = Math.max(0, (Number(p.disk_total || server?.disk_total) || 0) * 1024 * 1024)
      const swapTotal = Math.max(0, (Number(p.swap_total || server?.swap_total) || 0) * 1024 * 1024)

      return {
        client: uuid,
        time: new Date(p.ts * 1000).toISOString(),
        cpu: Number(p.cpu) || 0,
        ram: Math.max(0, (Number(p.ram_used) || 0) * 1024 * 1024),
        ram_total: memTotal,
        disk: Math.max(0, (Number(p.disk_used) || 0) * 1024 * 1024),
        disk_total: diskTotal,
        swap: Math.max(0, (Number(p.swap_used) || 0) * 1024 * 1024),
        swap_total: swapTotal,
        load: 0,
        load5: 0,
        load15: 0,
        net_in: Number(p.net_in_speed) || 0,
        net_out: Number(p.net_out_speed) || 0,
        net_total_up: 0,
        net_total_down: 0,
        process: Number(p.processes) || 0,
        connections: Number(p.tcp_conn) || 0,
        connections_udp: Number(p.udp_conn) || 0,
      }
    })
    return { records: mapped }
  }
  catch {
    return { records: [] }
  }
}

export async function dispatch(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  if (method === 'rpc.ping') {
    await readNodes()
    return 'pong'
  }
  if (method === 'common:getNodes') {
    return (await readNodes()).clients
  }
  if (method === 'common:getNodesLatestStatus') {
    return (await readNodes()).statuses
  }
  if (method === 'public:getNodesInformation') {
    return Object.values((await readNodes()).clients)
  }
  if (method === 'public:getRecordsByUUID' || method === 'public:getClientRecentRecords' || method === 'common:getNodeRecentStatus') {
    const r = await records(params)
    return method === 'public:getClientRecentRecords' ? r.records : r
  }
  if (method === 'common:getRecords') {
    return records(params, params.type === 'ping')
  }
  if (method === 'public:getPingRecords') {
    return records(params, true)
  }
  if (method === 'public:getPublicPingTasks') {
    const r = await records({ ...params, hours: 1 }, true)
    return r.tasks
  }
  return null
}
