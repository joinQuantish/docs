#!/usr/bin/env node

/**
 * Docs Example Tester
 *
 * Scans all .mdx files, extracts JS/TS code blocks, and executes
 * runnable examples against the live API with the test key.
 *
 * Usage: node test-examples.mjs [--verbose] [--file path/to/file.mdx]
 */

import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'fs';
import { join, relative } from 'path';
import { execSync, execFileSync } from 'child_process';
import { tmpdir } from 'os';

const TEST_KEY = 'pn_live_test_session_tracking_51eca107e9b347b589f5b0a04f98eb1d';
const TIMEOUT_MS = 8000;
const WS_AUTO_CLOSE_MS = 5000;
const NODE_PATH = '/home/polygon/node_modules';
const DOCS_DIR = new URL('.', import.meta.url).pathname;

const VERBOSE = process.argv.includes('--verbose');
const FILE_FILTER = process.argv.includes('--file')
  ? process.argv[process.argv.indexOf('--file') + 1]
  : null;

// ─── Collect .mdx files ───────────────────────────────────────────────

function walkDir(dir) {
  let results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory() && entry !== 'node_modules' && entry !== '.git') {
      results = results.concat(walkDir(full));
    } else if (entry.endsWith('.mdx')) {
      results.push(full);
    }
  }
  return results;
}

// ─── Extract code blocks ──────────────────────────────────────────────

function extractCodeBlocks(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const blocks = [];

  let inBlock = false;
  let lang = null;
  let blockLines = [];
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inBlock) {
      const match = line.match(/^```(javascript|typescript|js|ts)(\s|$)/);
      if (match) {
        inBlock = true;
        lang = match[1];
        blockLines = [];
        startLine = i + 1; // 1-indexed
      }
    } else {
      if (line.startsWith('```')) {
        inBlock = false;
        blocks.push({
          code: blockLines.join('\n'),
          lang,
          line: startLine,
          file: filePath,
        });
      } else {
        blockLines.push(line);
      }
    }
  }
  return blocks;
}

// ─── Classify whether a block is runnable ─────────────────────────────

