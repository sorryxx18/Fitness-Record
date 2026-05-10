import { GAS_URL } from '../lib/fitnessCore.js';

export async function gasPost(body) {
  const resp = await fetch(GAS_URL, { method: 'POST', body: new URLSearchParams(body) });
  return resp.json();
}

export async function gasPostJSON(body) {
  const resp = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify(body),
  });
  return resp.json();
}
