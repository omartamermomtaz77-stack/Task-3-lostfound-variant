import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../src/app.js';
import { User } from '../src/models/User.js';
import { Item } from '../src/models/Item.js';

let mongo;
let server;
let baseURL;

before(async () => {
  // Never read .env: all writes are confined to this disposable database.
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.JWT_EXPIRES_IN = '1h';
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([User.init(), Item.init()]);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseURL = `http://127.0.0.1:${server.address().port}/api`;
}, { timeout: 180000 });

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Item.deleteMany({})]);
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function request(path, { method = 'GET', body, token, authorization } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (authorization) headers.Authorization = authorization;
  const response = await fetch(baseURL + path, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, data: await response.json() };
}

async function register(email = 'sara@example.com') {
  const response = await request('/auth/register', {
    method: 'POST', body: { name: 'Sara Ahmed', email, password: 'secret123' }
  });
  assert.equal(response.status, 201);
  return response.data;
}

const report = { title: 'Black backpack', status: 'lost', category: 'accessories', location: 'Library 2nd floor', description: 'Blue keychain' };

test('registration hashes passwords, normalizes identity, and returns a working JWT', async () => {
  const result = await request('/auth/register', {
    method: 'POST', body: { name: ' Sara Ahmed ', email: ' Sara@Example.COM ', password: 'secret123' }
  });
  assert.equal(result.status, 201);
  assert.equal(result.data.user.name, 'Sara Ahmed');
  assert.equal(result.data.user.email, 'sara@example.com');
  assert.equal(result.data.user.password, undefined);
  const stored = await User.findById(result.data.user.id).select('+password');
  assert.notEqual(stored.password, 'secret123');
  assert.equal(await stored.comparePassword('secret123'), true);
  assert.equal((await User.findById(stored.id)).password, undefined);
  const me = await request('/auth/me', { token: result.data.token });
  assert.equal(me.status, 200);
  assert.deepEqual(me.data.user, result.data.user);
  for (const path of ['/users', `/users/${stored.id}`]) {
    const publicResponse = await request(path);
    assert.equal(publicResponse.status, 200);
    assert.ok(!JSON.stringify(publicResponse.data).includes(stored.password));
  }
});

test('registration validates input and consistently rejects duplicate email addresses', async () => {
  for (const body of [
    {}, { name: 'A', email: 'bad-email', password: '123' },
    { name: 'Sara', email: 'sara@example.com', password: '12345' },
    { name: 'Sara', email: 'sara@example.com', password: 'a'.repeat(73) },
    { name: 'Sara', email: 'sara@example.com', password: '🙂'.repeat(19) }
  ]) {
    assert.equal((await request('/auth/register', { method: 'POST', body })).status, 400);
  }
  const results = await Promise.all(['Sara@Example.com', 'sara@example.com'].map(email =>
    request('/auth/register', { method: 'POST', body: { name: 'Sara', email, password: 'secret123' } })
  ));
  assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
  assert.equal(results.find(result => result.status === 409).data.message, 'Email already used');
});

