import { expect, test } from '@playwright/test'

const events = [
  {
    id: 1,
    source: 'clipboard',
    event_type: 'snippet',
    title: 'Copied SQL query',
    content: 'select * from events;',
    metadata: { language: 'sql' },
    created_at: '2026-08-06T12:00:00Z',
    updated_at: '2026-08-06T12:00:00Z',
  },
  {
    id: 2,
    source: 'filesystem',
    event_type: 'file_snapshot',
    title: 'backend/app/main.py',
    content: 'app = create_app()',
    metadata: { path: '/workspace/backend/app/main.py' },
    created_at: '2026-08-06T12:05:00Z',
    updated_at: '2026-08-06T12:05:00Z',
  },
]

test('renders dashboard events and sends search filters', async ({ page }) => {
  const eventRequests: string[] = []

  await page.route('http://127.0.0.1:8000/events**', async (route) => {
    const request = route.request()
    if (request.method() === 'GET') {
      eventRequests.push(request.url())
      await route.fulfill({ json: events })
      return
    }

    await route.continue()
  })

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Recent activity' })).toBeVisible()
  await expect(page.getByText('Copied SQL query').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Event detail' })).toBeVisible()
  await expect(page.getByText('select * from events;').first()).toBeVisible()

  await page.getByPlaceholder('Search event titles and content...').fill('main')
  await page.getByLabel('Source').first().selectOption('filesystem')
  await page.getByLabel('Type').first().selectOption('file_snapshot')

  await expect
    .poll(() => eventRequests.some((url) => url.includes('q=main') && url.includes('source=filesystem')))
    .toBe(true)
})
