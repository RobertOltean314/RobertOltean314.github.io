/* ============================================================
   Robert Oltean — portfolio runtime
   Live GitHub data, with a committed snapshot as fallback.
   ============================================================ */
(function () {
  'use strict';

  const CONFIG = {
    user: 'RobertOltean314',
    snapshot: 'assets/data/github-snapshot.json',
    cacheKey: 'ro-gh-cache-v1',
    cacheTTL: 60 * 60 * 1000,          // 1 hour
    hideFromGrid: ['RobertOltean314', 'first-test-repository', 'CV'],
    hideForks: true,
    // Vendored third-party code that would distort the language breakdown.
    excludeFromLangStats: ['first-test-repository'],
    excludeNote: 'Public repositories only — my day-to-day Ruby on Rails work lives in private company repositories and is not counted here. Also excludes first-test-repository, a vendored NXP MCUXpresso SDK (~11.8 MB of third-party C) that would otherwise dominate the chart.'
  };

  const LANG_COLORS = {
    Rust:'#dea584', Solidity:'#AA6746', TypeScript:'#3178c6', JavaScript:'#f1e05a',
    'C#':'#178600', Ruby:'#701516', Python:'#3572A5', Java:'#b07219', C:'#555555',
    'C++':'#f34b7d', HTML:'#e34c26', CSS:'#563d7c', SCSS:'#c6538c', Lua:'#000080',
    Shell:'#89e051', Dockerfile:'#384d54', PLpgSQL:'#336790', Makefile:'#427819',
    CMake:'#DA3434', Assembly:'#6E4C13', Perl:'#0298c3', Batchfile:'#C1F12E',
    'Linker Script':'#4a4a4a', Go:'#00ADD8', Vue:'#41b883', Svelte:'#ff3e00'
  };
  const langColor = (l) => LANG_COLORS[l] || '#6c737f';

  /* ───────── helpers ───────── */
  const $  = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const num = (n) => Number(n || 0).toLocaleString('en-US');

  function relTime(iso) {
    const then = new Date(iso).getTime();
    if (!then) return '';
    const days = Math.floor((Date.now() - then) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return days + 'd ago';
    const months = Math.floor(days / 30.44);
    if (months < 12) return months + 'mo ago';
    const years = (days / 365.25);
    return (years < 2 ? '1y ago' : Math.floor(years) + 'y ago');
  }

  /* ───────── data layer ───────── */

  function readCache() {
    try {
      const raw = localStorage.getItem(CONFIG.cacheKey);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (!c || Date.now() - c.at > CONFIG.cacheTTL) return null;
      return c.data;
    } catch (_) { return null; }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CONFIG.cacheKey, JSON.stringify({ at: Date.now(), data }));
    } catch (_) { /* private mode / quota — non-fatal */ }
  }

  async function fetchSnapshot() {
    const res = await fetch(CONFIG.snapshot, { cache: 'no-cache' });
    if (!res.ok) throw new Error('snapshot ' + res.status);
    return res.json();
  }

  async function fetchLive() {
    const base = 'https://api.github.com';
    const opts = { headers: { Accept: 'application/vnd.github+json' } };
    const [pRes, rRes] = await Promise.all([
      fetch(base + '/users/' + CONFIG.user, opts),
      fetch(base + '/users/' + CONFIG.user + '/repos?per_page=100&sort=updated', opts)
    ]);
    if (!pRes.ok || !rRes.ok) throw new Error('github api ' + pRes.status + '/' + rRes.status);
    return { profile: await pRes.json(), repos: await rRes.json() };
  }

  /**
   * Snapshot is always loaded (it carries the language byte counts, which would
   * cost ~30 extra API calls to compute live). Live data, when reachable,
   * overrides the profile + repo list so stars and dates stay current.
   */
  async function loadData() {
    let snapshot = null;
    try { snapshot = await fetchSnapshot(); } catch (_) { /* fall through */ }

    const cached = readCache();
    if (cached) {
      return { profile: cached.profile, repos: cached.repos, languages: (snapshot && snapshot.languages) || {}, source: 'cache', snapshot };
    }

    try {
      const live = await fetchLive();
      writeCache(live);
      return { profile: live.profile, repos: live.repos, languages: (snapshot && snapshot.languages) || {}, source: 'live', snapshot };
    } catch (_) {
      if (!snapshot) throw new Error('no data available');
      return { profile: snapshot.profile, repos: snapshot.repos, languages: snapshot.languages || {}, source: 'snapshot', snapshot };
    }
  }

  /* ───────── renderers ───────── */

  function renderHeroStats(profile, repos, source, snapshot) {
    const owned = repos.filter(r => !r.fork);
    const stars = owned.reduce((a, r) => a + (r.stargazers_count || 0), 0);
    const since = profile.created_at ? new Date(profile.created_at).getFullYear() : '—';

    const set = (k, v) => { const el = $('[data-stat="' + k + '"]'); if (el) el.textContent = v; };
    set('repos', num(profile.public_repos != null ? profile.public_repos : owned.length));
    set('stars', num(stars));
    set('followers', num(profile.followers));
    set('since', since);

    const note = $('#dataSource');
    if (note) {
      const label = source === 'live'     ? 'Live from the GitHub API'
                  : source === 'cache'    ? 'Live GitHub data (cached this hour)'
                  : 'Cached snapshot — GitHub API unreachable';
      note.textContent = label;
    }

    const foot = $('#footMeta');
    if (foot) {
      const gen = snapshot && snapshot.generated_at
        ? new Date(snapshot.generated_at).toISOString().slice(0, 10) : null;
      foot.textContent = 'Data: ' + (source === 'snapshot' ? 'snapshot' : 'GitHub API')
        + (gen ? ' · snapshot ' + gen : '');
    }
  }

  function renderFeaturedStats(repos) {
    const byName = new Map(repos.map(r => [r.name.toLowerCase(), r]));
    $$('[data-repo]').forEach(card => {
      const repo = byName.get(card.dataset.repo.toLowerCase());
      const slot = $('[data-repostats]', card);
      if (!slot) return;
      if (!repo) { slot.textContent = ''; return; }
      const bits = [];
      if (repo.stargazers_count) bits.push('★ ' + repo.stargazers_count);
      if (repo.language) bits.push(repo.language);
      if (repo.pushed_at) bits.push('updated ' + relTime(repo.pushed_at));
      slot.textContent = bits.join('  ·  ');
    });
  }

  function renderLanguages(languages) {
    const bar = $('#langBar'), list = $('#langList'), note = $('#langNote');
    if (!bar || !list) return;

    const totals = {};
    Object.keys(languages || {}).forEach(repo => {
      if (CONFIG.excludeFromLangStats.includes(repo)) return;
      const l = languages[repo] || {};
      Object.keys(l).forEach(k => { totals[k] = (totals[k] || 0) + l[k]; });
    });

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const sum = sorted.reduce((a, b) => a + b[1], 0);
    if (!sum) { bar.remove(); list.remove(); return; }

    // Top 8, rest folded into "Other".
    const top = sorted.slice(0, 8);
    const restBytes = sorted.slice(8).reduce((a, b) => a + b[1], 0);
    const rows = top.map(([name, bytes]) => ({ name, bytes, pct: bytes / sum * 100 }));
    if (restBytes > 0) rows.push({ name: 'Other', bytes: restBytes, pct: restBytes / sum * 100 });

    bar.innerHTML = rows.map(r =>
      '<span style="width:' + r.pct.toFixed(2) + '%;background:' + (r.name === 'Other' ? '#3a3f4b' : langColor(r.name)) + '" ' +
      'title="' + esc(r.name) + ' — ' + r.pct.toFixed(1) + '%"></span>'
    ).join('');

    list.innerHTML = rows.map(r =>
      '<li><i style="background:' + (r.name === 'Other' ? '#3a3f4b' : langColor(r.name)) + '"></i>' +
      '<b>' + esc(r.name) + '</b><span>' + r.pct.toFixed(1) + '%</span></li>'
    ).join('');

    if (note) note.textContent = CONFIG.excludeNote;
  }

  /* ───────── repository grid ───────── */

  const grid = {
    all: [],
    els: {},

    init(repos) {
      this.all = repos.filter(r => {
        if (CONFIG.hideForks && r.fork) return false;
        return !CONFIG.hideFromGrid.includes(r.name);
      });

      this.els = {
        grid:   $('#repoGrid'),
        count:  $('#repoCount'),
        empty:  $('#repoEmpty'),
        search: $('#repoSearch'),
        lang:   $('#repoLang'),
        sort:   $('#repoSort')
      };
      if (!this.els.grid) return;

      const langs = Array.from(new Set(this.all.map(r => r.language).filter(Boolean))).sort();
      this.els.lang.insertAdjacentHTML('beforeend',
        langs.map(l => '<option value="' + esc(l) + '">' + esc(l) + '</option>').join(''));

      let t;
      this.els.search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => this.render(), 120); });
      this.els.lang.addEventListener('change', () => this.render());
      this.els.sort.addEventListener('change', () => this.render());

      this.render();
    },

    render() {
      const q    = (this.els.search.value || '').trim().toLowerCase();
      const lang = this.els.lang.value;
      const sort = this.els.sort.value;

      let rows = this.all.filter(r => {
        if (lang && r.language !== lang) return false;
        if (!q) return true;
        const hay = (r.name + ' ' + (r.description || '') + ' ' + (r.language || '') + ' ' + (r.topics || []).join(' ')).toLowerCase();
        return hay.includes(q);
      });

      rows.sort((a, b) => {
        switch (sort) {
          case 'stars':   return (b.stargazers_count - a.stargazers_count) || a.name.localeCompare(b.name);
          case 'created': return new Date(b.created_at) - new Date(a.created_at);
          case 'name':    return a.name.localeCompare(b.name);
          default:        return new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at);
        }
      });

      this.els.count.textContent = rows.length + ' of ' + this.all.length + ' repositories';
      this.els.empty.hidden = rows.length > 0;
      this.els.grid.innerHTML = rows.map(r => this.card(r)).join('');
    },

    card(r) {
      const badges = [];
      if (r.archived) badges.push('<span class="tag tag--muted">archived</span>');
      if (r.homepage) badges.push('<span class="tag" style="color:var(--accent);border-color:var(--accent-line)">live</span>');

      const foot = [];
      if (r.language) {
        foot.push('<span class="repo__lang"><i style="background:' + langColor(r.language) + '"></i>' + esc(r.language) + '</span>');
      }
      if (r.stargazers_count) foot.push('<span class="repo__stat">★ ' + r.stargazers_count + '</span>');
      if (r.forks_count)      foot.push('<span class="repo__stat">⑂ ' + r.forks_count + '</span>');
      foot.push('<span class="repo__when">' + esc(relTime(r.pushed_at || r.updated_at)) + '</span>');

      const desc = r.description
        ? '<p class="repo__desc">' + esc(r.description) + '</p>'
        : '<p class="repo__desc repo__desc--none">No description.</p>';

      return '<a class="repo" href="' + esc(r.html_url) + '" target="_blank" rel="noopener">' +
               '<div class="repo__top"><span class="repo__name">' + esc(r.name) + '</span>' +
                 (badges.length ? '<span class="repo__badges">' + badges.join('') + '</span>' : '') +
               '</div>' + desc +
               '<div class="repo__foot">' + foot.join('') + '</div>' +
             '</a>';
    }
  };

  /* ───────── chrome: nav, scroll spy ───────── */

  function initNav() {
    const nav = $('#nav'), toggle = $('#navToggle'), links = $('.nav__links');

    const onScroll = () => nav.classList.toggle('is-stuck', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (toggle && links) {
      toggle.addEventListener('click', () => {
        const open = links.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
      links.addEventListener('click', (e) => {
        if (e.target.closest('a')) {
          links.classList.remove('is-open');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const sections = $$('main section[id]').filter(s => s.id !== 'top');
    const navLinks = new Map($$('.nav__links a[href^="#"]').map(a => [a.getAttribute('href').slice(1), a]));

    // Position-based rather than IntersectionObserver: a thin observer band
    // leaves gaps between sections where the highlight would stick to the
    // previous entry. Reading scroll position directly is unambiguous.
    let ticking = false;
    function spy() {
      const y = window.scrollY + 140;
      let active = null;
      for (const s of sections) { if (s.offsetTop <= y) active = s.id; }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) {
        active = sections[sections.length - 1].id;   // pin the last one at page end
      }
      navLinks.forEach(l => l.classList.remove('is-active'));
      const a = active && navLinks.get(active);
      if (a) a.classList.add('is-active');
    }
    function requestSpy() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { spy(); ticking = false; });
    }
    spy();
    window.addEventListener('scroll', requestSpy, { passive: true });
    window.addEventListener('resize', requestSpy);
  }

  /* ───────── boot ───────── */

  async function boot() {
    initNav();
    const y = $('#year'); if (y) y.textContent = new Date().getFullYear();

    try {
      const data = await loadData();
      renderHeroStats(data.profile, data.repos, data.source, data.snapshot);
      renderFeaturedStats(data.repos);
      renderLanguages(data.languages);
      grid.init(data.repos);
    } catch (err) {
      console.error('[portfolio] data load failed:', err);
      const note = $('#dataSource');
      if (note) note.textContent = 'GitHub data unavailable right now.';
      const count = $('#repoCount');
      if (count) count.textContent = 'Repository list unavailable — see github.com/' + CONFIG.user;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
