export interface CFServer {
  id: string | number
  name: string
  server_group?: string
  tags?: string
  price?: string | number
  billing_cycle?: string
  auto_renewal?: string | boolean
  currency?: string
  expire_date?: string
  traffic_limit?: string
  traffic_calc_type?: string
  reset_day?: number
  sort_order?: number
  cpu?: number
  cpu_usage?: number
  load_avg?: string
  net_in_speed?: number
  net_out_speed?: number
  net_rx?: number
  net_tx?: number
  net_rx_monthly?: number
  net_tx_monthly?: number
  processes?: number
  tcp_conn?: number
  udp_conn?: number
  ram_total?: number
  ram_used?: number
  swap_total?: number
  swap_used?: number
  disk_total?: number
  disk_used?: number
  cpu_cores?: number
  cpu_info?: string
  arch?: string
  os?: string
  kernel_version?: string
  region?: string
  ip_v4?: string
  ip_v6?: string
  boot_time?: number | string
  last_updated?: number
  timestamp?: number
  online?: boolean
  ping_ct?: number | null | false
  ping_cu?: number | null | false
  ping_cm?: number | null | false
  ping_node_1?: number | null | false
  ping_node_2?: number | null | false
  ping_node_3?: number | null | false
  loss_ct?: number | null | false
  loss_cu?: number | null | false
  loss_cm?: number | null | false
  loss_node_1?: number | null | false
  loss_node_2?: number | null | false
  loss_node_3?: number | null | false
  ping?: Array<Record<string, number | null>>
  loss?: Array<Record<string, number | null>>
}

export interface CFServersResponse {
  servers: CFServer[]
  stats?: {
    total?: number
    online?: number
    offline?: number
    globalSpeedIn?: number
    globalSpeedOut?: number
    globalNetTx?: number
    globalNetRx?: number
  }
  regionStats?: Record<string, number>
  sysConfig?: Record<string, unknown>
}

export interface CFHistoryPoint {
  ts: number
  cpu?: number
  cpu_usage?: number
  ram_used?: number
  ram_total?: number
  disk_used?: number
  disk_total?: number
  swap_used?: number
  swap_total?: number
  net_in_speed?: number
  net_out_speed?: number
  tcp_conn?: number
  udp_conn?: number
  processes?: number
  ping_ct?: number | null
  ping_cu?: number | null
  ping_cm?: number | null
  ping_node_1?: number | null
  ping_node_2?: number | null
  ping_node_3?: number | null
  loss_ct?: number | null
  loss_cu?: number | null
  loss_cm?: number | null
  loss_node_1?: number | null
  loss_node_2?: number | null
  loss_node_3?: number | null
}
