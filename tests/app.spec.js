import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

function email() {
  return `student-${randomUUID()}@example.com`;
}

async function fillRegistration(page, address) {
  await page.getByLabel('Name', { exact: true }).fill('Sara Ahmed');
  await page.getByLabel('Email', { exact: true }).fill(address);
  await page.getByLabel('Password (at least 6 characters)', { exact: true }).fill('secret123');
  await page.getByLabel('Confirm password', { exact: true }).fill('secret123');
}

async function register(page, address = email()) {
  await page.goto('/register');
  await fillRegistration(page, address);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL('/items');
  return address;
}

test('register, report, reload an edit, claim, logout, log in, and delete', async ({ page }) => {
  const address = email();
  const title = `Black backpack ${randomUUID()}`;
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));

  await page.goto('/items/new');
  await expect(page).toHaveURL('/login');
  await page.getByRole('link', { name: 'Register', exact: true }).last().click();
  await fillRegistration(page, address);
  await page.getByLabel('Confirm password', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match');
  await page.getByLabel('Confirm password', { exact: true }).fill('secret123');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page).toHaveURL('/items/new');

  await page.getByLabel('Title', { exact: true }).fill('A');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('at least 2');
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page.getByLabel('Status', { exact: true }).selectOption('found');
  await page.getByLabel('Category', { exact: true }).selectOption('accessories');
  await page.getByLabel('Location (optional)', { exact: true }).fill('Library 2nd floor');
  await page.getByLabel('Description (optional)', { exact: true }).fill('Blue keychain');
  const createdResponse = page.waitForResponse(response => response.url().endsWith('/api/items') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  const created = await createdResponse;
  expect(created.status()).toBe(201);
  expect(Object.keys(created.request().postDataJSON()).sort()).toEqual(['category', 'description', 'location', 'status', 'title']);
  await expect(page).toHaveURL('/items');
  let card = page.locator('.card').filter({ hasText: title });
  await expect(card).toContainText('Sara Ahmed');
  await card.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
  await expect(page.getByLabel('Status', { exact: true })).toHaveValue('found');
  await expect(page.getByLabel('Category', { exact: true })).toHaveValue('accessories');
  await expect(page.getByLabel('Location (optional)', { exact: true })).toHaveValue('Library 2nd floor');
  await expect(page.getByLabel('Description (optional)', { exact: true })).toHaveValue('Blue keychain');
  await page.screenshot({ path: 'test-results/report-item.png', fullPage: true });

  const editURL = page.url();
  await page.route('**/api/auth/me', async route => {
    await new Promise(resolve => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.reload();
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
  await expect(page).toHaveURL(editURL);
  await page.getByLabel('Status', { exact: true }).selectOption('claimed');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL('/items');
  await page.getByLabel('Filter by status', { exact: true }).selectOption('claimed');
  await page.getByLabel('Filter by category', { exact: true }).selectOption('accessories');
  await expect(page.locator('.card').filter({ hasText: title })).toContainText('claimed');

  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Report Item', exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
  await page.getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(address.toUpperCase());
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid credentials');
  await page.getByLabel('Password', { exact: true }).fill('secret123');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL('/items');
  card = page.locator('.card').filter({ hasText: title });
  await card.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(card).toHaveCount(0);
  expect(browserErrors).toEqual([]);
});

test('duplicate registration and duplicate reports show the server message', async ({ page }) => {
  const address = await register(page);
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await page.getByRole('link', { name: 'Register', exact: true }).click();
  await fillRegistration(page, address.toUpperCase());
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Email already used');
  await page.getByRole('link', { name: 'Login', exact: true }).last().click();
  await page.getByLabel('Email', { exact: true }).fill(address);
  await page.getByLabel('Password', { exact: true }).fill('secret123');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL('/items');
  const title = `Keys ${randomUUID()}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole('link', { name: 'Report Item', exact: true }).click();
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    if (attempt === 0) await expect(page).toHaveURL('/items');
  }
  await expect(page.getByRole('alert')).toHaveText('Duplicate item at this location');
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(title);
});

test('foreign edits show 403, failed loads disable saving, and invalid sessions return to login', async ({ page, request }) => {
  const ownerResponse = await request.post('/api/auth/register', {
    data: { name: 'Other Student', email: email(), password: 'secret123' }
  });
  expect(ownerResponse.status()).toBe(201);
  const owner = await ownerResponse.json();
  const itemResponse = await request.post('/api/items', {
    headers: { Authorization: `Bearer ${owner.token}` }, data: { title: `Wallet ${randomUUID()}` }
  });
  expect(itemResponse.status()).toBe(201);
  const { item } = await itemResponse.json();
  await register(page);
  await page.goto(`/items/${item._id}`);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(item.title);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('You can only edit items you reported');
  await page.goto('/items/000000000000000000000000');
  await expect(page.getByRole('alert')).toHaveText('Item not found');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
  await page.goto('/items/new');
  await page.evaluate(() => localStorage.setItem('token', 'invalid-token'));
  await page.getByLabel('Title', { exact: true }).fill('A report with an invalid session');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL('/login');
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();
});
