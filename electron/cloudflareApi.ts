import https from 'https'
import crypto from 'crypto'

// 通用 CF API 响应
interface CfResponse {
  success: boolean
  result?: unknown
  result_info?: { page: number; total_pages: number }
  errors?: Array<{ message: string }>
}

/** 解码 tunnel token */
export function decodeToken(token: string): { accountId: string; tunnelId: string; secret: string } | null {
  try {
    const json = Buffer.from(token, 'base64').toString('utf-8')
    const parsed = JSON.parse(json)
    return { accountId: parsed.a, tunnelId: parsed.t, secret: parsed.s }
  } catch {
    return null
  }
}

function cfRequest(method: string, path: string, apiToken: string, body?: unknown): Promise<CfResponse> {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : undefined
    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: `/client/v4${path}`,
      method,
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let body = ''
      res.on('data', (chunk) => { body += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch { reject(new Error(`无法解析响应: ${body.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('API 请求超时')) })
    if (data) req.write(data)
    req.end()
  })
}

/** 验证 API Token 是否有效 */
export async function verifyToken(apiToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await cfRequest('GET', '/user/tokens/verify', apiToken)
    return res.success ? { success: true } : { success: false, error: res.errors?.[0]?.message || '验证失败' }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 获取账户列表 */
export async function listAccounts(apiToken: string): Promise<{ success: boolean; accounts?: Array<{ id: string; name: string }>; error?: string }> {
  try {
    const res = await cfRequest('GET', '/accounts?per_page=50', apiToken)
    if (!res.success) return { success: false, error: res.errors?.[0]?.message || '获取账户失败' }
    const accounts = (res.result as Array<{ id: string; name: string }>)
    return { success: true, accounts }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 创建新隧道 */
export async function createTunnel(
  accountId: string, name: string, apiToken: string
): Promise<{ success: boolean; tunnel?: { id: string; name: string }; error?: string }> {
  try {
    // 生成随机 secret
    const secret = crypto.randomBytes(32).toString('base64')
    const res = await cfRequest('POST', `/accounts/${accountId}/cfd_tunnel`, apiToken, {
      name,
      tunnel_secret: secret,
      config_src: 'cloudflare',
    })
    if (res.success && res.result) {
      const t = res.result as { id: string; name: string }
      return { success: true, tunnel: { id: t.id, name: t.name } }
    }
    return { success: false, error: res.errors?.[0]?.message || '创建失败' }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 获取账户下所有隧道 */
export async function listTunnels(
  accountId: string, apiToken: string
): Promise<{ success: boolean; tunnels?: Array<{ id: string; name: string; status: string; created_at: string }>; error?: string }> {
  try {
    const res = await cfRequest('GET', `/accounts/${accountId}/cfd_tunnel?is_deleted=false&per_page=50`, apiToken)
    if (!res.success) return { success: false, error: res.errors?.[0]?.message || '获取隧道失败' }
    const tunnels = (res.result as Array<{ id: string; name: string; status: string; created_at: string }>)
    return { success: true, tunnels }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 获取隧道的 token */
export async function getTunnelToken(
  accountId: string, tunnelId: string, apiToken: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    const res = await cfRequest('GET', `/accounts/${accountId}/cfd_tunnel/${tunnelId}/token`, apiToken)
    if (res.success && res.result) {
      return { success: true, token: res.result as string }
    }
    return { success: false, error: res.errors?.[0]?.message || '获取 Token 失败' }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 获取账户下所有 zone（域名） */
export async function listZones(apiToken: string): Promise<{ success: boolean; zones?: Array<{ id: string; name: string; status: string }>; error?: string }> {
  try {
    const allZones: Array<{ id: string; name: string; status: string }> = []
    let page = 1

    while (true) {
      const res = await cfRequest('GET', `/zones?per_page=50&page=${page}`, apiToken)
      if (!res.success) {
        return { success: false, error: res.errors?.[0]?.message || '获取域名失败' }
      }
      const zones = res.result as Array<{ id: string; name: string; status: string }>
      allZones.push(...zones)

      if (!res.result_info || page >= res.result_info.total_pages) break
      page++
    }

    return { success: true, zones: allZones }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 获取某个 zone 下的所有 DNS 记录 */
export async function listDnsRecords(
  zoneId: string,
  apiToken: string
): Promise<{ success: boolean; records?: Array<{ id: string; name: string; type: string; content: string; proxied: boolean }>; error?: string }> {
  try {
    const res = await cfRequest('GET', `/zones/${zoneId}/dns_records?per_page=100`, apiToken)
    if (!res.success) {
      return { success: false, error: res.errors?.[0]?.message || '获取 DNS 记录失败' }
    }
    const records = (res.result as Array<{ id: string; name: string; type: string; content: string; proxied: boolean }>)
    return { success: true, records }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 获取隧道的 ingress 配置 */
export async function getTunnelConfig(
  accountId: string, tunnelId: string, apiToken: string
): Promise<{ success: boolean; ingress?: Array<{ hostname?: string; service: string }>; error?: string; raw?: unknown }> {
  try {
    const res = await cfRequest('GET', `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, apiToken)
    if (res.success) {
      // result 可能是 { config: { ingress } } 或直接包含 ingress
      const result = res.result as any
      const ingress = result?.config?.ingress || result?.ingress || []
      return { success: true, ingress, raw: result }
    }
    return { success: false, error: res.errors?.[0]?.message || '未知错误', raw: res }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 更新隧道的 ingress 配置（全量替换） */
export async function updateTunnelConfig(
  accountId: string, tunnelId: string, apiToken: string,
  ingress: Array<{ hostname?: string; service: string; originRequest?: Record<string, unknown> }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const hasDefault = ingress.some((r) => !r.hostname)
    const rules = hasDefault ? ingress : [...ingress, { service: 'http_status:404' }]
    const res = await cfRequest('PUT', `/accounts/${accountId}/cfd_tunnel/${tunnelId}/configurations`, apiToken, {
      config: { ingress: rules }
    })
    if (res.success) return { success: true }
    return { success: false, error: `${res.errors?.[0]?.message || '未知错误'} (raw: ${JSON.stringify(res).slice(0, 300)})` }
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** 为隧道的 hostname 创建/删除 CNAME DNS 记录 */
export async function ensureTunnelDns(
  tunnelId: string,
  hostnames: string[],
  removedHostnames: string[],
  apiToken: string,
  zones: Array<{ id: string; name: string }>
): Promise<{ created: string[]; removed: string[]; errors: string[] }> {
  const created: string[] = []
  const removed: string[] = []
  const errors: string[] = []
  const cnameTarget = `${tunnelId}.cfargotunnel.com`

  // 创建新的 DNS 记录
  for (const hostname of hostnames) {
    if (!hostname) continue
    const zone = zones.find(z => hostname === z.name || hostname.endsWith('.' + z.name))
    if (!zone) {
      errors.push(`${hostname}: 找不到 zone (zones: ${zones.map(z => z.name).join(',')})`)
      continue
    }

    try {
      // 检查是否已存在（CNAME 或其他类型）
      const existing = await cfRequest('GET', `/zones/${zone.id}/dns_records?name=${hostname}`, apiToken)
      const records = (existing.result as any[]) || []

      if (records.length > 0) {
        const record = records[0]
        if (record.type === 'CNAME' && record.content === cnameTarget) {
          continue // 已存在且正确
        }
        // 存在但不对，删掉重建
        await cfRequest('DELETE', `/zones/${zone.id}/dns_records/${record.id}`, apiToken)
      }

      const res = await cfRequest('POST', `/zones/${zone.id}/dns_records`, apiToken, {
        type: 'CNAME',
        name: hostname,
        content: cnameTarget,
        proxied: true,
        ttl: 1,
      })

      if (res.success) {
        created.push(hostname)
      } else {
        errors.push(`${hostname}: ${JSON.stringify(res.errors || res).slice(0, 200)}`)
      }
    } catch (err: unknown) {
      errors.push(`${hostname}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // 删除移除的 DNS 记录
  for (const hostname of removedHostnames) {
    if (!hostname) continue
    const zone = zones.find(z => hostname === z.name || hostname.endsWith('.' + z.name))
    if (!zone) continue

    try {
      const existing = await cfRequest('GET', `/zones/${zone.id}/dns_records?name=${hostname}`, apiToken)
      const records = (existing.result as any[]) || []
      for (const record of records) {
        if (record.type === 'CNAME' && record.content === cnameTarget) {
          const del = await cfRequest('DELETE', `/zones/${zone.id}/dns_records/${record.id}`, apiToken)
          if (del.success) removed.push(hostname)
        }
      }
    } catch {}
  }

  return { created, removed, errors }
}
