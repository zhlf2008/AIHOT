const $ = (selector) => document.querySelector(selector);
const categories = {
  runway: "秀场与趋势",
  yarn: "纱线与色彩",
  technology: "针织与工艺",
  market: "品牌与市场",
  sustainability: "可持续材料",
};
const regions = {
  Europe: "欧洲",
  Asia: "亚洲",
  "North America": "北美",
  Oceania: "大洋洲",
};
const state = {
  view: "discover",
  category: "all",
  q: "",
  sort: "latest",
  period: "",
  offset: 0,
  total: 0,
  items: [],
  sources: [],
  controller: null,
};
let saved = {};
let toastTimer;
try {
  const value = JSON.parse(localStorage.getItem("knithot:saved") || "{}");
  if (value && typeof value === "object" && !Array.isArray(value))
    saved = value;
} catch {}
function el(tag, className, text) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text != null) e.textContent = text;
  return e;
}
function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" ? u.href : "#";
  } catch {
    return "#";
  }
}
function externalLink(url, className, text) {
  const a = el("a", className, text);
  a.href = safeUrl(url);
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
function localDate(date) {
  if (!date || Number.isNaN(Date.parse(date))) return "日期未提供";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("visible"), 2200);
}
function updateSavedCount() {
  $("#saved-count").textContent = Object.keys(saved).length || "";
}
function saveArticle(article, button) {
  const previous = saved[article.id];
  if (previous) delete saved[article.id];
  else {
    if (Object.keys(saved).length >= 200) {
      toast("收藏已达 200 条，请先整理收藏");
      return;
    }
    saved[article.id] = article;
  }
  try {
    localStorage.setItem("knithot:saved", JSON.stringify(saved));
  } catch {
    if (previous) saved[article.id] = previous;
    else delete saved[article.id];
    toast("浏览器存储未成功，请检查空间或隐私设置");
    return;
  }
  button.classList.toggle("saved", Boolean(saved[article.id]));
  button.textContent = saved[article.id] ? "▣" : "▢";
  button.setAttribute("aria-pressed", String(Boolean(saved[article.id])));
  button.setAttribute(
    "aria-label",
    `${saved[article.id] ? "取消收藏" : "收藏"}：${article.title}`,
  );
  updateSavedCount();
  toast(saved[article.id] ? "已加入本机收藏" : "已取消收藏");
  if (state.view === "saved") loadArticles();
}
function articleCard(article, index) {
  const card = el("article", "article");
  const no = el("span", "article-no", String(index + 1).padStart(2, "0"));
  card.append(no);
  const body = el("div", "article-content");
  const top = el("div", "article-top");
  const badge = el(
    "span",
    "category",
    categories[article.category] || "行业动态",
  );
  badge.dataset.category = article.category;
  top.append(
    badge,
    el("span", "article-source", article.source || article.source_id),
  );
  if (
    state.sources.find((s) => s.id === article.source_id)?.tier === "official"
  )
    top.append(el("span", "source-official", "官方"));
  const h = el("h3");
  const link = externalLink(article.url, "", article.title);
  link.append(el("span", "", "↗"));
  h.append(link);
  body.append(top, h);
  if (article.summary) body.append(el("p", "", article.summary));
  const bottom = el("div", "article-bottom");
  const date = el(
    "time",
    "",
    `${article.published_at ? "发布" : "收录"} ${localDate(article.published_at || article.collected_at)}`,
  );
  date.dateTime = article.published_at || article.collected_at;
  bottom.append(
    date,
    el("span", "", article.relevance >= 3 ? "针织相关" : "产业观察"),
    externalLink(article.url, "", "阅读原文 ↗"),
  );
  body.append(bottom);
  card.append(body);
  const button = el(
    "button",
    `save${saved[article.id] ? " saved" : ""}`,
    saved[article.id] ? "▣" : "▢",
  );
  button.type = "button";
  button.setAttribute(
    "aria-label",
    `${saved[article.id] ? "取消收藏" : "收藏"}：${article.title}`,
  );
  button.setAttribute("aria-pressed", String(Boolean(saved[article.id])));
  button.addEventListener("click", () => saveArticle(article, button));
  card.append(button);
  return card;
}
function messagePanel(title, copy, action, label) {
  const panel = el("div", "empty");
  panel.append(el("b", "", title), el("p", "", copy));
  if (action) {
    const b = el("button", "", label);
    b.addEventListener("click", action);
    panel.append(b);
  }
  return panel;
}
async function json(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
function params() {
  const p = new URLSearchParams();
  if (state.category !== "all") p.set("category", state.category);
  if (state.q) p.set("q", state.q);
  if (state.period) p.set("period", state.period);
  p.set("sort", state.sort);
  p.set("offset", state.offset);
  p.set("limit", "24");
  return p;
}
function syncLocation() {
  const p = new URLSearchParams();
  if (state.view !== "discover") p.set("view", state.view);
  if (state.category !== "all") p.set("category", state.category);
  if (state.q) p.set("q", state.q);
  if (state.period) p.set("period", state.period);
  if (state.sort !== "latest") p.set("sort", state.sort);
  history.replaceState(
    {},
    "",
    `${location.pathname}${p.size ? "?" + p : ""}${location.hash}`,
  );
}
async function loadArticles(append = false) {
  state.controller?.abort();
  const controller = new AbortController();
  state.controller = controller;
  if (!append) {
    state.offset = 0;
    state.items = [];
    $("#article-list").replaceChildren(el("div", "loading", "正在读取动态…"));
  }
  $("#article-list").setAttribute("aria-busy", "true");
  $("#load-more").disabled = true;
  syncLocation();
  try {
    let data;
    if (state.view === "saved") {
      let items = Object.values(saved).filter(
        (a) => a && typeof a.title === "string" && typeof a.url === "string",
      );
      if (state.category !== "all")
        items = items.filter((a) => a.category === state.category);
      if (state.q)
        items = items.filter((a) =>
          `${a.title} ${a.summary}`
            .toLowerCase()
            .includes(state.q.toLowerCase()),
        );
      const days =
        state.period === "day"
          ? 1
          : state.period === "week"
            ? 7
            : state.period === "month"
              ? 30
              : 0;
      if (days)
        items = items.filter(
          (a) =>
            Date.parse(a.published_at || a.collected_at) >=
            Date.now() - days * 86400000,
        );
      items.sort(
        (a, b) =>
          (state.sort === "relevance" ? b.relevance - a.relevance : 0) ||
          Date.parse(b.published_at || b.collected_at) -
            Date.parse(a.published_at || a.collected_at),
      );
      data = {
        items: items.slice(state.offset, state.offset + 24),
        total: items.length,
      };
    } else data = await json(`/api/articles?${params()}`, controller.signal);
    if (controller.signal.aborted) return;
    state.total = data.total;
    const start = state.items.length;
    state.items.push(...data.items);
    if (!append) $("#article-list").replaceChildren();
    if (!state.items.length)
      $("#article-list").append(
        messagePanel(
          state.view === "saved"
            ? "给下一次灵感，留一个位置。"
            : "这个范围还没有动态",
          state.view === "saved"
            ? "点击资讯旁的方框，把值得回看的内容留在这台设备。"
            : "试试调整分类、时间范围或原文关键词。首次采集后，内容会显示在这里。",
          () => {
            state.category = "all";
            state.q = "";
            state.period = "";
            $("#search").value = "";
            $("#period").value = "";
            updateTabs();
            loadArticles();
          },
          "查看全部范围",
        ),
      );
    data.items.forEach((a, i) =>
      $("#article-list").append(articleCard(a, start + i)),
    );
    $("#result-count").textContent =
      `${data.total} 条${state.view === "saved" ? "收藏" : "动态"}${state.q ? " · 搜索「" + state.q + "」" : ""}`;
    $("#load-more").hidden = state.items.length >= data.total;
  } catch (error) {
    if (error.name === "AbortError") return;
    if (!append)
      $("#article-list").replaceChildren(
        messagePanel(
          "资讯暂时没有连接成功",
          "稍后重试即可。也可以先浏览全球信源，前往原站阅读。",
          () => loadArticles(),
          "重新加载",
        ),
      );
    else toast("读取失败，请再试一次");
    $("#result-count").textContent = "读取失败";
  } finally {
    if (state.controller === controller) {
      $("#article-list").setAttribute("aria-busy", "false");
      $("#load-more").disabled = false;
    }
  }
}
function updateTabs() {
  document.querySelectorAll("[data-category]").forEach((b) => {
    if (b.tagName === "BUTTON") {
      b.classList.toggle("active", b.dataset.category === state.category);
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.category === state.category),
      );
    }
  });
}
function setView(view, scroll = true) {
  if (!["discover", "digest", "sources", "saved"].includes(view))
    view = "discover";
  state.view = view;
  document.querySelectorAll(".nav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === view);
    b.setAttribute("aria-current", b.dataset.view === view ? "page" : "false");
  });
  $("#hero").hidden = view !== "discover";
  $("#sources-panel").hidden = view !== "sources";
  $("#news-panel").hidden = view === "sources";
  const config = {
    discover: ["THE KNIT JOURNAL", "全球针织观察", "01 / DISCOVER"],
    digest: ["THE READING BRIEF", "趋势阅读简报", "02 / BRIEF"],
    sources: ["THE GLOBAL NETWORK", "全球权威信源", "03 / SOURCES"],
    saved: ["YOUR RESEARCH LIBRARY", "我的灵感收藏", "04 / LIBRARY"],
  }[view];
  $("#section-kicker").textContent = config[0];
  $("#section-title").textContent = config[1];
  if (view === "discover")
    $("#section-title").append(
      el("span", "small-serif", "The latest, in focus."),
    );
  $("#section-index").textContent = config[2];
  $("#reading-note").textContent =
    view === "digest"
      ? "按时间窗口汇总已收录动态，针织相关内容优先；这是阅读索引，不代表完整市场趋势或人工评审。"
      : view === "saved"
        ? "收藏仅保存在当前浏览器，清除浏览器数据后将移除，不跨设备同步。"
        : "标题与短摘要保留来源原文；无发布日期的条目标注收录时间。点击标题阅读原文。";
  state.period = view === "digest" ? "week" : "";
  state.sort = view === "digest" ? "relevance" : "latest";
  $("#period").value = state.period;
  $("#sort").value = state.sort;
  if (view === "sources") {
    renderSources();
    syncLocation();
  } else loadArticles();
  if (scroll)
    $("#journal").scrollIntoView({ behavior: "smooth", block: "start" });
}
function renderSources() {
  const grid = $("#source-grid");
  grid.replaceChildren();
  const region = $("#source-region").value,
    mode = $("#source-mode").value;
  const filtered = state.sources.filter(
    (s) =>
      (region === "all" || s.region === region) &&
      (mode === "all" ||
        (mode === "auto"
          ? s.collection !== "directory"
          : s.collection === "directory")),
  );
  if (!filtered.length) {
    grid.append(
      messagePanel(
        "暂无匹配信源",
        "请调整筛选条件，或稍后重试读取。",
        () => refreshSources(),
        "重新读取",
      ),
    );
    return;
  }
  for (const s of filtered) {
    const card = el("article", "source-card");
    const top = el("div", "source-card-top");
    top.append(
      el("span", "", s.tier === "official" ? "● 官方一手" : "○ 专业媒体"),
      el("span", "", regions[s.region] || s.region),
    );
    const h = el("h3");
    h.append(externalLink(s.url, "", s.name));
    card.append(top, h, el("p", "", s.description));
    const status = el("div", "source-status");
    status.append(
      el(
        "span",
        "",
        s.collection === "directory"
          ? "↗ 原站阅读入口"
          : s.collection === "rss"
            ? "RSS 自动采集"
            : "网页列表采集",
      ),
    );
    if (s.run)
      status.append(
        el(
          "span",
          s.run.status === "ok" ? "" : "warning",
          s.run.status === "ok"
            ? `● 上次解析 ${s.run.discovered} 条`
            : `采集待恢复 · ${s.run.error || "请稍后查看"}`,
        ),
      );
    else if (s.collection !== "directory")
      status.append(el("span", "warning", "等待首次采集"));
    if (s.access !== "open")
      status.append(
        el(
          "span",
          "",
          s.access === "subscription" ? "原站订阅制" : "含订阅内容",
        ),
      );
    const bottom = el("div", "source-card-bottom");
    bottom.append(
      el("span", "", categories[s.category]),
      externalLink(s.url, "", "访问来源 ↗"),
    );
    card.append(status, bottom);
    grid.append(card);
  }
}
async function refreshSources() {
  try {
    state.sources = (await json("/api/sources")).items;
    if (state.view === "sources") renderSources();
  } catch {
    if (state.view === "sources") renderSources();
  }
}
async function refreshStats() {
  try {
    const data = await json("/api/stats");
    $("#stat-sources").textContent = data.sourceCount;
    $("#stat-total").textContent = data.total;
    $("#stat-active").textContent = data.healthySources;
    $("#updated").textContent = data.lastChecked
      ? `上次检查 ${localDate(data.lastChecked)} ${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(data.lastChecked))} 北京时间`
      : data.collectionEnabled
        ? "等待首次定时采集"
        : "采集尚未启用";
  } catch {
    $("#updated").textContent = "更新状态暂未连接";
  }
}
const dialog = $("#info-dialog");
function showInfo(title, sections) {
  const content = $("#dialog-content");
  content.replaceChildren(
    el("span", "eyebrow", "KNIT FASHION HOT"),
    el("h2", "", title),
  );
  for (const [heading, text] of sections) {
    if (heading) content.append(el("h3", "", heading));
    content.append(el("p", "", text));
  }
  content.append(
    externalLink(
      "https://github.com/zhlf2008/AIHOT/issues",
      "",
      "问题反馈与来源更正 ↗",
    ),
  );
  dialog.showModal();
}
$("#about-button").addEventListener("click", () =>
  showInfo("从一根纱，看见下一季。", [
    [
      null,
      "针织时尚 HOT 面向针织设计师、买手和研发团队，聚合全球官方机构、行业展会与专业媒体的公开资讯。",
    ],
    [
      "如何阅读",
      "本站自动获取公开标题、短摘要和原文链接，按关键词分类和相关度排序。原始语言便于核对出处。没有原文发布日期时显示收录日期。",
    ],
    [
      "版本与框架",
      "当前 Cloudflare 版提供资讯索引、阅读简报、信源目录、搜索、本机收藏和 RSS。原框架 AIHOT 的双次模型评分、AI 中文写作、事件聚簇与后台管理保留在仓库的 PostgreSQL 部署中。",
    ],
  ]),
);
$("#privacy-button").addEventListener("click", () =>
  showInfo("隐私与使用说明", [
    [null, "更新日期：2026-10-16。适用于针织时尚 HOT 的 Cloudflare 版本。"],
    [
      "浏览与收藏",
      "浏览不需要注册。收藏仅保存在当前设备浏览器，不上传服务器。站内搜索词通过请求发送给本站以返回结果；本应用不建立用户画像，不接入第三方广告与访客统计。",
    ],
    [
      "基础设施",
      "网站由 Cloudflare Workers 与 D1 提供服务。Cloudflare 可能按其服务配置处理网络地址、请求时间和基础安全日志。应用日志用于排查请求和采集错误。",
    ],
    [
      "内容与版权",
      "来源标题与短摘要仅作为阅读索引，原文版权归来源方。只采集公开列表和订阅，不展示付费全文；访问原文适用来源网站的规则。自动归类可能有误，决策前请核对原文。RSS 与公开接口只读，建议至少间隔 10 分钟同步。",
    ],
    [
      "更正与联系",
      "内容纠错、来源更正与下架请求可通过本项目 GitHub Issues 提交。请只提供必要的公开链接，避免发布个人敏感资料。",
    ],
  ]),
);
$(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      dialog.close();
  }
});
document
  .querySelectorAll("[data-view]")
  .forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
