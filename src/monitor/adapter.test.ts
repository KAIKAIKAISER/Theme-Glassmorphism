import assert from 'node:assert/strict'
import { mapServerToNode } from './mapping.ts'
import type { CFServer } from './types.ts'

const server: CFServer = {
  id: 7,
  name: 'JP Node',
  region: 'JP',
  online: 1,
  os: 'Debian',
  cpu_info: 'AMD EPYC',
  cpu_cores: 4,
  cpu_usage: 25,
  ram_total: 1024,
  ram_used: 512,
  disk_total: 20480,
  disk_used: 5120,
  swap_total: 1024,
  swap_used: 0,
  net_in_speed: 1024,
  net_out_speed: 2048,
  net_rx_monthly: 1000000,
  net_tx_monthly: 2000000,
  net_rx_total: 10000000,
  net_tx_total: 20000000,
  load_avg: '0.15 0.10 0.05',
  sort_order: 1,
  price: 10,
  currency: 'USD',
  billing_cycle: 'yearly',
  expire_date: '2027-01-01',
  traffic_limit: '1000.0',
  traffic_calc_type: 'total',
}

const { client, status } = mapServerToNode(server)
assert.equal(client.uuid, '7')
assert.equal(client.name, 'JP Node')
assert.equal(client.region, 'JP')
assert.equal(client.billing_cycle, 365)
assert.equal(client.currency, 'USD')
assert.equal(status.online, true)
assert.equal(status.cpu, 25)
assert.equal(status.ram, 512 * 1024 * 1024)
assert.equal(status.ram_total, 1024 * 1024 * 1024)
assert.equal(status.disk, 5120 * 1024 * 1024)
assert.equal(status.disk_total, 20480 * 1024 * 1024)
assert.equal(status.net_in, 1024)
assert.equal(status.net_out, 2048)
assert.equal(client.traffic_limit, 1000 * 1024 * 1024 * 1024)

console.log('CFServer adapter mapping tests passed!')
