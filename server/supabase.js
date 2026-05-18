// Supabase 客户端配置
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';

// 通过 HTTP API 调用 Supabase (无需 @supabase/supabase-js 依赖)
async function supabaseQuery(table, options = {}) {
  const { method = 'GET', body, params } = options;

  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }

  const headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase ${table}: ${res.status} ${err}`);
  }

  if (method === 'GET' || method === 'POST') {
    return res.json();
  }
  return null;
}

module.exports = { supabaseQuery, SUPABASE_URL, SUPABASE_KEY };