/**
 * board-demo-api · 零依赖 Cloudflare Worker
 *
 * 与 docs/API-CONTRACT.md 严格对应，无第三方运行时依赖。
 * 可直接整文件粘贴到 Cloudflare 控制台 Worker 编辑器（ES Module 格式）。
 */

const MAX_CONTENT_LENGTH = 200;
const LIST_LIMIT = 100;

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version',
  'Access-Control-Expose-Headers': 'Mcp-Session-Id',
  'Access-Control-Max-Age': '86400',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...CORS_HEADERS },
  });
}

function fail(status, code, message) {
  return json({ error: { code, message } }, status);
}

function handleOptions() {
  return new Response(null, { status: 204, headers: { ...CORS_HEADERS } });
}

async function listNotes(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, content, created_at FROM notes ORDER BY created_at DESC, id DESC LIMIT ?'
  )
    .bind(LIST_LIMIT)
    .all();
  return json({ items: results ?? [] });
}

async function createNote(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, 'BAD_JSON', '请求体不是合法的 JSON');
  }

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return fail(400, 'BAD_JSON', '请求体必须是 JSON 对象');
  }

  const raw = body.content;
  if (typeof raw !== 'string') {
    return fail(400, 'EMPTY_CONTENT', '留言内容不能为空');
  }

  const content = raw.trim();
  if (content.length === 0) {
    return fail(400, 'EMPTY_CONTENT', '留言内容不能为空');
  }
  if (Array.from(content).length > MAX_CONTENT_LENGTH) {
    return fail(400, 'TOO_LONG', `留言内容不能超过 ${MAX_CONTENT_LENGTH} 字`);
  }

  const created_at = new Date().toISOString();
  const result = await env.DB.prepare(
    'INSERT INTO notes (content, created_at) VALUES (?, ?)'
  )
    .bind(content, created_at)
    .run();

  const id = Number(result.meta.last_row_id);
  return json({ item: { id, content, created_at } }, 201);
}

async function deleteNote(rawId, env) {
  if (!/^[0-9]+$/.test(rawId)) {
    return fail(400, 'BAD_ID', '留言 ID 不合法');
  }

  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return fail(400, 'BAD_ID', '留言 ID 不合法');
  }

  const result = await env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
  if (!result.meta.changes) {
    return fail(404, 'NOT_FOUND', '留言不存在');
  }

  return json({ ok: true });
}

// ---------------------------------------------------------------------------
// 海斗助手 MCP（Streamable HTTP，零鉴权、只读）
// 挂载点：POST /mcp，复用同站静态数据 /data/haidou.json
// ---------------------------------------------------------------------------

const MCP_SERVER = { name: 'haidou-lol-mcp', version: '0.1.0', title: '海斗助手 MCP' };
const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const HAIDOU_DATA_URL = 'https://board-demo-web.pages.dev/data/haidou.json';
const MCP_INSTRUCTIONS = [
  '海斗助手提供《英雄联盟》海克斯大乱斗（ARAM）的模式数据：英雄胜率、出装、海克斯强化与胜率榜。',
  '当用户问「这局玩哪个英雄」「XX 怎么出装」「带什么符文/强化」时优先使用这里的工具。',
  '注意：海斗模式没有传统符文，成长来自海克斯强化（Augment），回答时请说明这一点。',
  '数据来自公开对局统计（非官方），回答时应带上版本与统计日期，样本量小的结论要提示不确定性。',
].join('\n');

const ROLE_LABELS = {
  fighter: '战士',
  tank: '坦克',
  mage: '法师',
  marksman: '射手',
  assassin: '刺客',
  support: '辅助',
};
const ROLE_ALIASES = {
  战士: 'fighter',
  坦克: 'tank',
  法师: 'mage',
  射手: 'marksman',
  刺客: 'assassin',
  辅助: 'support',
  adc: 'marksman',
  中单: 'mage',
  打野: 'fighter',
  上单: 'fighter',
  全部: null,
  all: null,
};

let haidouCache = null;

