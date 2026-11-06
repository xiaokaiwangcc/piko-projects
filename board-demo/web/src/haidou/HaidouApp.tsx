import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  augmentIcon,
  championIcon,
  gameCount,
  itemIcon,
  loadHaidouData,
  pct,
  ROLE_LABELS,
  TIER_LABELS,
} from './data';
import type { Champion, HaidouData } from './types';
import { matchChampion, searchChampions } from './search';
import './haidou.css';

type LoadState = 'loading' | 'ready' | 'error';
type Route = { name: 'home' } | { name: 'rank' } | { name: 'champion'; id: number };
type AugmentSort = 'win' | 'pick';

function readRoute(): Route {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === 'rank') return { name: 'rank' };
  const match = hash.match(/^c\/(\d+)$/);
  if (match) return { name: 'champion', id: Number(match[1]) };
  return { name: 'home' };
}

function go(hash: string) {
  window.location.hash = hash;
}

function roleText(roles: string[]): string {
  return roles.map((role) => ROLE_LABELS[role] || role).join(' / ');
}

function Icon({
  src,
  alt,
  className,
  fallback,
}: {
  src: string;
  alt: string;
  className: string;
  fallback: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return (
      <span className={`${className} hd-icon-fallback`} aria-hidden="true">
        {fallback.slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function Header({ route, meta }: { route: Route; meta: HaidouData['meta'] }) {
  const active = route.name === 'rank' ? 'rank' : 'home';
  return (
    <header className="hd-header">
      <a className="hd-brand" href="#/" aria-label="海斗助手首页">
        <span className="hd-mark">海</span>
        <span className="hd-brand-text">
          <strong>海斗助手</strong>
          <small>HEXTECH ARAM</small>
        </span>
      </a>
      <nav className="hd-nav" aria-label="主导航">
        <a className={active === 'home' ? 'is-active' : ''} href="#/">
          英雄
        </a>
        <a className={active === 'rank' ? 'is-active' : ''} href="#/rank">
          胜率榜
        </a>
      </nav>
      <div className="hd-header-side">
        <span className="hd-patch">
          v{meta.gamePatch} · {meta.dataDate}
        </span>
        <a className="hd-back-board" href="./">
          留言板
        </a>
      </div>
    </header>
  );
}

function SearchBox({
  champions,
  onSelect,
  placeholder = '搜英雄名 / 外号 / 拼音，如“亚索”“压缩”“yasuo”',
}: {
  champions: Champion[];
  onSelect: (champion: Champion) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchChampions(champions, query, 8), [champions, query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  function choose(champion: Champion) {
    onSelect(champion);
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="hd-search" ref={wrapRef}>
      <span className="hd-search-icon" aria-hidden="true">
        ⌕
      </span>
      <input
        ref={inputRef}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
            return;
          }
          if (!results.length) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActive((index) => (index + 1) % results.length);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => (index - 1 + results.length) % results.length);
          } else if (event.key === 'Enter') {
            event.preventDefault();
            choose((results[active] ?? results[0]).champion);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls="hd-search-results"
        aria-autocomplete="list"
        aria-label="搜索英雄"
      />
      {open && results.length > 0 && (
        <ul className="hd-search-results" id="hd-search-results" role="listbox">
          {results.map(({ champion, label }, index) => (
            <li key={champion.id} role="option" aria-selected={index === active}>
              <button
                type="button"
                className={index === active ? 'is-active' : ''}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(champion)}
              >
                <Icon
                  className="hd-search-avatar"
                  src={championIcon(champion.id)}
                  alt=""
                  fallback={champion.name}
                />
                <span className="hd-search-name">
                  <strong>{champion.name}</strong>
                  <small>
                    {champion.title} · {roleText(champion.roles)}
                    {label && <em className="hd-search-alias">{label}</em>}
                  </small>
                </span>
                <span className="hd-search-rate">{pct(champion.winRate)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && results.length === 0 && (
        <p className="hd-search-empty">
          没有找到“{query.trim()}”，试试官方名、外号或拼音。
        </p>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: number }) {
  return (
    <span className={`hd-tier hd-tier--${tier}`}>
      T{tier} · {TIER_LABELS[tier] || '未知'}
    </span>
  );
}

function ChampionCard({ champion, rank }: { champion: Champion; rank?: number }) {
  return (
    <button type="button" className="hd-champ-card" onClick={() => go(`/c/${champion.id}`)}>
      {rank !== undefined && <span className="hd-champ-rank">{String(rank).padStart(2, '0')}</span>}
      <span className="hd-champ-avatar-wrap">
        <Icon
          className="hd-champ-avatar"
          src={championIcon(champion.id)}
          alt={champion.name}
          fallback={champion.name}
        />
        <span className={`hd-champ-tier hd-champ-tier--${champion.tier}`}>T{champion.tier}</span>
      </span>
      <span className="hd-champ-info">
        <span className="hd-champ-name">{champion.name}</span>
        <span className="hd-champ-title">{champion.title}</span>
      </span>
      <span className="hd-champ-stats">
        <strong>{pct(champion.winRate)}</strong>
        <small>登场 {pct(champion.pickRate)}</small>
      </span>
      <span className="hd-champ-arrow" aria-hidden="true">→</span>
    </button>
  );
}

function FeaturedChampion({
  champion,
  data,
  onSelect,
}: {
  champion: Champion;
  data: HaidouData;
  onSelect: (champion: Champion) => void;
}) {
  const bestAugment = useMemo(() => {
    const pool = champion.augments.filter((item) => item.games >= 300);
    const list = pool.length > 0 ? pool : champion.augments;
    return [...list].sort((a, b) => b.winRate - a.winRate)[0];
  }, [champion.augments]);
  const augmentInfo = bestAugment ? data.augments[String(bestAugment.id)] : undefined;
  const combo = champion.combos[0];

  return (
    <button type="button" className="hd-featured" onClick={() => onSelect(champion)}>
      <span className="hd-featured-art" aria-hidden="true">
        <img src={championIcon(champion.id)} alt="" />
      </span>
      <span className="hd-featured-top">
        <span className="hd-featured-label">本期胜率头名</span>
        <TierBadge tier={champion.tier} />
      </span>
      <span className="hd-featured-main">
        <Icon
          className="hd-featured-avatar"
          src={championIcon(champion.id)}
          alt={champion.name}
          fallback={champion.name}
        />
        <span className="hd-featured-id">
          <span className="hd-featured-title">{champion.title}</span>
          <strong>{champion.name}</strong>
          <span className="hd-featured-role">{roleText(champion.roles)}</span>
        </span>
      </span>
      <span className="hd-featured-stats">
        <span>
          <small>胜率</small>
          <strong>{pct(champion.winRate)}</strong>
        </span>
        <span>
          <small>登场率</small>
          <strong>{pct(champion.pickRate)}</strong>
        </span>
        <span>
          <small>最佳双强化</small>
          <strong>{combo ? pct(combo.winRate) : '—'}</strong>
        </span>
      </span>
      <span className="hd-featured-aug">
        {bestAugment && (
          <Icon
            className="hd-featured-aug-icon"
            src={augmentIcon(bestAugment.id)}
            alt=""
            fallback={augmentInfo?.name || '?'}
          />
        )}
        <span>
          <small>最强强化</small>
          <b>{augmentInfo?.name || '暂无数据'}</b>
        </span>
        {bestAugment && <em>{pct(bestAugment.winRate)}</em>}
      </span>
      <span className="hd-featured-cta">查看出装与强化 <i>→</i></span>
    </button>
  );
}

function HomeView({
  data,
  onSelect,
  onRank,
}: {
  data: HaidouData;
  onSelect: (champion: Champion) => void;
  onRank: () => void;
}) {
  const top = useMemo(
    () => [...data.champions].sort((a, b) => b.winRate - a.winRate).slice(0, 8),
    [data.champions],
  );
  const featured = top[0];
  const popular = useMemo(
    () => [...data.champions].sort((a, b) => b.pickRate - a.pickRate).slice(0, 6),
    [data.champions],
  );

  return (
    <>
      <section className="hd-hero">
        <div className="hd-hero-copy">
          <p className="hd-kicker">HEXTECH ARAM · 数据驱动</p>
          <h1>
            这局海斗，<em>玩什么</em>？
          </h1>
          <p className="hd-lede">
            输入英雄名，查看当前版本的高胜率装备与海克斯强化。全部数据来自真实对局统计，不凭感觉推荐。
          </p>
          <SearchBox champions={data.champions} onSelect={onSelect} />
          <div className="hd-quick">
            <span>人气</span>
            {popular.map((champion) => (
              <button type="button" key={champion.id} onClick={() => onSelect(champion)}>
                {champion.name}
              </button>
            ))}
          </div>
        </div>
        {featured && <FeaturedChampion champion={featured} data={data} onSelect={onSelect} />}
      </section>

      <div className="hd-statbar">
        <div>
          <span>英雄样本</span>
          <strong>{data.champions.length}</strong>
          <small>位</small>
        </div>
        <div>
          <span>游戏版本</span>
          <strong>{data.meta.gamePatch}</strong>
        </div>
        <div>
          <span>统计日期</span>
          <strong>{data.meta.dataDate}</strong>
        </div>
        <div>
          <span>数据口径</span>
          <strong className="is-text">真实对局</strong>
        </div>
      </div>

      <section className="hd-section">
        <div className="hd-section-head">
          <div>
            <h2>版本强势</h2>
            <p>胜率最高的 8 位英雄 · 同时标注登场率</p>
          </div>
          <button type="button" className="hd-text-button" onClick={onRank}>
            完整胜率榜 →
          </button>
        </div>
        <div className="hd-champ-grid">
          {top.map((champion, index) => (
            <ChampionCard champion={champion} rank={index + 1} key={champion.id} />
          ))}
        </div>
      </section>

      <SourceBlock meta={data.meta} />
    </>
  );
}

function RankView({
  champions,
  dataDate,
  onSelect,
}: {
  champions: Champion[];
  dataDate: string;
  onSelect: (champion: Champion) => void;
}) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');

  const roles = ['all', 'mage', 'fighter', 'tank', 'assassin', 'support', 'marksman'];

  const rows = useMemo(() => {
    return [...champions]
      .sort((a, b) => b.winRate - a.winRate)
      .filter((c) => role === 'all' || c.roles.includes(role))
      .map((champion) => ({ champion, hit: matchChampion(champion, query) }))
      .filter((row) => !query.trim() || row.hit !== null);
  }, [champions, query, role]);

  return (
    <section className="hd-section hd-rank-section">
      <div className="hd-section-head">
        <div>
          <h2>海斗胜率榜</h2>
          <p>
            共 {champions.length} 位英雄 · 按胜率降序 · 更新于 {dataDate}
          </p>
        </div>
      </div>

      <div className="hd-toolbar">
        <div className="hd-filter-input">
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="筛选英雄 / 外号 / 拼音"
            aria-label="筛选英雄，支持外号和拼音"
          />
        </div>
        <div className="hd-role-chips" role="group" aria-label="按定位筛选">
          {roles.map((item) => (
            <button
              type="button"
              key={item}
              className={role === item ? 'is-active' : ''}
              onClick={() => setRole(item)}
            >
              {item === 'all' ? '全部' : ROLE_LABELS[item]}
            </button>
          ))}
        </div>
      </div>

      <ol className="hd-rank-list">
        {rows.map(({ champion, hit }, index) => (
          <li key={champion.id}>
            <button type="button" className="hd-rank-row" onClick={() => onSelect(champion)}>
              <span className={`hd-rank-no ${index < 3 ? 'is-top' : ''}`}>{index + 1}</span>
              <Icon
                className="hd-rank-avatar"
                src={championIcon(champion.id)}
                alt=""
                fallback={champion.name}
              />
              <span className="hd-rank-name">
                <strong>{champion.name}</strong>
                <small>
                  {roleText(champion.roles)}
                  {hit?.label && <em className="hd-search-alias">{hit.label}</em>}
                </small>
              </span>
              <TierBadge tier={champion.tier} />
              <span className="hd-rank-bar" aria-hidden="true">
                <i style={{ width: `${Math.max(4, Math.min(100, ((champion.winRate - 0.4) / 0.2) * 100))}%` }} />
              </span>
              <span className="hd-rank-win">{pct(champion.winRate)}</span>
              <span className="hd-rank-pick">登场 {pct(champion.pickRate)}</span>
            </button>
          </li>
        ))}
      </ol>
      {rows.length === 0 && <p className="hd-empty">没有匹配的英雄，换个关键词试试。</p>}
    </section>
  );
}

function CountedItems({ ids, data }: { ids: number[]; data: HaidouData }) {
  const counts = new Map<number, number>();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  return (
    <span className="hd-item-inline">
      {[...counts.entries()].map(([id]) => (
        <span className="hd-item-mini" key={id} title={data.items[id]?.name || `#${id}`}>
          <Icon
            className="hd-item-icon hd-item-icon--sm"
            src={itemIcon(id)}
            alt={data.items[id]?.name || ''}
            fallback={data.items[id]?.name || '?'}
          />
        </span>
      ))}
      {counts.size > 0 && (
        <span className="hd-item-counts">
          {[...counts.entries()]
            .map(([id, count]) => `${data.items[id]?.name || `#${id}`}${count > 1 ? `×${count}` : ''}`)
            .join(' + ')}
        </span>
      )}
    </span>
  );
}

function ItemFigure({ id, data, tag }: { id: number; data: HaidouData; tag?: string }) {
  const name = data.items[id]?.name || `装备 #${id}`;
  return (
    <figure className={`hd-item hd-item--${tag || 'normal'}`} title={name}>
      <Icon className="hd-item-icon" src={itemIcon(id)} alt={name} fallback={name} />
      <figcaption>{name}</figcaption>
    </figure>
  );
}

function ChampionDetail({ champion, data }: { champion: Champion; data: HaidouData }) {
  const [buildIndex, setBuildIndex] = useState(0);
  const [augmentSort, setAugmentSort] = useState<AugmentSort>('win');
  const [expanded, setExpanded] = useState<number | null>(null);
  const build = champion.builds[buildIndex] || champion.builds[0];

  const augments = useMemo(() => {
    const list = [...champion.augments];
    list.sort((a, b) => (augmentSort === 'win' ? b.winRate - a.winRate : b.pickRate - a.pickRate));
    return list.slice(0, 8);
  }, [champion.augments, augmentSort]);

  useEffect(() => {
    setBuildIndex(0);
    setExpanded(null);
    setAugmentSort('win');
  }, [champion.id]);

  if (!build) {
    return <p className="hd-empty">这个英雄暂时没有装备统计。</p>;
  }

  const spellNames = build.spells.map((id) => {
    const name = data.spells[String(id)] || `#${id}`;
    return id === 32 ? `${name}（雪球）` : name;
  });
  const bestCombo = champion.combos[0];

  return (
    <div className="hd-detail">
      <button type="button" className="hd-back" onClick={() => go('/')}>
        ← 返回英雄列表
      </button>

      <section className="hd-champ-hero">
        <div className="hd-portrait-wrap">
          <Icon
            className="hd-portrait"
            src={championIcon(champion.id)}
            alt={champion.name}
            fallback={champion.name}
          />
        </div>
        <div className="hd-champ-intro">
          <p className="hd-champ-eyebrow">
            {champion.title} · {roleText(champion.roles)}
          </p>
          <h1>{champion.name}</h1>
          <div className="hd-champ-badges">
            <TierBadge tier={champion.tier} />
            <span className="hd-badge">海斗 {data.meta.gamePatch}</span>
          </div>
        </div>
        <div className="hd-kpis">
          <div>
            <span>胜率</span>
            <strong className="is-good">{pct(champion.winRate)}</strong>
          </div>
          <div>
            <span>登场率</span>
            <strong>{pct(champion.pickRate)}</strong>
          </div>
          <div>
            <span>最佳双强化</span>
            <strong>{bestCombo ? pct(bestCombo.winRate) : '—'}</strong>
          </div>
        </div>
      </section>

      <section className="hd-panel">
        <div className="hd-panel-head">
          <div>
            <h2>推荐装备</h2>
            <p>按实际对局出场率排序 · 当前套路 {gameCount(build.games)}</p>
          </div>
          <div className="hd-build-tabs" role="group" aria-label="装备流派">
            {champion.builds.map((item, index) => (
              <button
                type="button"
                key={item.key}
                className={index === buildIndex ? 'is-active' : ''}
                onClick={() => setBuildIndex(index)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="hd-build">
          <div className="hd-build-main">
            <div className="hd-build-block">
              <h3>核心装备</h3>
              <div className="hd-items hd-items--core">
                {build.items.map((id) => (
                  <ItemFigure key={id} id={id} data={data} tag="core" />
                ))}
              </div>
            </div>

            <div className="hd-build-block">
              <h3>后续装备</h3>
              <div className="hd-items hd-items--later">
                {build.later.map((entry) => (
                  <div className="hd-later" key={entry.ids.join('-')}>
                    <ItemFigure id={entry.ids[0]} data={data} />
                    <span className="hd-later-rate">{pct(entry.pickRate)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside className="hd-build-side">
            <div className="hd-build-block">
              <h3>鞋子</h3>
              {build.boots.length > 0 ? (
                <div className="hd-items">
                  {build.boots.map((id) => (
                    <ItemFigure key={id} id={id} data={data} />
                  ))}
                </div>
              ) : (
                <p className="hd-muted">按局势选择</p>
              )}
            </div>

            <div className="hd-build-block">
              <h3>出门装</h3>
              <div className="hd-starters">
                {build.starters.map((ids, index) => (
                  <CountedItems ids={ids} data={data} key={index} />
                ))}
              </div>
            </div>

            <div className="hd-build-foot">
              <span>
                技能加点 <b>{build.skills.length ? build.skills.join(' › ') : '—'}</b>
              </span>
              <span>
                召唤师技能 <b>{spellNames.length ? spellNames.join(' + ') : '—'}</b>
              </span>
              <span>
                本套路胜率 <b>{pct(build.winRate)}</b> · 登场 <b>{pct(build.pickRate)}</b>
              </span>
            </div>
          </aside>
        </div>
      </section>

      <section className="hd-panel">
        <div className="hd-panel-head">
          <div>
            <h2>海克斯强化</h2>
            <p>点开可看强化说明 · 样本量越大越可信</p>
          </div>
          <div className="hd-toggle" role="group" aria-label="排序方式">
            <button
              type="button"
              className={augmentSort === 'win' ? 'is-active' : ''}
              onClick={() => setAugmentSort('win')}
            >
              胜率优先
            </button>
            <button
              type="button"
              className={augmentSort === 'pick' ? 'is-active' : ''}
              onClick={() => setAugmentSort('pick')}
            >
              登场优先
            </button>
          </div>
        </div>

        <div className="hd-aug-grid">
          {augments.map((augment) => {
            const info = data.augments[String(augment.id)];
            const rarity = info?.rarity || 'gold';
            return (
              <button
                type="button"
                className={`hd-aug hd-aug--${rarity} ${expanded === augment.id ? 'is-open' : ''}`}
                key={augment.id}
                onClick={() => setExpanded(expanded === augment.id ? null : augment.id)}
                aria-expanded={expanded === augment.id}
              >
                <Icon
                  className="hd-aug-icon"
                  src={augmentIcon(augment.id)}
                  alt=""
                  fallback={info?.name || '?'}
                />
                <span className="hd-aug-body">
                  <span className="hd-aug-top">
                    <strong>{info?.name || `强化 #${augment.id}`}</strong>
                    <span className="hd-rarity">{info?.rarityName || ''}</span>
                  </span>
                  <span className="hd-aug-stats">
                    <b>{pct(augment.winRate)}</b> 胜率 · {pct(augment.pickRate)} 登场
                  </span>
                  <span className="hd-aug-games">{gameCount(augment.games)}</span>
                  {expanded === augment.id && info?.desc && (
                    <span className="hd-aug-desc">{info.desc}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {champion.combos.length > 0 && (
        <section className="hd-panel">
          <div className="hd-panel-head">
            <div>
              <h2>最佳双强化组合</h2>
              <p>同一局同时拿到这两个强化时的胜率</p>
            </div>
          </div>
          <div className="hd-combos">
            {champion.combos.map((combo) => (
              <div className="hd-combo" key={combo.ids.join('-')}>
                <div className="hd-combo-names">
                  {combo.names.map((name, index) => (
                    <span key={`${name}-${index}`}>
                      {index > 0 && <i>+</i>}
                      {name}
                    </span>
                  ))}
                </div>
                <div className="hd-combo-stats">
                  <strong>{pct(combo.winRate)}</strong>
                  <small>{gameCount(combo.games)}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <SourceBlock meta={data.meta} compact />
    </div>
  );
}

function SourceBlock({ meta, compact = false }: { meta: HaidouData['meta']; compact?: boolean }) {
  return (
    <section className={compact ? 'hd-source hd-source--compact' : 'hd-source'}>
      <div>
        <strong>数据说明</strong>
        <p>数据来自海斗模式真实对局统计，非官方数据，仅供参考。样本量较小的英雄与强化波动较大。</p>
      </div>
      <div className="hd-source-facts">
        <span>版本 {meta.gamePatch}</span>
        <span>统计日期 {meta.dataDate}</span>
      </div>
    </section>
  );
}

export default function HaidouApp() {
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');
  const [data, setData] = useState<HaidouData | null>(null);
  const [route, setRoute] = useState<Route>(() => readRoute());

  const load = useCallback(() => {
    const controller = new AbortController();
    setState('loading');
    setError('');
    loadHaidouData(controller.signal)
      .then((next) => {
        setData(next);
        setState('ready');
      })
      .catch((err: unknown) => {
        if ((err as Error).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : '数据加载失败，请稍后重试');
        setState('error');
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const cleanup = load();
    const onHash = () => {
      setRoute(readRoute());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('hashchange', onHash);
    return () => {
      cleanup();
      window.removeEventListener('hashchange', onHash);
    };
  }, [load]);

  const champion = useMemo(() => {
    if (!data || route.name !== 'champion') return null;
    return data.champions.find((item) => item.id === route.id) || null;
  }, [data, route]);

  const openChampion = useCallback((item: Champion) => go(`/c/${item.id}`), []);

  if (state === 'loading') {
    return (
      <div className="hd">
        <div className="hd-loading">
          <span className="hd-spinner" />
          <p>正在加载海斗数据…</p>
        </div>
      </div>
    );
  }

  if (state === 'error' || !data) {
    return (
      <div className="hd">
        <div className="hd-loading">
          <p className="hd-error-title">数据没能加载出来</p>
          <p className="hd-loading-text">{error}</p>
          <button type="button" className="hd-primary" onClick={() => load()}>
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hd">
      <Header route={route} meta={data.meta} />
      <main className="hd-main">
        {route.name === 'home' && (
          <HomeView data={data} onSelect={openChampion} onRank={() => go('/rank')} />
        )}
        {route.name === 'rank' && (
          <RankView champions={data.champions} dataDate={data.meta.dataDate} onSelect={openChampion} />
        )}
        {route.name === 'champion' &&
          (champion ? (
            <ChampionDetail champion={champion} data={data} />
          ) : (
            <div className="hd-empty">
              没找到这个英雄。<button type="button" className="hd-text-button" onClick={() => go('/')}>回到首页</button>
            </div>
          ))}
      </main>
      <footer className="hd-footer">
        <span>海斗助手 · 非官方工具</span>
        <span>图标与数据版权归原权利人所有</span>
      </footer>
    </div>
  );
}