test('login accepts normalized emails and rejects invalid credentials', async () => {
  const account = await register();
  const login = await request('/auth/login', {
    method: 'POST', body: { email: ' SARA@EXAMPLE.COM ', password: 'secret123' }
  });
  assert.equal(login.status, 200);
  assert.deepEqual(login.data.user, account.user);
  assert.equal((await request('/auth/me', { token: login.data.token })).status, 200);
  for (const [email, password] of [['sara@example.com', 'wrong'], ['missing@example.com', 'secret123']]) {
    const response = await request('/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(response.status, 401);
    assert.equal(response.data.message, 'Invalid credentials');
  }
  assert.equal((await request('/auth/login', { method: 'POST', body: {} })).status, 400);
});

test('protected endpoints reject missing, malformed, expired, and forged tokens', async () => {
  const account = await register();
  const expired = jwt.sign({ id: account.user.id }, process.env.JWT_SECRET, { expiresIn: -1 });
  const forged = jwt.sign({ id: account.user.id }, 'wrong-secret');
  const invalidPayload = jwt.sign({ id: 'not-an-id' }, process.env.JWT_SECRET);
  const otherAlgorithm = jwt.sign({ id: account.user.id }, process.env.JWT_SECRET, { algorithm: 'HS384' });
  for (const options of [{}, { token: 'invalid' }, { token: expired }, { token: forged },
    { token: invalidPayload }, { token: otherAlgorithm }, { authorization: `Basic ${account.token}` }]) {
    assert.equal((await request('/auth/me', options)).status, 401);
    assert.equal((await request('/items', { ...options, method: 'POST', body: report })).status, 401);
  }
});

test('reporting and editing support public reads, filters, validation, duplicates, and claiming', async () => {
  const { token, user } = await register();
  const created = await request('/items', { method: 'POST', token, body: report });
  assert.equal(created.status, 201);
  const id = created.data.item._id;
  assert.equal(created.data.item.reportedBy._id, user.id);
  assert.equal(created.data.item.reportedBy.email, user.email);
  assert.equal(created.data.item.reportedBy.password, undefined);
  assert.equal((await request(`/items/${id}`)).status, 200);
  assert.equal((await request('/items?status=lost&category=accessories')).data.items.length, 1);
  assert.equal((await request('/items?status=found')).data.items.length, 0);
  const duplicate = await request('/items', { method: 'POST', token, body: report });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.data.message, 'Duplicate item at this location');
  for (const body of [{ ...report, title: 'A' }, { ...report, status: 'missing' },
    { ...report, category: 'bags' }, { ...report, reportedBy: user.id }]) {
    assert.equal((await request('/items', { method: 'POST', token, body })).status, 400);
  }
  const edited = await request(`/items/${id}`, { method: 'PATCH', token, body: { status: 'claimed' } });
  assert.equal(edited.status, 200);
  assert.equal(edited.data.item.title, report.title);
  assert.equal(edited.data.item.status, 'claimed');
  assert.equal(edited.data.item.reportedBy._id, user.id);
  assert.equal((await request(`/items/${id}`, { method: 'PATCH', token, body: { reportedBy: user.id } })).status, 400);
  const second = await request('/items', { method: 'POST', token, body: { ...report, title: 'Another backpack' } });
  assert.equal(second.status, 201);
  const duplicateEdit = await request(`/items/${second.data.item._id}`, {
    method: 'PATCH', token, body: { title: report.title }
  });
  assert.equal(duplicateEdit.status, 409);
  assert.equal(duplicateEdit.data.message, 'Duplicate item at this location');
  assert.equal((await request('/items/not-an-id')).status, 400);
  assert.equal((await request('/items/000000000000000000000000')).status, 404);
  const optional = await request('/items', { method: 'POST', token, body: { title: 'Keys' } });
  assert.equal(optional.status, 201);
  assert.equal(optional.data.item.category, 'other');
  assert.equal(optional.data.item.status, 'lost');
  assert.equal((await request(`/items/${id}`, { method: 'DELETE', token })).status, 200);
  assert.equal((await request(`/items/${id}`)).status, 404);
});

test('only the reporter can change items, and only the owner can change an account', async () => {
  const owner = await register();
  const other = await register('other@example.com');
  const created = await request('/items', { method: 'POST', token: owner.token, body: report });
  const itemURL = `/items/${created.data.item._id}`;
  for (const method of ['PATCH', 'DELETE']) {
    const response = await request(itemURL, { method, token: other.token, body: method === 'PATCH' ? { status: 'claimed' } : undefined });
    assert.equal(response.status, 403);
    assert.match(response.data.message, /items you reported/);
    assert.equal((await request(`/users/${owner.user.id}`, { method, token: other.token, body: { name: 'Changed' } })).status, 403);
  }
  assert.equal((await request('/users', { method: 'POST', body: {} })).status, 404);
  assert.equal((await request(`/users/${owner.user.id}`, { method: 'PATCH', token: owner.token, body: { name: 'New Name' } })).status, 200);
  const me = await request('/auth/me', { token: owner.token });
  assert.equal(me.data.user.name, 'New Name');
  assert.equal((await request(`/users/${owner.user.id}`, { method: 'DELETE', token: owner.token })).status, 200);
  assert.equal((await request('/auth/me', { token: owner.token })).status, 401);
  assert.equal((await request('/items', { method: 'POST', token: owner.token, body: { title: 'Keys' } })).status, 401);
});