async function loadHaidouData(env, request) {
  if (haidouCache) return haidouCache;
  let response;
  if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
    response = await env.ASSETS.fetch(new Request(new URL('/data/haidou.json', request.url)));
  } else {
    response = await fetch(HAIDOU_DATA_URL, { headers: { 'user-agent': 'haidou-mcp/0.1' } });
  }
  if (!response.ok) throw new Error(`海斗数据加载失败（HTTP ${response.status}）`);
  haidouCache = await response.json();
  return haidouCache;
}

const mcpPct = (value) => `${(value * 100).toFixed(1)}%`;
const mcpNormalize = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\s'’·•."()（）\-_/]/g, '');

function mcpRole(role) {
  if (role == null || role === '') return null;
  if (role in ROLE_LABELS) return role;
  const mapped = ROLE_ALIASES[role] !== undefined ? ROLE_ALIASES[role] : ROLE_ALIASES[String(role).toLowerCase()];
  return mapped === undefined ? null : mapped;
}

function mcpScoreChampion(champion, rawQuery) {
  const q = mcpNormalize(rawQuery);
  if (!q) return null;
  const name = mcpNormalize(champion.name);
  if (name === q) return { champion, score: 1000 };
  if (name.startsWith(q)) return { champion, score: 920 };
  if (name.includes(q)) return { champion, score: 760 };
  if (champion.alias && mcpNormalize(champion.alias) === q) return { champion, score: 900 };
  if (champion.alias && mcpNormalize(champion.alias).startsWith(q)) return { champion, score: 860 };
  const alias = (champion.aliases || []).find((item) => mcpNormalize(item) === q);
  if (alias) return { champion, score: 890, label: `俗称「${alias}」` };
  const aliasPrefix = (champion.aliases || []).find((item) => mcpNormalize(item).startsWith(q));
  if (aliasPrefix) return { champion, score: 830, label: `俗称「${aliasPrefix}」` };
  if (champion.pinyin === q) return { champion, score: 880, label: `拼音 ${champion.pinyin}` };
  if (champion.pinyin && champion.pinyin.startsWith(q))
    return { champion, score: 850, label: `拼音 ${champion.pinyin}` };
  if (champion.pinyinInitials === q)
    return { champion, score: 840, label: `首字母 ${String(champion.pinyinInitials).toUpperCase()}` };
  const title = mcpNormalize(champion.title);
  if (title === q) return { champion, score: 820, label: `称号「${champion.title}」` };
  if (title.includes(q)) return { champion, score: 500, label: `称号「${champion.title}」` };
  const aliasContains = (champion.aliases || []).find((item) => mcpNormalize(item).includes(q));
  if (aliasContains) return { champion, score: 480, label: `俗称「${aliasContains}」` };
  if (champion.pinyin && champion.pinyin.includes(q)) return { champion, score: 430 };
  return null;
}

function mcpSearch(data, query, limit = 5) {
  return data.champions
    .map((champion) => mcpScoreChampion(champion, query))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || b.champion.winRate - a.champion.winRate)
    .slice(0, limit);
}

function mcpResolveChampion(data, input) {
  const hits = mcpSearch(data, input, 1);
  if (!hits.length) return null;
  return hits[0];
}

function mcpChampionLine(champion) {
  const roles = champion.roles.map((role) => ROLE_LABELS[role] || role).join('/');
  return `${champion.name}（${champion.title}，${roles}）胜率 ${mcpPct(champion.winRate)}、登场 ${mcpPct(champion.pickRate)}、T${champion.tier}`;
}

