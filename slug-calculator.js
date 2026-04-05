// Slug Calculator Widget — interactive slug builder for crypto short-form markets
// Mintlify auto-includes .js files on every page

(function () {
  const widget = document.getElementById('slug-calculator');
  if (!widget) return;

  const COINS = ['btc', 'eth', 'sol', 'bnb', 'xrp', 'doge', 'hype'];
  const COIN_LABELS = {
    btc: 'Bitcoin', eth: 'Ethereum', sol: 'Solana',
    bnb: 'BNB', xrp: 'XRP', doge: 'Dogecoin', hype: 'Hyperliquid'
  };
  const INTERVALS = [
    { id: '5m', label: '5 minutes', seconds: 300 },
    { id: '15m', label: '15 minutes', seconds: 900 },
    { id: '1h', label: '1 hour', seconds: 3600 },
  ];

  // Build UI
  widget.innerHTML = `
    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px;">
      <div style="flex:1; min-width:140px;">
        <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px; opacity:0.7;">Coin</label>
        <select id="slug-coin" style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid rgba(128,128,128,0.3); background:var(--tw-bg-opacity,inherit); font-size:14px; cursor:pointer;">
          ${COINS.map(c => `<option value="${c}">${COIN_LABELS[c]} (${c})</option>`).join('')}
        </select>
      </div>
      <div style="flex:1; min-width:140px;">
        <label style="display:block; font-size:13px; font-weight:600; margin-bottom:4px; opacity:0.7;">Interval</label>
        <select id="slug-interval" style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid rgba(128,128,128,0.3); background:var(--tw-bg-opacity,inherit); font-size:14px; cursor:pointer;">
          ${INTERVALS.map(i => `<option value="${i.id}">${i.label}</option>`).join('')}
        </select>
      </div>
    </div>
    <div style="position:relative;">
      <div id="slug-output" style="padding:14px 16px; border-radius:8px; font-family:var(--font-mono,monospace); font-size:14px; background:rgba(128,128,128,0.08); border:1px solid rgba(128,128,128,0.15); word-break:break-all; padding-right:80px;"></div>
      <button id="slug-copy" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); padding:6px 14px; border-radius:6px; border:1px solid rgba(128,128,128,0.3); background:transparent; font-size:12px; font-weight:600; cursor:pointer; opacity:0.7; transition:opacity 0.15s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">Copy</button>
    </div>
    <div id="slug-meta" style="margin-top:8px; font-size:12px; opacity:0.5;"></div>
  `;

  const coinEl = document.getElementById('slug-coin');
  const intervalEl = document.getElementById('slug-interval');
  const outputEl = document.getElementById('slug-output');
  const metaEl = document.getElementById('slug-meta');
  const copyBtn = document.getElementById('slug-copy');

  function compute() {
    const coin = coinEl.value;
    const intervalId = intervalEl.value;
    const interval = INTERVALS.find(i => i.id === intervalId);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / interval.seconds) * interval.seconds;
    const windowEnd = windowStart + interval.seconds;
    const remaining = windowEnd - now;

    let slug;
    if (intervalId === '1h') {
      const d = new Date(windowStart * 1000);
      const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
      const month = months[d.getUTCMonth()];
      const day = d.getUTCDate();
      const year = d.getUTCFullYear();
      let hour = d.getUTCHours();
      const ampm = hour >= 12 ? 'pm' : 'am';
      hour = hour % 12 || 12;
      const coinName = coin === 'btc' ? 'bitcoin' : coin === 'eth' ? 'ethereum' : coin === 'sol' ? 'solana' : coin === 'bnb' ? 'bnb' : coin === 'xrp' ? 'xrp' : coin === 'doge' ? 'dogecoin' : 'hyperliquid';
      slug = `${coinName}-up-or-down-${month}-${day}-${year}-${hour}${ampm}-et`;
      metaEl.textContent = `Hourly slug pattern varies. This is an approximation — actual slugs use ET timezone and may differ.`;
    } else {
      slug = `${coin}-updown-${intervalId}-${windowStart}`;
      metaEl.textContent = `Window: ${new Date(windowStart * 1000).toISOString().slice(11, 19)} — ${new Date(windowEnd * 1000).toISOString().slice(11, 19)} UTC | ${remaining}s remaining`;
    }

    outputEl.textContent = slug;
  }

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(outputEl.textContent).then(() => {
      copyBtn.textContent = 'Copied!';
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 1500);
    });
  });

  coinEl.addEventListener('change', compute);
  intervalEl.addEventListener('change', compute);
  compute();

  // Update every second for the countdown
  setInterval(compute, 1000);
})();
