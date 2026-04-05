// Slug Calculator — interactive widget for crypto short-form market slugs
// Activates on any page containing a div#slug-calc

function initSlugCalc() {
  var el = document.getElementById('slug-calc');
  if (!el || el.dataset.init) return;
  el.dataset.init = '1';

  var coins = ['btc','eth','sol','bnb','xrp','doge','hype'];
  var labels = {btc:'Bitcoin',eth:'Ethereum',sol:'Solana',bnb:'BNB',xrp:'XRP',doge:'Dogecoin',hype:'Hyperliquid'};
  var intervals = [{id:'5m',s:300,label:'5 min'},{id:'15m',s:900,label:'15 min'},{id:'1h',s:3600,label:'1 hour'}];

  el.innerHTML = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">'
    + '<div style="flex:1;min-width:120px"><div style="font-size:12px;font-weight:600;margin-bottom:4px;opacity:.6">COIN</div>'
    + '<div id="sc-coins" style="display:flex;flex-wrap:wrap;gap:4px"></div></div>'
    + '<div style="flex:1;min-width:120px"><div style="font-size:12px;font-weight:600;margin-bottom:4px;opacity:.6">INTERVAL</div>'
    + '<div id="sc-ints" style="display:flex;gap:4px"></div></div></div>'
    + '<div id="sc-out" style="margin-top:8px"></div>';

  var selCoin = 'btc', selInt = '5m';

  function btnStyle(active) {
    return 'padding:6px 14px;border-radius:6px;border:1px solid ' + (active ? '#3b82f6' : 'rgba(128,128,128,.25)')
      + ';background:' + (active ? '#3b82f6' : 'transparent')
      + ';color:' + (active ? '#fff' : 'inherit')
      + ';font-size:13px;font-weight:600;cursor:pointer;transition:all .15s';
  }

  function render() {
    var cc = document.getElementById('sc-coins');
    var ci = document.getElementById('sc-ints');
    cc.innerHTML = '';
    ci.innerHTML = '';

    coins.forEach(function(c) {
      var b = document.createElement('button');
      b.textContent = c.toUpperCase();
      b.style.cssText = btnStyle(c === selCoin);
      b.onclick = function() { selCoin = c; render(); };
      cc.appendChild(b);
    });

    intervals.forEach(function(iv) {
      var b = document.createElement('button');
      b.textContent = iv.label;
      b.style.cssText = btnStyle(iv.id === selInt);
      b.onclick = function() { selInt = iv.id; render(); };
      ci.appendChild(b);
    });

    var iv = intervals.filter(function(x){return x.id===selInt})[0];
    var now = Math.floor(Date.now()/1000);
    var ws = Math.floor(now/iv.s)*iv.s;
    var we = ws + iv.s;
    var rem = we - now;
    var slug = selCoin + '-updown-' + selInt + '-' + ws;

    var out = document.getElementById('sc-out');
    out.innerHTML = '<div style="padding:14px 16px;border-radius:8px;background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.2)">'
      + '<div style="font-size:12px;font-weight:600;opacity:.5;margin-bottom:6px">CURRENT SLUG</div>'
      + '<div style="display:flex;align-items:center;gap:8px">'
      + '<code style="font-size:15px;font-weight:600;flex:1;word-break:break-all">' + slug + '</code>'
      + '<button id="sc-copy" style="' + btnStyle(false) + ';font-size:11px;padding:4px 12px;white-space:nowrap">Copy</button></div>'
      + '<div style="margin-top:8px;font-size:12px;opacity:.5">'
      + labels[selCoin] + ' ' + iv.label + ' window | '
      + '<span id="sc-rem">' + rem + '</span>s remaining'
      + '</div></div>';

    document.getElementById('sc-copy').onclick = function() {
      navigator.clipboard.writeText(slug);
      this.textContent = 'Copied!';
      var self = this;
      setTimeout(function(){ self.textContent = 'Copy'; }, 1200);
    };
  }

  render();
  setInterval(function() {
    var iv = intervals.filter(function(x){return x.id===selInt})[0];
    var now = Math.floor(Date.now()/1000);
    var we = Math.floor(now/iv.s)*iv.s + iv.s;
    var rem = we - now;
    var r = document.getElementById('sc-rem');
    if (r) r.textContent = rem;
    if (rem <= 0) render();
  }, 1000);
}

// Run on load and on SPA navigation
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSlugCalc);
} else {
  initSlugCalc();
}

// MutationObserver for SPA page transitions
new MutationObserver(function() {
  setTimeout(initSlugCalc, 100);
}).observe(document.body, { childList: true, subtree: true });