function mcpChampionEntry(champion, label) {
  const roles = champion.roles.map((role) => ROLE_LABELS[role] || role).join('/');
  const aliases = (champion.aliases || []).slice(0, 4).join('、');
  return [
    `- **${champion.name}**（${champion.title} · ${roles}）`,
    `  胜率 ${mcpPct(champion.winRate)} · 登场 ${mcpPct(champion.pickRate)} · T${champion.tier}（id=${champion.id}）`,
    aliases ? `  常见叫法：${aliases}` : '',
    label ? `  匹配原因：${label}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function mcpItemNames(data, ids) {
  const counts = new Map();
  for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  return [...counts.entries()]
    .map(([id, count]) => `${data.items[id]?.name || `装备#${id}`}${count > 1 ? `×${count}` : ''}`)
    .join(' + ');
}

function mcpBuildBlock(data, build) {
  const lines = [
    `### ${build.label}套路（胜率 ${mcpPct(build.winRate)}，登场 ${mcpPct(build.pickRate)}，样本 ${build.games.toLocaleString('zh-CN')} 场）`,
    `- 核心装备：${mcpItemNames(data, build.items)}`,
    `- 鞋子：${build.boots.length ? mcpItemNames(data, build.boots) : '按局势选择'}`,
    `- 出门装：${build.starters.map((ids) => mcpItemNames(data, ids)).join(' 或 ')}`,
  ];
  if (build.later.length) {
    lines.push(
      `- 后续装备：${build.later
        .map((entry) => `${mcpItemNames(data, entry.ids)}（登场 ${mcpPct(entry.pickRate)}）`)
        .join('、')}`,
    );
  }
  lines.push(
    `- 技能加点：${build.skills.length ? build.skills.join(' > ') : '数据不足'}`,
    `- 召唤师技能：${build.spells.length ? build.spells.map((id) => data.spells[id] || id).join(' + ') : '数据不足'}`,
  );
  return lines.join('\n');
}

