export const resourceSummary = () => ({
  totalGateways: 2,
  onlineGateways: 1,
  totalDevices: 125,
  onlineDevices: 120,
  printingDevices: 23,
  pausedDevices: 2,
  errorDevices: 1,
  unknownDevices: 4,
  offlineDevices: 1,
  lastReceivedAt: null,
})

export async function mockCloudManagement(page, role = 'OWNER', { login = true } = {}) {
  const calls = []
  let organization = {
    id: 'org',
    name: '测试组织',
    role,
    description: '组织资料说明',
    createdAt: 1000,
    ownerUsername: 'synthetic-owner',
    farmCount: 1,
    memberCount: role === 'OWNER' ? 2 : null,
    summary: resourceSummary(),
  }
  let farm = {
    id: 'farm',
    organizationId: 'org',
    name: '测试农场',
    description: '农场资料说明',
    location: '一号车间',
    createdAt: 1000,
    summary: resourceSummary(),
  }
  const members = [
    { id: 'owner', username: 'synthetic-owner', role: 'OWNER' },
    {
      id: 'viewer',
      userId: 'viewer',
      username: 'synthetic-viewer',
      role: 'VIEWER',
      explicitAccess: true,
      canResetPassword: true,
    },
  ]
  await page.route('https://cloud.test/api/v1/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname,
      method = req.method()
    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': '*',
        },
      })
      return
    }
    const body = req.postDataJSON()
    calls.push({ path, method, body })
    let data = { success: true },
      status = 200
    if (path.endsWith('/login'))
      data = {
        accessToken: 'synthetic-cloud-only',
        user: { id: 'owner', username: 'synthetic-owner' },
      }
    else if (path.endsWith('/organizations'))
      data = [{ id: organization.id, name: organization.name, role }]
    else if (path.endsWith('/org/profile') && method === 'PUT')
      organization = { ...organization, ...body }
    else if (path.endsWith('/farm/profile') && method === 'PUT') farm = { ...farm, ...body }
    else if (path.endsWith('/org/farms')) data = [farm]
    else if (path.endsWith('/organizations/org')) data = organization
    else if (path.endsWith('/farm/overview')) data = farm
    else if (path.endsWith('/printers')) data = { items: [], total: 0 }
    else if (path.endsWith('/gateways') && method === 'POST')
      data = {
        gatewayId: 'gateway',
        bindingToken: 'synthetic-once-binding-ticket',
        expiresAt: Date.now() + 60000,
      }
    else if (path.endsWith('/gateways'))
      data = [{ id: 'gateway', name: '测试网关', bound: true, revoked: false }]
    else if (path.endsWith('/members')) data = members
    else if (path.endsWith('/audit/page'))
      data = {
        items: [
          {
            id: 'audit',
            action: 'FARM_PROFILE_UPDATED',
            actor_id: 'owner',
            target_id: 'farm',
            created_at: 1000,
          },
        ],
        total: 1,
        page: 1,
        size: 30,
      }
    else if (method === 'DELETE' && path.endsWith('/farms/farm')) {
      status = 409
      data = { code: 'FARM_NOT_EMPTY' }
    }
    await route.fulfill({
      status,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: JSON.stringify(data),
    })
  })
  if (!login) return calls
  await page.goto('/cloud')
  await page.getByPlaceholder('https://cloud.example.com').fill('https://cloud.test')
  await page.getByPlaceholder('云端用户名', { exact: true }).fill('synthetic-owner')
  await page.getByPlaceholder('云端密码', { exact: true }).fill('synthetic-password')
  await page.getByRole('button', { name: '登录云端', exact: true }).click()
  await page.getByRole('button', { name: '组织与农场管理', exact: true }).click()
  return calls
}
