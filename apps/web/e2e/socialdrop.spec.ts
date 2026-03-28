import { test, expect, Page } from '@playwright/test';

// ── helpers ──────────────────────────────────────────────────────────────────

const PASSWORD = process.env.APP_PASSWORD ?? 'changeme';

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/^\/((?!login).)*$/); // Wait until redirected away from /login
}

// ── tests ────────────────────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('login page is accessible', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('SocialDrop');
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('wrong password shows error', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="password"]', 'wrong-password-xyz');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Contraseña incorrecta')).toBeVisible();
  });

  test('correct password redirects to dashboard', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/^\//);
    await expect(page.locator('h1')).toContainText('Dashboard');
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/');
  });

  test('renders stat cards', async ({ page }) => {
    // Each stat card has a data-testid
    const cards = page.locator('[data-testid^="stat-card-"]');
    await expect(cards).toHaveCount(4);
  });

  test('shows recent posts table', async ({ page }) => {
    await expect(page.locator('h2', { hasText: 'Posts Recientes' })).toBeVisible();
  });
});

test.describe('New Post form', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/posts/new');
  });

  test('renders form fields', async ({ page }) => {
    await expect(page.locator('[data-testid="caption-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-post-btn"]')).toBeVisible();
    await expect(page.locator('[data-testid="platform-twitter"]')).toBeVisible();
    await expect(page.locator('[data-testid="platform-instagram"]')).toBeVisible();
    await expect(page.locator('[data-testid="platform-facebook"]')).toBeVisible();
    await expect(page.locator('[data-testid="platform-tiktok"]')).toBeVisible();
    await expect(page.locator('[data-testid="platform-youtube"]')).toBeVisible();
  });

  test('shows validation error when submitting empty caption', async ({ page }) => {
    await page.click('[data-testid="submit-post-btn"]');
    // Toast error should appear
    await expect(page.locator('text=caption es requerido')).toBeVisible({ timeout: 5000 });
  });

  test('shows validation error when no platform selected', async ({ page }) => {
    await page.fill('[data-testid="caption-input"]', 'Test caption');
    await page.click('[data-testid="submit-post-btn"]');
    await expect(page.locator('text=plataforma')).toBeVisible({ timeout: 5000 });
  });

  test('publish-now checkbox hides datetime input', async ({ page }) => {
    // By default, datetime input should be visible
    const datetimeInput = page.locator('input[type="datetime-local"]');
    await expect(datetimeInput).toBeVisible();

    // After checking "publish now", datetime input should disappear
    await page.check('[data-testid="publish-now-checkbox"]');
    await expect(datetimeInput).not.toBeVisible();
  });

  test('platform toggle works', async ({ page }) => {
    const twitterBtn = page.locator('[data-testid="platform-twitter"]');
    // Initially not selected (no indigo border class)
    await expect(twitterBtn).not.toHaveClass(/border-indigo-500/);

    // Click to select
    await twitterBtn.click();
    await expect(twitterBtn).toHaveClass(/border-indigo-500/);

    // Click again to deselect
    await twitterBtn.click();
    await expect(twitterBtn).not.toHaveClass(/border-indigo-500/);
  });
});

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('can navigate to calendar page', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('h1')).toContainText('Calendario');
  });

  test('can navigate to integrations page', async ({ page }) => {
    await page.goto('/integrations');
    await expect(page.locator('h1')).toBeVisible();
  });
});