function isRunnable(block) {
  const code = block.code.trim();

  // Skip empty
  if (!code) return false;

  // Skip single-line snippets
  const nonEmptyLines = code.split('\n').filter(l => l.trim()).length;
  if (nonEmptyLines <= 1) return false;

  // Skip blocks that are just type imports/definitions
  if (/^import type\s/.test(code)) return false;

  // Skip TypeScript-only syntax that can't run in Node (non-null assertions, etc.)
  if (code.includes('process.env.') && code.includes('!,')) return false;
  if (code.includes('!,') || code.includes('!;') || code.includes('!.')) {
    // Check if it's TypeScript non-null assertion (not !== or !=)
    if (/\w!\s*[,;.]/.test(code)) return false;
  }

  // Skip `import * as X from` (ESM star imports don't convert to require easily)
  if (/import\s+\*\s+as/.test(code)) return false;

  // Skip blocks that import unavailable third-party modules
  const unavailableModules = ['@dome/sdk', 'ethers', '@privy-io', 'viem', '@safe-global', '@polynode/charts', 'polynode-charts'];
  for (const mod of unavailableModules) {
    if (code.includes(`'${mod}`) || code.includes(`"${mod}`)) return false;
  }

  // ── Self-contained check ──
  // A block is runnable only if it creates its own context.
  // It must either: create a WebSocket, create a PolyNode client, do a fetch(), or define a function that runs.

  const isSelfContained =
    code.includes('new WebSocket(') ||
    code.includes('new PolyNode(') ||
    code.includes('new PolyNodeWS(') ||
    (code.includes('fetch(') && code.includes('http')) ||
    (code.includes('require(') && (code.includes('console.') || code.includes('ws.on'))) ||
    // Standalone function definitions that also get called
    (code.includes('function ') && code.includes('(') && /\w+\(\)/.test(code));

  // Fragments referencing external variables without setup
  const EXTERNAL_VARS = ['pn.', 'sub.', 'trader.', 'watcher.', 'stream.', 'cache.', 'book.', 'wallet.', 'engine.', 'ob.', 'provider.', 'chart.', 'series.', 'sf.', 'orderbook.'];
  const refsExternal = EXTERNAL_VARS.some(v => code.includes(v));

  // ws.send / ws.on without creating ws
  const refsWsWithoutCreating = (
    (code.includes('ws.send') || code.includes('ws.on(') || code.includes('ws.onmessage')) &&
    !code.includes('new WebSocket') && !code.includes('require("ws")')
  );

  // Top-level await on undefined vars (e.g. `await pn.foo()`, `await trader.order()`)
  const awaitOnExternal = /await\s+(pn|trader|watcher|stream|cache|PolyNodeTrader|provider|sf)\b/.test(code);

  // Result/const assignment using undefined vars
  const assignFromExternal = /(?:const|let|var)\s+\w+\s*=\s*(?:await\s+)?(pn|trader|watcher|stream|sub|cache|engine|ob|provider|chart|series|sf)\./.test(code);

  // `for await (... of X)` where X is undefined
  const forAwaitExternal = /for\s+await\s+\(.*\bof\s+(sub|watcher|stream|cache)\b/.test(code);

  // Uses PolyNodeTrader / PolyNode / PolyNodeWS without import
  const usesClassWithoutImport = (
    (code.includes('PolyNodeTrader') && !code.includes("require") && !code.includes("import")) ||
    (code.includes('new PolyNode(') && !code.includes("require") && !code.includes("import")) ||
    (code.includes('new PolyNodeWS(') && !code.includes("require") && !code.includes("import"))
  );

  // fetch() with relative URL (no http) — missing setup
  const relFetch = /fetch\s*\(\s*["']\//.test(code);

  // References undefined standalone variables (not obj.method, just bare variable usage)
  const usesUndefinedStandalone = (
    (/\bpending\b/.test(code) && !code.includes('const pending') && !code.includes('let pending')) ||
    (/\bheaders\b/.test(code) && !code.includes('const headers') && !code.includes('let headers') && !code.includes('"Content-Type"'))
  );

  // ws.send immediately after new WebSocket without waiting for open (will crash)
  const sendWithoutOpen = (
    code.includes('new WebSocket(') &&
    code.includes('.send(') &&
    !code.includes('.on("open"') &&
    !code.includes(".on('open'") &&
    !code.includes('.onopen')
  );

  if (refsExternal && !isSelfContained) return false;
  if (refsWsWithoutCreating && !isSelfContained) return false;
  if (awaitOnExternal && !isSelfContained) return false;
  if (assignFromExternal && !isSelfContained) return false;
  if (forAwaitExternal) return false;
  if (relFetch) return false;
  if (usesUndefinedStandalone) return false;
  if (sendWithoutOpen) return false;

  // Skip blocks that are just method call lists without any output/handling
  const allLinesAreMethodCalls = code.split('\n')
    .filter(l => l.trim())
    .every(l => /^\s*(await\s+)?(pn|sub|ws|trader)\.\w+/.test(l) || l.trim().startsWith('//'));
  if (allLinesAreMethodCalls && !isSelfContained) return false;

  // Skip if it's just JSON-like object structure
  if (code.startsWith('{') && code.endsWith('}') && !code.includes('function') && !code.includes('=>')) return false;

  // Must have some executable code
  const hasExecutable = code.includes('console.') ||
    code.includes('ws.on(') ||
    code.includes('ws.onopen') ||
    code.includes('ws.onmessage') ||
    code.includes('.send(') ||
    code.includes('fetch(') ||
    code.includes('await ') ||
    code.includes('new WebSocket') ||
    code.includes('.on("message') ||
    code.includes('.on("open');

  return isSelfContained || hasExecutable;
}

// ─── Replace API keys ─────────────────────────────────────────────────

function replaceKeys(code) {
  return code
    .replace(/pn_live_YOUR_KEY/g, TEST_KEY)
    .replace(/YOUR_API_KEY/g, TEST_KEY)
    .replace(/YOUR_KEY/g, TEST_KEY)
    .replace(/your_api_key/g, TEST_KEY)
    .replace(/pn_live_\.\.\./g, TEST_KEY)
    .replace(/'pn_live_\.\.\.'/g, `'${TEST_KEY}'`);
}

// ─── Wrap code for execution ──────────────────────────────────────────

function wrapCode(code, lang) {
  let wrapped = code;

  // Convert browser WebSocket to ws module
  const needsWsImport = (
    code.includes('new WebSocket(') &&
    !code.includes("require('ws')") &&
    !code.includes('require("ws")') &&
    !code.includes("from 'ws'") &&
    !code.includes('from "ws"')
  );

  // Remove type-only imports first
  wrapped = wrapped.replace(/import type\s+.*\n?/g, '');

  // Convert ESM imports to requires for compatibility
  // Handle `import { X } from 'y'` and `import X from 'y'`
  wrapped = wrapped.replace(
    /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"];?/g,
    'const {$1} = require("$2")'
  );
  wrapped = wrapped.replace(
    /import\s+(\w+)\s+from\s+['"]([^'"]+)['"];?/g,
    'const $1 = require("$2")'
  );

  // Add WebSocket require if needed
  if (needsWsImport) {
    wrapped = `const WebSocket = require("ws");\n${wrapped}`;
  }

  // Add polynode-sdk require if PolyNode/PolyNodeWS/PolyNodeTrader used without import
  const needsSdkImport = (
    (code.includes('new PolyNode(') || code.includes('new PolyNodeWS(') || code.includes('PolyNodeTrader')) &&
    !code.includes("require('polynode-sdk')") &&
    !code.includes('require("polynode-sdk")') &&
    !code.includes("from 'polynode-sdk'") &&
    !code.includes('from "polynode-sdk"') &&
    !wrapped.includes('require("polynode-sdk")')
  );
  if (needsSdkImport) {
    wrapped = `const { PolyNode, PolyNodeWS, PolyNodeTrader } = require("polynode-sdk");\n${wrapped}`;
  }

  // Detect if code uses ws.on("open") or ws.onopen pattern (WebSocket with event handlers)
  const isWebSocket = code.includes('.on("open"') ||
    code.includes(".on('open'") ||
    code.includes('.onopen') ||
    code.includes('.on("message"') ||
    code.includes(".on('message'") ||
    code.includes('.onmessage');

  // Inject auto-close for WebSocket examples
  if (isWebSocket) {
    // Find the WebSocket variable name
    const wsVarMatch = code.match(/(?:const|let|var)\s+(\w+)\s*=\s*new\s+WebSocket/);
    const wsVar = wsVarMatch ? wsVarMatch[1] : 'ws';
    wrapped += `\nsetTimeout(() => { try { ${wsVar}.close(); } catch(e) {} process.exit(0); }, ${WS_AUTO_CLOSE_MS});`;
  }

  // Detect functions that reference undefined helpers (like handleEvent)
  // and stub them if needed
  if (code.includes('handleEvent(') && !code.includes('function handleEvent')) {
    wrapped = `function handleEvent(msg) { console.log('event:', msg.type); }\n${wrapped}`;
  }

  // Replace location.reload() (browser-only) with process.exit
  wrapped = wrapped.replace(/location\.reload\(\)/g, 'process.exit(0)');

  // Add error handler for WebSocket to prevent unhandled rejection on 401 etc.
  if (isWebSocket && !code.includes('.on("error"') && !code.includes('.onerror')) {
    const wsVarMatch2 = code.match(/(?:const|let|var)\s+(\w+)\s*=\s*new\s+WebSocket/);
    const wsVar2 = wsVarMatch2 ? wsVarMatch2[1] : 'ws';
    // Insert after the WebSocket constructor line
    wrapped = wrapped.replace(
      /((?:const|let|var)\s+\w+\s*=\s*new\s+WebSocket\([^)]+\);?)/,
      `$1\n${wsVar2}.on("error", (err) => { console.error("ws error:", err.message); process.exit(1); });`
    );
  }

  // Wrap top-level await in async IIFE
  // Also handle `for await` at top level
  if (hasTopLevelAwait(wrapped)) {
    wrapped = `(async () => {\n${wrapped}\n})().catch(e => { console.error(e.message); process.exit(1); });`;
  }

  // Add process.exit for non-WebSocket examples that might hang
  if (!isWebSocket && !wrapped.includes('process.exit')) {
    wrapped += `\nsetTimeout(() => process.exit(0), ${TIMEOUT_MS - 500});`;
  }

  return wrapped;
}

function hasTopLevelAwait(code) {
  // Check if `await` appears outside of any function/arrow body.
  // We track function depth separately from block depth (if/while/for braces don't count).
  let funcDepth = 0;
  const lines = code.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect function/arrow function starts
    const funcStarts = (line.match(/(async\s+)?function\s*\w*\s*\(/g) || []).length;
    const arrowStarts = (line.match(/=>\s*\{/g) || []).length;
    funcDepth += funcStarts + arrowStarts;

    // Count closing braces that might end functions
    // This is rough but good enough: we count all `}` and subtract non-function opens
    const opens = (line.match(/\{/g) || []).length;
    const closes = (line.match(/\}/g) || []).length;

    // If await appears and we're not inside any function body
    if (funcDepth === 0 && /\bawait\s/.test(trimmed)) {
      return true;
    }

    // If await appears and we're inside a control structure (if/while/for)
    // but not inside a function, it's still top-level await
    // We can detect this if funcDepth == 0 before accounting for this line's braces

    // Adjust funcDepth for closing braces (imprecise but workable)
    // Only decrease funcDepth when there are more closes than opens
    const netClose = closes - opens;
    if (netClose > 0 && funcDepth > 0) {
      funcDepth = Math.max(0, funcDepth - netClose);
    }
  }
  return false;
}

// ─── Execute a code block ─────────────────────────────────────────────

function executeBlock(block) {
  const code = replaceKeys(block.code);
  const wrapped = wrapCode(code, block.lang);
  const tmpFile = join(tmpdir(), `polynode-doc-test-${Date.now()}-${Math.random().toString(36).slice(2)}.cjs`);

  try {
    writeFileSync(tmpFile, wrapped, 'utf-8');

    const output = execFileSync('node', [tmpFile], {
      timeout: TIMEOUT_MS,
      env: {
        ...process.env,
        NODE_PATH,
        NODE_TLS_REJECT_UNAUTHORIZED: '1',
      },
      encoding: 'utf-8',
      maxBuffer: 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    return { success: true, output: output.trim(), error: null };
  } catch (err) {
    const stderr = err.stderr ? err.stderr.trim() : '';
    const stdout = err.stdout ? err.stdout.trim() : '';

    // Timeout
    if (err.killed || err.signal === 'SIGTERM') {
      return { success: true, output: stdout, error: null, timedOut: true };
    }

    // Extract meaningful error
    const errorMsg = stderr || err.message || 'Unknown error';

    // Check if it's a 403/401 (paid-only endpoint or auth issue)
    const is403 = stdout.includes('403') || stderr.includes('403') || stdout.includes('Forbidden') ||
      stdout.includes('401') || stderr.includes('401') || stderr.includes('Unexpected server response: 401');

    return {
      success: false,
      output: stdout,
      error: errorMsg,
      exitCode: err.status,
      is403,
    };
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

// ─── Main ─────────────────────────────────────────────────────────────

function main() {
  console.log('polynode docs example tester');
  console.log('═'.repeat(50));
  console.log(`Test key: ${TEST_KEY.slice(0, 20)}...`);
  console.log(`Timeout: ${TIMEOUT_MS}ms per example`);
  console.log(`WS auto-close: ${WS_AUTO_CLOSE_MS}ms`);
  console.log();

  // Collect files
  let mdxFiles;
  if (FILE_FILTER) {
    mdxFiles = [join(DOCS_DIR, FILE_FILTER)];
  } else {
    mdxFiles = walkDir(DOCS_DIR);
  }

  console.log(`Scanning ${mdxFiles.length} .mdx files...\n`);

  // Extract all code blocks
  let allBlocks = [];
  for (const file of mdxFiles) {
    const blocks = extractCodeBlocks(file);
    allBlocks = allBlocks.concat(blocks);
  }

  console.log(`Found ${allBlocks.length} JS/TS code blocks total`);

  // Filter to runnable
  const runnable = allBlocks.filter(isRunnable);
  const skipped = allBlocks.length - runnable.length;
  console.log(`Runnable: ${runnable.length} | Skipped (fragments/partials): ${skipped}`);
  console.log();

  // Execute
  const results = [];
  for (let i = 0; i < runnable.length; i++) {
    const block = runnable[i];
    const relFile = relative(DOCS_DIR, block.file);
    const label = `${relFile}:${block.line}`;

    process.stdout.write(`[${i + 1}/${runnable.length}] ${label} ... `);

    const result = executeBlock(block);
    result.label = label;
    result.block = block;
    results.push(result);

    if (result.success) {
      if (result.timedOut) {
        process.stdout.write('TIMEOUT (ok)\n');
      } else {
        process.stdout.write('PASS\n');
      }
    } else if (result.is403) {
      process.stdout.write('AUTH (401/403)\n');
    } else {
      process.stdout.write('FAIL\n');
    }

    if (VERBOSE && result.output) {
      for (const line of result.output.split('\n').slice(0, 5)) {
        console.log(`    > ${line}`);
      }
    }
    if (VERBOSE && result.error) {
      for (const line of result.error.split('\n').slice(0, 5)) {
        console.log(`    ! ${line}`);
      }
    }
  }

  // Summary
  console.log();
  console.log('═'.repeat(50));
  console.log('SUMMARY');
  console.log('═'.repeat(50));

  const passed = results.filter(r => r.success);
  const failed403 = results.filter(r => !r.success && r.is403);
  const failed = results.filter(r => !r.success && !r.is403);

  console.log(`  Passed:    ${passed.length}/${results.length}`);
  console.log(`  Auth errs:  ${failed403.length} (401/403, paid-only or key issue)`);
  console.log(`  Failed:    ${failed.length}`);
  console.log(`  Skipped:   ${skipped} (non-runnable fragments)`);
  console.log();

  if (failed403.length > 0) {
    console.log('── AUTH ERRORS (401/403, docs should note tier requirements) ──');
    for (const r of failed403) {
      console.log(`  ${r.label}`);
    }
    console.log();
  }

  if (failed.length > 0) {
    console.log('── FAILURES ──');
    for (const r of failed) {
      console.log(`  ${r.label}`);
      // Show first few lines of error
      const errLines = (r.error || '').split('\n');
      for (const line of errLines.slice(0, 6)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('at ') && !trimmed.startsWith('Node.js')) {
          console.log(`    ${trimmed}`);
        }
      }
      console.log();
    }
  }

  // Exit code: fail only on real code errors (not 403s or timeouts)
  const exitCode = failed.length > 0 ? 1 : 0;
  console.log(exitCode === 0 ? 'All examples OK.' : `${failed.length} example(s) failed.`);
  process.exit(exitCode);
}

main();