function mcpAugmentBlock(data, champion, sort = 'win', limit = 6) {
  const list = [...champion.augments].sort((a, b) =>
    sort === 'pick' ? b.pickRate - a.pickRate : b.winRate - a.winRate,
  );
  const lines = list.slice(0, limit).map((augment, index) => {
    const info = data.augments[String(augment.id)];
    const desc = info?.desc ? `：${info.desc.slice(0, 110)}${info.desc.length > 110 ? '…' : ''}` : '';
    return `${index + 1}. **${info?.name || `强化#${augment.id}`}**（${info?.rarityName || '未知品质'}）胜率 ${mcpPct(
      augment.winRate,
    )} · 登场 ${mcpPct(augment.pickRate)} · ${augment.games.toLocaleString('zh-CN')} 场${desc}`;
  });
  const combos = champion.combos.slice(0, 3).map((combo) => {
    return `- ${combo.names.join(' + ')}：胜率 ${mcpPct(combo.winRate)}（${combo.games.toLocaleString('zh-CN')} 场）`;
  });
  return { list: lines, combos };
}

const MCP_TOOLS = [
  {
    name: 'search_champion',
    title: '按名字/外号/拼音搜英雄',
    description:
      '搜索海斗英雄。支持官方名、称号、中文外号（如「压缩」「卡牌」「盲僧」）、英文名、全拼和首字母（如 yasuo / ys）。返回英雄胜率、登场率、强度等级。用户提到某个英雄但不确定是哪个时先用它。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '英雄名、外号、称号、英文名、拼音或首字母' },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: '返回条数' },
      },
      required: ['query'],
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'recommend_champions',
    title: '推荐这局玩哪个英雄',
    description:
      '按当前版本海斗数据推荐英雄，回答「玩谁 / 哪个英雄强 / 这局选什么」。可按定位过滤，按胜率或登场率排序。返回排名、胜率、登场率、强度等级与最佳强化，并附带数据版本。',
    inputSchema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description: '定位过滤：战士/坦克/法师/射手/刺客/辅助，或 fighter/tank/mage/marksman/assassin/support；不填为全部',
        },
        sort: { type: 'string', enum: ['win', 'pick'], default: 'win', description: 'win=按胜率，pick=按登场率' },
        count: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: '返回数量' },
      },
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_build',
    title: '查英雄出装',
    description:
      '查询某个海斗英雄的推荐出装：核心装备、鞋子、出门装、后续装备、技能加点、召唤师技能，并给出各套路胜率与样本量。回答「XX 买什么装备 / 怎么出装」时使用。',
    inputSchema: {
      type: 'object',
      properties: {
        champion: { type: 'string', description: '英雄名、外号或拼音' },
        style: { type: 'string', description: '可选套路过滤，如 法系/坦克/暴击/战士/穿甲/普攻特效/功能/攻击/混伤' },
      },
      required: ['champion'],
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_augments',
    title: '查海克斯强化（海斗的“符文”）',
    description:
      '查询某个海斗英雄推荐的海克斯强化与最佳双强化组合。海斗模式没有传统符文，用户问「带什么符文/天赋」时用这个工具，并在回答里说明海斗用海克斯强化替代符文。',
    inputSchema: {
      type: 'object',
      properties: {
        champion: { type: 'string', description: '英雄名、外号或拼音' },
        sort: { type: 'string', enum: ['win', 'pick'], default: 'win', description: 'win=胜率优先，pick=登场率优先' },
        limit: { type: 'integer', minimum: 1, maximum: 14, default: 6, description: '返回强化数量' },
      },
      required: ['champion'],
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_rankings',
    title: '海斗胜率榜',
    description:
      '获取当前版本海斗胜率榜（按胜率降序），可按定位过滤。回答「现在谁最强 / 胜率榜 / 版本强势英雄」时使用。',
    inputSchema: {
      type: 'object',
      properties: {
        role: { type: 'string', description: '定位过滤：战士/坦克/法师/射手/刺客/辅助，不填为全部' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: '返回条数' },
      },
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_champion_profile',
    title: '英雄完整档案',
    description:
      '一次返回某个英雄的完整海斗档案：强度数据、推荐出装、海克斯强化、最佳双强化组合。用户想「全面了解 XX 怎么玩」时使用，比分别调用 get_build / get_augments 更省事。',
    inputSchema: {
      type: 'object',
      properties: {
        champion: { type: 'string', description: '英雄名、外号或拼音' },
      },
      required: ['champion'],
    },
    annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
];

function mcpHeader(data) {
  return `> 数据版本 ${data.meta.gamePatch} · 统计日期 ${data.meta.dataDate} · 非官方统计，仅供参考`;
}

function mcpUnknownChampion(input) {
  return `没有找到英雄「${input}」。可以先用 search_champion 搜索官方名、外号或拼音（例如 亚索 / 压缩 / yasuo / ys）。`;
}

async function mcpCallTool(name, args, env, request) {
  const data = await loadHaidouData(env, request);

  if (name === 'search_champion') {
    const query = String(args.query || '').trim();
    if (!query) throw new Error('query 不能为空');
    const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 20);
    const hits = mcpSearch(data, query, limit);
    if (!hits.length) {
      return `${mcpHeader(data)}\n\n没有找到与「${query}」匹配的英雄。试试官方名、外号（压缩/卡牌/盲僧）、英文名或拼音首字母。`;
    }
    return [mcpHeader(data), '', `搜索「${query}」的结果：`, '', ...hits.map((hit) => mcpChampionEntry(hit.champion, hit.label))].join('\n');
  }

  if (name === 'recommend_champions') {
    const role = mcpRole(args.role);
    if (args.role && role === null && args.role !== '全部' && args.role !== 'all') {
      throw new Error(`无法识别定位「${args.role}」，可用：战士/坦克/法师/射手/刺客/辅助`);
    }
    const sort = args.sort === 'pick' ? 'pick' : 'win';
    const count = Math.min(Math.max(Number(args.count) || 5, 1), 20);
    const pool = data.champions.filter((champion) => !role || champion.roles.includes(role));
    const list = [...pool]
      .sort((a, b) => (sort === 'pick' ? b.pickRate - a.pickRate : b.winRate - a.winRate))
      .slice(0, count);
    const roleText = role ? ROLE_LABELS[role] : '全部定位';
    const lines = list.map((champion, index) => {
      const best = [...champion.augments]
        .filter((augment) => augment.games >= 300)
        .sort((a, b) => b.winRate - a.winRate)[0];
      const bestName = best ? data.augments[String(best.id)]?.name : null;
      return `${index + 1}. **${champion.name}**（${champion.title}）胜率 ${mcpPct(champion.winRate)} · 登场 ${mcpPct(
        champion.pickRate,
      )} · T${champion.tier}${bestName ? ` · 最强强化「${bestName}」` : ''}`;
    });
    return [
      mcpHeader(data),
      '',
      `## ${roleText}推荐（按${sort === 'pick' ? '登场率' : '胜率'}排序）`,
      '',
      ...lines,
      '',
      '需要具体出装或强化，继续调用 get_build / get_augments（也可直接 get_champion_profile）。',
    ].join('\n');
  }

  if (name === 'get_rankings') {
    const role = mcpRole(args.role);
    if (args.role && role === null && args.role !== '全部' && args.role !== 'all') {
      throw new Error(`无法识别定位「${args.role}」，可用：战士/坦克/法师/射手/刺客/辅助`);
    }
    const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50);
    const list = data.champions
      .filter((champion) => !role || champion.roles.includes(role))
      .sort((a, b) => b.winRate - a.winRate)
      .slice(0, limit);
    const lines = list.map(
      (champion, index) =>
        `${index + 1}. ${champion.name}（${champion.title}）${mcpPct(champion.winRate)} · 登场 ${mcpPct(
          champion.pickRate,
        )} · T${champion.tier}`,
    );
    return [mcpHeader(data), '', `## 海斗胜率榜 TOP ${list.length}${role ? ` · ${ROLE_LABELS[role]}` : ''}`, '', ...lines].join('\n');
  }

  if (name === 'get_build' || name === 'get_augments' || name === 'get_champion_profile') {
    const input = String(args.champion || '').trim();
    if (!input) throw new Error('champion 不能为空');
    const hit = mcpResolveChampion(data, input);
    if (!hit) return mcpUnknownChampion(input);
    const champion = hit.champion;
    const head = [
      mcpHeader(data),
      '',
      `## ${champion.name} · ${champion.title}`,
      mcpChampionLine(champion),
      hit.label ? `（按 ${hit.label} 匹配）` : '',
    ].filter(Boolean);

    if (name === 'get_build') {
      const style = args.style ? mcpNormalize(args.style) : '';
      const builds = style
        ? champion.builds.filter((build) => mcpNormalize(build.label).includes(style))
        : champion.builds;
      const picked = builds.length ? builds : champion.builds;
      const note = style && !builds.length ? `\n（没有「${args.style}」套路，下面是全部推荐）` : '';
      return [
        ...head,
        note,
        '',
        ...picked.map((build) => `${mcpBuildBlock(data, build)}\n`),
        '装备与加点来自真实对局统计，可结合对方阵容微调；样本量小的套路慎用。',
      ].join('\n');
    }

    const sort = args.sort === 'pick' ? 'pick' : 'win';
    const limit = Math.min(Math.max(Number(args.limit) || 6, 1), 14);
    const augmentBlock = mcpAugmentBlock(data, champion, sort, limit);
    const augmentText = [
      '### 海克斯强化（海斗模式没有传统符文，用强化替代）',
      '',
      ...augmentBlock.list,
      augmentBlock.combos.length ? '' : '',
      augmentBlock.combos.length ? '### 最佳双强化组合' : '',
      ...augmentBlock.combos,
    ]
      .filter((line) => line !== '')
      .join('\n');

    if (name === 'get_augments') {
      return [...head, '', augmentText, '', '强化出现有随机性，优先记住前 3 个；按胜率排序不等于每局都能拿到。'].join('\n');
    }

    return [
      ...head,
      '',
      ...champion.builds.slice(0, 2).map((build) => `${mcpBuildBlock(data, build)}\n`),
      augmentText,
      '',
      '以上为统计推荐，实际对局请结合阵容、装备进度与强化刷新情况调整。',
    ].join('\n');
  }

  throw new Error(`未知工具：${name}`);
}

