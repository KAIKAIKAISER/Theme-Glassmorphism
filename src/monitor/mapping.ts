import type { CFServer } from './types'
import type { Client, NodeStatus } from '@/utils/rpc'

const NAMED_CYCLES: Record<string, number> = {
  month: 30,
  monthly: 30,
  quarter: 90,
  quarterly: 90,
  half_year: 180,
  semiannual: 180,
  year: 365,
  yearly: 365,
  annual: 365,
  biennial: 730,
  triennial: 1095,
  once: -1,
}

export function cycleDays(cycle: string | undefined): number {
  if (!cycle) return 30
  const normalized = cycle.toLowerCase().trim()
  if (normalized in NAMED_CYCLES) return NAMED_CYCLES[normalized]!
  const match = /^(\d+)m$/.exec(normalized)
  const months = match ? Number(match[1]) : 0
  if (months < 1 || months > 1200) return 30
  return months % 12 === 0 ? (months / 12) * 365 : months * 30
}

export function parseTrafficLimit(limit: string | number | undefined): number {
  if (!limit) return 0
  const raw = String(limit).trim().toUpperCase()
  const num = Number.parseFloat(raw)
  if (!Number.isFinite(num) || num <= 0) return 0
  if (raw.endsWith('TB') || raw.endsWith('T')) return num * 1024 * 1024 * 1024 * 1024
  if (raw.endsWith('GB') || raw.endsWith('G')) return num * 1024 * 1024 * 1024
  if (raw.endsWith('MB') || raw.endsWith('M')) return num * 1024 * 1024
  if (raw.endsWith('KB') || raw.endsWith('K')) return num * 1024
  if (raw.endsWith('B')) return num
  // In CF-Server-Monitor, raw numeric traffic_limit is configured in GB (e.g. 1000 or 1000.0)
  if (num > 1e11) return num
  return num * 1024 * 1024 * 1024
}

export function parseLoad(loadStr: string | undefined): [number, number, number] {
  if (!loadStr) return [0, 0, 0]
  const parts = String(loadStr).trim().split(/\s+/).map(Number)
  return [
    Number.isFinite(parts[0]) ? parts[0]! : 0,
    Number.isFinite(parts[1]) ? parts[1]! : 0,
    Number.isFinite(parts[2]) ? parts[2]! : 0,
  ]
}

export function isOnline(s: CFServer): boolean {
  if (s.online !== undefined) return Boolean(s.online)
  const last = Number(s.last_updated || s.timestamp || 0)
  return Date.now() - last < 300000
}

export function mapServerToNode(s: CFServer): { client: Client, status: NodeStatus } {
  const uuid = String(s.id)
  const online = isOnline(s)
  const load = parseLoad(s.load_avg)
  const memTotal = Math.max(0, (Number(s.ram_total) || 0) * 1024 * 1024)
  const ramUsed = Math.max(0, (Number(s.ram_used) || 0) * 1024 * 1024)
  const diskTotal = Math.max(0, (Number(s.disk_total) || 0) * 1024 * 1024)
  const diskUsed = Math.max(0, (Number(s.disk_used) || 0) * 1024 * 1024)
  const swapTotal = Math.max(0, (Number(s.swap_total) || 0) * 1024 * 1024)
  const swapUsed = Math.max(0, (Number(s.swap_used) || 0) * 1024 * 1024)

  const bootTime = Number(s.boot_time) || 0
  const uptime = bootTime > 0 ? Math.max(0, Math.floor((Date.now() - bootTime) / 1000)) : 0

  const monthUp = Number(s.net_tx_monthly) || 0
  const monthDown = Number(s.net_rx_monthly) || 0
  const trafficLimitType = String(s.traffic_calc_type || 'sum').toLowerCase()
  let trafficUsed = monthUp + monthDown
  if (trafficLimitType === 'up') trafficUsed = monthUp
  else if (trafficLimitType === 'down') trafficUsed = monthDown
  else if (trafficLimitType === 'max') trafficUsed = Math.max(monthUp, monthDown)

  const client: Client = {
    uuid,
    name: s.name || `Node-${uuid}`,
    cpu_name: s.cpu_info || 'CPU',
    virtualization: s.arch || '',
    arch: s.arch || '',
    cpu_cores: Number(s.cpu_cores) || 1,
    os: s.os || 'Linux',
    kernel_version: s.kernel_version || '',
    ipv4: s.ip_v4,
    ipv6: s.ip_v6,
    region: (s.region || 'UN').toUpperCase(),
    remark: s.tags || '',
    mem_total: memTotal,
    swap_total: swapTotal,
    disk_total: diskTotal,
    weight: Number(s.sort_order) || 0,
    price: Number(s.price) || 0,
    currency: s.currency || '¥',
    billing_cycle: cycleDays(s.billing_cycle),
    auto_renewal: Boolean(s.auto_renewal === '1' || s.auto_renewal === true),
    expired_at: s.expire_date || '',
    group: s.server_group || '',
    hidden: false,
    traffic_limit: parseTrafficLimit(s.traffic_limit),
    traffic_limit_type: trafficLimitType,
    created_at: '',
    updated_at: '',
  }

  const lastSeen = Number(s.last_updated || s.timestamp || Date.now())
  const status: NodeStatus = {
    client: uuid,
    time: new Date(lastSeen).toISOString(),
    online,
    cpu: Number(s.cpu !== undefined ? s.cpu : s.cpu_usage) || 0,
    ram: ramUsed,
    ram_total: memTotal,
    swap: swapUsed,
    swap_total: swapTotal,
    disk: diskUsed,
    disk_total: diskTotal,
    load: load[0],
    load5: load[1],
    load15: load[2],
    net_in: Number(s.net_in_speed) || 0,
    net_out: Number(s.net_out_speed) || 0,
    net_total_up: Number(s.net_tx) || 0,
    net_total_down: Number(s.net_rx) || 0,
    traffic_up: monthUp,
    traffic_down: monthDown,
    traffic_used: trafficUsed,
    process: Number(s.processes) || 0,
    connections: Number(s.tcp_conn) || 0,
    connections_udp: Number(s.udp_conn) || 0,
    uptime,
  }

  return { client, status }
}
