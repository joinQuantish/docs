#!/usr/bin/env node
/**
 * PnL parity demo — compare polynode's /v2/onchain/positions against
 * Polymarket's data-api /positions for the same wallet.
 *
 * No dependencies — uses built-in fetch (Node 18+).
 *
 * Usage:
 *   POLYNODE_KEY=pn_live_xxx node pnl_parity_demo.mjs <wallet>
 *   POLYNODE_KEY=pn_live_xxx node pnl_parity_demo.mjs                # uses default wallets
 */

const KEY = process.env.POLYNODE_KEY ?? 'pn_live_test_session_tracking_51eca107e9b347b589f5b0a04f98eb1d';

// Default test wallets — fresh, never used before in our internal tests
const WALLETS = process.argv[2]
  ? [process.argv[2]]
  : [
      '0x26d61145a64b1b5036c82a147dfeb7d56fa0cacc',  // $40 trade, fresh
      '0xeacdc6ca2ec4e9bf90e1e7d23676d0074ae3aaba',  // smaller trade, fresh
      '0x4473827eb3e463b37fbf5e5bf968910e0faea6e4',  // fresh
    ];

async function fetchPolymarket(wallet) {
  const url = `https://data-api.polymarket.com/positions?user=${wallet}&sizeThreshold=0&limit=2000`;
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) throw new Error(`PM ${r.status}`);
  return r.json();
}

async function fetchPolynode(wallet) {
  const url = `https://api.polynode.dev/v2/onchain/positions?wallet=${wallet}&status=all&limit=2000`;
  const r = await fetch(url, { headers: { 'x-api-key': KEY } });
  if (!r.ok) throw new Error(`polynode ${r.status}`);
  const j = await r.json();
  return Array.isArray(j) ? j : (j.positions ?? j.data ?? []);
}

function diff(a, b, tol = 0.01) {
  if (a == null && b == null) return { ok: true, diff: 0 };
  if (a == null || b == null) return { ok: false, diff: 'one-sided' };
  const d = Number(a) - Number(b);
  return { ok: Math.abs(d) < tol, diff: d };
}

function fmt(n, d = 4) {
  if (n == null) return 'null';
  if (typeof n === 'number') return n.toFixed(d);
  return String(n);
}

async function compare(wallet) {
  console.log('\n' + '═'.repeat(85));
  console.log(`WALLET: ${wallet}`);
  console.log('═'.repeat(85));

  const [pm, us] = await Promise.all([fetchPolymarket(wallet), fetchPolynode(wallet)]);
  console.log(`  PM positions:       ${pm.length}`);
  console.log(`  polynode positions: ${us.length}`);

  // Index by canonical position_id
  const pmByPid = new Map();
  for (const p of pm) pmByPid.set(String(p.asset), p);
  const usByPid = new Map();
  for (const p of us) usByPid.set(String(p.token_id), p);

  // Find shared positions
  const sharedPids = [...pmByPid.keys()].filter(k => usByPid.has(k));
  console.log(`  shared (open in both): ${sharedPids.length}`);

  if (sharedPids.length === 0) {
    console.log('  (no shared open positions to compare)');
    return { matched: 0, sub_penny: 0, sub_dollar: 0 };
  }

  console.log();
  console.log('  ' + 'token_id'.padEnd(18) +
              'PM avgPrice'.padStart(12) +
              ' Us avgPrice'.padStart(12) +
              '  PM realPnl'.padStart(13) +
              ' Us realPnl'.padStart(12) +
              '  match');
  console.log('  ' + '─'.repeat(83));

  let n_matched = 0, n_sub_penny = 0, n_sub_dollar = 0;
  for (const pid of sharedPids) {
    const p = pmByPid.get(pid);
    const u = usByPid.get(pid);
    const avgD = diff(p.avgPrice, u.avg_price, 0.005);
    const pnlD = diff(p.realizedPnl, u.realized_pnl, 0.01);
    const pnlD$1 = diff(p.realizedPnl, u.realized_pnl, 1.0);

    const status = avgD.ok && pnlD.ok ? '✓ exact'
                 : avgD.ok && pnlD$1.ok ? '✓ sub-$1'
                 : '✗ DRIFT';
    if (status.startsWith('✓ exact')) n_sub_penny++;
    if (status.startsWith('✓')) n_sub_dollar++;
    n_matched++;

    console.log(
      '  ' + (pid.slice(0, 8) + '…' + pid.slice(-6)).padEnd(18) +
      fmt(p.avgPrice).padStart(12) +
      fmt(u.avg_price).padStart(12) +
      fmt(p.realizedPnl, 2).padStart(13) +
      fmt(u.realized_pnl, 2).padStart(12) +
      '  ' + status
    );
  }

  console.log('  ' + '─'.repeat(83));
  console.log(`  RESULT: ${n_sub_penny}/${n_matched} sub-penny, ${n_sub_dollar}/${n_matched} sub-$1 match`);

  return { matched: n_matched, sub_penny: n_sub_penny, sub_dollar: n_sub_dollar };
}

async function main() {
  const t0 = Date.now();
  let totals = { matched: 0, sub_penny: 0, sub_dollar: 0 };
  for (const w of WALLETS) {
    try {
      const r = await compare(w);
      totals.matched += r.matched;
      totals.sub_penny += r.sub_penny;
      totals.sub_dollar += r.sub_dollar;
    } catch (e) {
      console.log(`\nERROR on ${w}: ${e.message}`);
    }
  }
  console.log('\n' + '═'.repeat(85));
  console.log('AGGREGATE');
  console.log('═'.repeat(85));
  if (totals.matched === 0) {
    console.log('  No comparable positions found across the test wallets.');
  } else {
    const sp = (totals.sub_penny / totals.matched * 100).toFixed(1);
    const sd = (totals.sub_dollar / totals.matched * 100).toFixed(1);
    console.log(`  Total positions compared:  ${totals.matched}`);
    console.log(`  Byte-perfect (sub-penny):  ${totals.sub_penny}/${totals.matched} = ${sp}%`);
    console.log(`  Sub-$1 match:              ${totals.sub_dollar}/${totals.matched} = ${sd}%`);
  }
  console.log(`  (ran in ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

main().catch(e => { console.error(e); process.exit(1); });
