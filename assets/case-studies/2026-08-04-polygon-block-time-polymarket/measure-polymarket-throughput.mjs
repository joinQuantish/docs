#!/usr/bin/env node

const rpcUrl = process.env.POLYGON_RPC_URL;
if (!rpcUrl) throw new Error("POLYGON_RPC_URL is required");

const windows = process.argv.slice(2);
if (windows.length === 0 || windows.some((value) => !value.includes("/"))) {
  throw new Error("Pass one or more START_ISO/END_ISO windows");
}

const scopes = [
  {
    version: "v1",
    addresses: [
      "0x4bfb41d5b3570defd03c39a9a4d8de6bd8b8982e",
      "0xc5d563a36ae78145c45a50134d48a1215220f80a",
    ],
    topic: "0xd0a08e8c493f9c94f29311604c9de1b4e8c8d4c06bd0c789af57f2d65bfec0f6",
  },
  {
    version: "v2",
    addresses: [
      "0xe111180000d2663c0091e4f400237545b87b996b",
      "0xe2222d279d744050d28e00520010520000310f59",
      "0xe2222d002000ba0053cef3375333610f64600036",
    ],
    topic: "0xd543adfd945773f1a62f74f0ee55a5e3b9b1a28262980ba90b1a89f2ea84d8ee",
  },
];

let requestId = 0;

async function rpc(method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++requestId, method, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json();
  if (!response.ok || body.error || body.result === undefined) {
    throw new Error(`${method}: ${body.error?.message ?? `HTTP ${response.status}`}`);
  }
  return body.result;
}

async function batch(method, parameterSets, size = 50) {
  const results = [];
  for (let offset = 0; offset < parameterSets.length; offset += size) {
    const chunk = parameterSets.slice(offset, offset + size);
    const requests = chunk.map((params) => ({ jsonrpc: "2.0", id: ++requestId, method, params }));
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(requests),
      signal: AbortSignal.timeout(30_000),
    });
    const body = await response.json();
    if (!response.ok || !Array.isArray(body)) throw new Error(`${method} batch: HTTP ${response.status}`);
    const byId = new Map(body.map((item) => [item.id, item]));
    for (const request of requests) {
      const item = byId.get(request.id);
      if (!item || item.error || item.result === undefined) {
        throw new Error(`${method} batch: ${item?.error?.message ?? `missing id ${request.id}`}`);
      }
      results.push(item.result);
    }
  }
  return results;
}

const hex = (number) => `0x${number.toString(16)}`;
const numeric = (value) => Number.parseInt(value, 16);

async function block(number) {
  return rpc("eth_getBlockByNumber", [hex(number), false]);
}

async function firstBlockAtOrAfter(targetSec, tip) {
  let low = 0;
  let high = tip;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = await block(middle);
    if (numeric(candidate.timestamp) < targetSec) low = middle + 1;
    else high = middle;
  }
  return low;
}

async function logsFor(scope, fromBlock, toBlock) {
  const logs = [];
  for (let start = fromBlock; start <= toBlock; start += 20) {
    const end = Math.min(start + 19, toBlock);
    const chunk = await rpc("eth_getLogs", [{
      fromBlock: hex(start),
      toBlock: hex(end),
      address: scope.addresses,
      topics: [scope.topic],
    }]);
    logs.push(...chunk);
  }
  return logs;
}

async function measure(spec, tip) {
  const [startText, endText] = spec.split("/");
  const startMs = Date.parse(startText);
  const endMs = Date.parse(endText);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error(`Invalid window: ${spec}`);
  }

  const fromBlock = await firstBlockAtOrAfter(Math.floor(startMs / 1000), tip);
  const afterBlock = await firstBlockAtOrAfter(Math.floor(endMs / 1000), tip);
  const toBlock = afterBlock - 1;
  const blockNumbers = Array.from({ length: toBlock - fromBlock + 1 }, (_, index) => fromBlock + index);
  const [headers, ...scopedLogs] = await Promise.all([
    batch("eth_getBlockByNumber", blockNumbers.map((number) => [hex(number), false])),
    ...scopes.map((scope) => logsFor(scope, fromBlock, toBlock)),
  ]);

  const durationSec = (endMs - startMs) / 1000;
  const allLogs = scopedLogs.flat();
  const uniqueSettlementTransactions = new Set(allLogs.map((log) => log.transactionHash.toLowerCase()));
  const transactionCount = headers.reduce((sum, header) => sum + header.transactions.length, 0);
  const timestamps = headers.map((header) => numeric(header.timestamp));
  const gaps = timestamps.slice(1).map((timestamp, index) => timestamp - timestamps[index]);
  const byVersion = Object.fromEntries(scopes.map((scope, index) => {
    const logs = scopedLogs[index];
    return [scope.version, {
      fills: logs.length,
      settlement_transactions: new Set(logs.map((log) => log.transactionHash.toLowerCase())).size,
    }];
  }));
  const byAddress = {};
  for (const log of allLogs) {
    const address = log.address.toLowerCase();
    byAddress[address] = (byAddress[address] ?? 0) + 1;
  }

  return {
    requested_window_utc: { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString(), duration_sec: durationSec },
    block_window: {
      from: fromBlock,
      to: toBlock,
      count: blockNumbers.length,
      from_hash: headers[0].hash,
      to_hash: headers.at(-1).hash,
      first_timestamp: new Date(timestamps[0] * 1000).toISOString(),
      last_timestamp: new Date(timestamps.at(-1) * 1000).toISOString(),
      mean_header_gap_sec: gaps.reduce((sum, value) => sum + value, 0) / gaps.length,
    },
    polygon: {
      transactions: transactionCount,
      transactions_per_sec: transactionCount / durationSec,
      transactions_per_block: transactionCount / blockNumbers.length,
    },
    polymarket: {
      settlement_transactions: uniqueSettlementTransactions.size,
      order_filled_logs: allLogs.length,
      settlement_transactions_per_sec: uniqueSettlementTransactions.size / durationSec,
      fills_per_sec: allLogs.length / durationSec,
      settlement_transactions_per_block: uniqueSettlementTransactions.size / blockNumbers.length,
      fills_per_block: allLogs.length / blockNumbers.length,
      by_version: byVersion,
      fills_by_contract: byAddress,
    },
  };
}

const tip = numeric(await rpc("eth_blockNumber", []));
const results = [];
for (const spec of windows) results.push(await measure(spec, tip));
console.log(JSON.stringify({ generated_at: new Date().toISOString(), results }, null, 2));
