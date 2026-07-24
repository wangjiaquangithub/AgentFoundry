import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.AGENTFOUNDRY_FRONTEND_URL || 'http://localhost:5174';
const UAT_PASSWORD = 'uat-pass-2026';

async function login(page: Page, username: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill(UAT_PASSWORD);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(platform|chat)/, { timeout: 10000 });
}

test.describe('Enterprise UAT — Leave Assistant', () => {
  test('employee initiates leave from chat', async ({ page }) => {
    await login(page, 'uat-employee');
    await page.goto(`${BASE_URL}/chat/uat-leave-assistant`);
    await page.getByTestId('chat-message-input').fill('我想请年假');
    await page.getByTestId('chat-send-button').click();
    // Agent should ask for dates and reason
    const reply = page.getByTestId('chat-assistant-message').last();
    await expect(reply).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Enterprise UAT — Report Assistant', () => {
  test('employee queries own attendance', async ({ page }) => {
    await login(page, 'uat-employee');
    await page.goto(`${BASE_URL}/chat/uat-report-assistant`);
    await page.getByTestId('chat-message-input').fill('查询我这个月的考勤');
    await page.getByTestId('chat-send-button').click();
    const reply = page.getByTestId('chat-assistant-message').last();
    await expect(reply).toBeVisible({ timeout: 30000 });
  });
});

test.describe('Enterprise UAT — Approval Center', () => {
  test('manager can see pending approvals', async ({ page }) => {
    await login(page, 'uat-manager');
    await page.goto(`${BASE_URL}/platform/enterprise`);
    await expect(page.getByTestId('approval-center')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Enterprise UAT — Disabled Account', () => {
  test('disabled account cannot login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByTestId('login-username').fill('uat-disabled');
    await page.getByTestId('login-password').fill(UAT_PASSWORD);
    await page.getByTestId('login-submit').click();
    await expect(page.getByTestId('login-error')).toBeVisible({ timeout: 5000 });
  });
});
