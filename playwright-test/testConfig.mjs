import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(thisDir, '..');

function loadEnvFile(relativePath) {
  const filePath = path.join(rootDir, relativePath);
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    let value = rawValue.trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile('.env');
loadEnvFile('playwright-test/.env');

export const BASE = process.env.TEST_BASE_URL || 'http://localhost:5173';
export const API = process.env.TEST_API_URL || 'http://localhost:4000';

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} must be set before running Playwright scripts`);
  }
  return value;
}

export function getAdminCredentials() {
  return {
    email: requireEnv('TEST_ADMIN_EMAIL'),
    password: requireEnv('TEST_ADMIN_PASSWORD'),
  };
}

export function getUserCredentials() {
  return {
    email: requireEnv('TEST_USER_EMAIL'),
    password: requireEnv('TEST_USER_PASSWORD'),
    name: process.env.TEST_USER_NAME || 'Test User',
  };
}

function parseAuthCookies(setCookieHeader) {
  if (!setCookieHeader) return [];
  return setCookieHeader.split(/,(?=\s*[^;,]+=)/).map((cookie) => {
    const [pair] = cookie.trim().split(';');
    const index = pair.indexOf('=');
    return {
      name: pair.slice(0, index),
      value: pair.slice(index + 1),
      url: BASE,
      httpOnly: true,
      secure: BASE.startsWith('https://'),
      sameSite: 'Lax',
    };
  }).filter(cookie => cookie.name && cookie.value);
}

export async function loginWithCredentials({ email, password }) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.user) {
    throw new Error(`Login failed: ${data.error || res.status}`);
  }
  return {
    user: data.user,
    cookies: parseAuthCookies(res.headers.get('set-cookie')),
  };
}

export function loginAsAdmin() {
  return loginWithCredentials({ ...getAdminCredentials(), role: 'admin' });
}

export function loginAsUser() {
  return loginWithCredentials(getUserCredentials());
}

export async function seedStorage(page, auth) {
  if (!auth.cookies?.length) throw new Error('Login response did not include auth cookie');
  await page.context().addCookies(auth.cookies);
}