document.querySelectorAll(".tab").forEach((b) =>
  b.addEventListener("click", () => {
    state.category = b.dataset.category;
    updateTabs();
    loadArticles();
  }),
);
$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  state.q = $("#search").value.trim();
  loadArticles();
});
$("#search").addEventListener("search", () => {
  if (!$("#search").value) {
    state.q = "";
    loadArticles();
  }
});
$("#period").addEventListener("change", () => {
  state.period = $("#period").value;
  loadArticles();
});
$("#sort").addEventListener("change", () => {
  state.sort = $("#sort").value;
  loadArticles();
});
$("#load-more").addEventListener("click", () => {
  state.offset = state.items.length;
  loadArticles(true);
});
$("#source-region").addEventListener("change", renderSources);
$("#source-mode").addEventListener("change", renderSources);
const query = new URLSearchParams(location.search);
state.category =
  Object.hasOwn(categories, query.get("category")) ? query.get("category") : "all";
state.q = (query.get("q") || "").slice(0, 100);
$("#search").value = state.q;
updateTabs();
updateSavedCount();
await Promise.allSettled([refreshSources(), refreshStats()]);
setView(query.get("view") || "discover", false);
if (["day", "week", "month"].includes(query.get("period"))) {
  state.period = query.get("period");
  $("#period").value = state.period;
  loadArticles();
}
if (query.get("sort") === "relevance") {
  state.sort = "relevance";
  $("#sort").value = state.sort;
  loadArticles();
}