function mcpRpc(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function mcpRpcError(id, code, message, data) {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data ? { data } : {}) } };
}

async function handleMcpMessage(message, env, request) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return mcpRpcError(null, -32600, 'Invalid Request');
  }
  const { id, method, params } = message;
  if (typeof method !== 'string') return mcpRpcError(id ?? null, -32600, 'Invalid Request');
  if (method.startsWith('notifications/')) return null;

  if (method === 'initialize') {
    const requested = params?.protocolVersion;
    const protocolVersion = MCP_PROTOCOL_VERSIONS.includes(requested) ? requested : MCP_PROTOCOL_VERSIONS[0];
    return mcpRpc(id ?? null, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: MCP_SERVER,
      instructions: MCP_INSTRUCTIONS,
    });
  }

  if (method === 'ping') return mcpRpc(id ?? null, {});

  if (method === 'tools/list') return mcpRpc(id ?? null, { tools: MCP_TOOLS });

  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments && typeof params.arguments === 'object' ? params.arguments : {};
    if (!MCP_TOOLS.some((tool) => tool.name === name)) {
      return mcpRpcError(id ?? null, -32602, `未知工具：${String(name)}`);
    }
    try {
      const text = await mcpCallTool(name, args, env, request);
      return mcpRpc(id ?? null, { content: [{ type: 'text', text }] });
    } catch (err) {
      return mcpRpc(id ?? null, {
        content: [{ type: 'text', text: `工具执行失败：${err && err.message ? err.message : '未知错误'}` }],
        isError: true,
      });
    }
  }

  return mcpRpcError(id ?? null, -32601, `Method not found: ${method}`);
}

