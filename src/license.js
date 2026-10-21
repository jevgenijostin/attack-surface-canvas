// Deliberately public demo secret. This is a self-issuable UI gate, not payment security.
export const DEMO_SECRET = 'attack-surface-canvas-public-demo-v1';
const payload = 'asc-demo-pro-v1';
export async function issueDemoLicense() {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(DEMO_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload)));
  return `${payload}.${Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')}`;
}
export async function verifyLicense(value) {
  if (typeof value !== 'string' || !/^asc-demo-pro-v1\.[a-f0-9]{64}$/.test(value)) return false;
  return value === await issueDemoLicense();
}
export const canAddNode = (paid, count) => paid || count < 8;
export const canSaveScenario = (paid, count, replacing = false) => paid || replacing || count < 1;
export const canLoadTemplate = paid => paid;
