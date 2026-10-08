import { useEffect, useState } from 'react';

export async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return r.json();
}

export const isRuid = (v) => /^[0-9a-f]{32}$/i.test(v || '');

// RUID 조회 결과는 한 번만 받아 두고 재사용한다.
const resourceCache = new Map();
export function lookupResource(ruid) {
  ruid = (ruid || '').toLowerCase();
  if (!isRuid(ruid)) return Promise.resolve(null);
  if (!resourceCache.has(ruid)) resourceCache.set(ruid, api('GET', '/api/resource/' + ruid));
  return resourceCache.get(ruid);
}

export function useResource(ruid) {
  const [res, setRes] = useState(null);
  useEffect(() => {
    let alive = true;
    setRes(null);
    lookupResource(ruid).then((r) => alive && setRes(r));
    return () => { alive = false; };
  }, [ruid]);
  return res;
}