async function handleMcp(request, env) {
  const method = request.method.toUpperCase();
  if (method === 'OPTIONS') return handleOptions();
  if (method !== 'POST') {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32000, message: 'MCP 端点使用 Streamable HTTP：请用 POST 发送 JSON-RPC 消息' },
      }),
      { status: 405, headers: { ...JSON_HEADERS, ...CORS_HEADERS, Allow: 'POST, OPTIONS' } },
    );
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify(mcpRpcError(null, -32700, 'Parse error')), {
      status: 400,
      headers: { ...JSON_HEADERS, ...CORS_HEADERS },
    });
  }

  const sessionId = request.headers.get('mcp-session-id') || crypto.randomUUID();
  const headers = { ...JSON_HEADERS, ...CORS_HEADERS, 'Mcp-Session-Id': sessionId };

  if (Array.isArray(payload)) {
    const responses = [];
    for (const message of payload) {
      const response = await handleMcpMessage(message, env, request);
      if (response) responses.push(response);
    }
    if (!responses.length) return new Response(null, { status: 202, headers });
    return new Response(JSON.stringify(responses), { status: 200, headers });
  }

  const response = await handleMcpMessage(payload, env, request);
  if (!response) return new Response(null, { status: 202, headers });
  return new Response(JSON.stringify(response), { status: 200, headers });
}

/**
 * 核心请求处理：便于本地 Node 测试直接调用。
 * @param {Request} request
 * @param {{ DB: any }} env
 */
export async function handleRequest(request, env) {
  try {
    const method = request.method.toUpperCase();
    if (method === 'OPTIONS') return handleOptions();

    const { pathname } = new URL(request.url);

    if (pathname === '/mcp') {
      return handleMcp(request, env);
    }

    if (pathname === '/api/health') {
      if (method !== 'GET') return fail(404, 'NOT_FOUND', '接口不存在');
      return json({ ok: true });
    }

    if (pathname === '/api/notes') {
      if (method === 'GET') return await listNotes(env);
      if (method === 'POST') return await createNote(request, env);
      return fail(404, 'NOT_FOUND', '接口不存在');
    }

    const noteMatch = /^\/api\/notes\/([^/]+)$/.exec(pathname);
    if (noteMatch && method === 'DELETE') {
      return await deleteNote(noteMatch[1], env);
    }

    return fail(404, 'NOT_FOUND', '接口不存在');
  } catch (err) {
    console.error('Unhandled error:', err && err.stack ? err.stack : err);
    return fail(500, 'INTERNAL', '服务异常，请稍后重试');
  }
}

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  },
};
