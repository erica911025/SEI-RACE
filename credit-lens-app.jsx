import { useState, useEffect, useRef } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
  ResponsiveContainer,
} from "recharts";

// ============================================================
// 智貸先鋒 企業授信情資服務網 — 政府服務網站設計語言版
// 參考:data.taipei / schema.gov.tw / ey.gov.tw 等台灣政府入口網
// 設計原則:白底、單一機關色(深藍 sky-900)、小圓角、1px 細框、
//          左側色條區塊標題、列表導向、制式 footer、字級調整
// 接真實 API:搜尋 [API] 標記處
// ============================================================

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700 focus-visible:ring-offset-1";
const num = "tabular-nums";

// 三個 Agent 的識別(政府風:白卡 + 左側色條,不用大面積色塊)
const AGENT = {
  finance: { name: "財務分析", edge: "border-l-amber-500", text: "text-amber-800", chip: "bg-amber-50 text-amber-800 border-amber-300" },
  tech: { name: "技術情報", edge: "border-l-sky-600", text: "text-sky-800", chip: "bg-sky-50 text-sky-800 border-sky-300" },
  judge: { name: "風險審查", edge: "border-l-rose-600", text: "text-rose-800", chip: "bg-rose-50 text-rose-800 border-rose-300" },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const Dots = () => <span className="animate-pulse" aria-hidden="true"> …</span>;

// 區塊標題:政府網站經典的左側色條樣式
const SectionTitle = ({ children, action }) => (
  <div className="flex items-center justify-between gap-4 mb-3">
    <h2 className="border-l-4 border-sky-800 pl-3 text-lg font-bold text-slate-900">{children}</h2>
    {action}
  </div>
);

const Cite = ({ text }) => (
  <span className="inline-block mt-1 mr-1 px-1.5 py-0.5 rounded-sm text-xs bg-slate-100 text-slate-600 border border-slate-300">
    資料來源:{text}
  </span>
);

function Score({ value, size = "text-2xl", color = "text-sky-900" }) {
  return (
    <span className={`${num} font-bold ${size} ${color}`}>
      {value}<span className="text-xs text-slate-500 font-normal"> 分</span>
    </span>
  );
}

function Waterfall({ items, finalScore }) {
  let cursor = 0;
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => {
        const start = it.type === "base" ? 0 : cursor;
        const left = it.value >= 0 ? start : start + it.value;
        const width = Math.abs(it.value);
        cursor = start + it.value;
        const bar = it.type === "base" ? "bg-slate-400" : it.value >= 0 ? "bg-emerald-600" : "bg-rose-600";
        const tc = it.type === "base" ? "text-slate-600" : it.value >= 0 ? "text-emerald-700" : "text-rose-700";
        return (
          <div key={i} className="flex items-center gap-3 text-sm">
            <div className="w-28 text-slate-700 text-right shrink-0 text-xs">{it.label}</div>
            <div className="flex-1 h-4 bg-slate-100 border border-slate-200 relative overflow-hidden">
              <div className={`absolute h-full ${bar} motion-safe:transition-[left,width] motion-safe:duration-700`}
                style={{ left: `${left}%`, width: `${width}%` }} />
            </div>
            <div className={`w-10 ${num} text-sm text-right ${tc}`}>{it.type === "base" ? it.value : (it.value > 0 ? "+" : "") + it.value}</div>
          </div>
        );
      })}
      <div className="flex items-center justify-between pt-2 mt-1 border-t-2 border-slate-300">
        <span className="text-sm font-bold text-slate-900">綜合評分</span>
        <Score value={finalScore} />
      </div>
    </div>
  );
}

// ============================================================
// Mock 資料([API] 全部可由後端取代)
// ============================================================
const CASES = [
  { id: "12345678", name: "XX 固態電池科技股份有限公司", industry: "儲能/電池", stage: "post", score: 68, updated: "115-07-16", status: "審查中" },
  { id: "23456789", name: "OO 低軌衛星通訊股份有限公司", industry: "太空科技", stage: "pre", score: null, updated: "115-07-15", status: "情資蒐集" },
  { id: "34567890", name: "ΔΔ 基因定序服務股份有限公司", industry: "生技醫療", stage: "mid", score: 74, updated: "115-07-14", status: "面談排程" },
];

const MOCK = {
  finance: { score: 58, findings: [
    { text: "近三年資本支出年增 82%,自由現金流連續兩年為負,擴產資金高度依賴外部融資。", cite: "113 年度財報 p.45" },
    { text: "流動比率 0.94,低於同業中位數 1.6,短期償債能力偏弱。", cite: "TWSE 財報摘要 API" },
  ]},
  tech: { score: 81, findings: [
    { text: "固態電解質相關專利 47 件,12 件被國際大廠引用,技術護城河明確。", cite: "TIPO 專利檢索" },
    { text: "研報預估固態電池 2028 市場 CAGR 34%,惟量產良率仍在爬坡。", cite: "產業研究報告 2025Q4" },
  ]},
  judge: {
    contradictions: [
      { title: "量產時程 vs 資金缺口", detail: "技術面預估 2027 量產放量,但財務面現金流為負、流動比率僅 0.94,資金銜接方案未被說明,列為面談必問。" },
      { title: "客戶集中風險未被技術面納入", detail: "前兩大客戶佔營收 61%,若即為專利引用大廠,技術授權與訂單高度綁定,風險應合併評估。" },
    ],
    verdict: "技術護城河成立(採信);財務體質偏弱(採信);市場預估缺客戶結構佐證(部分採信)。綜合 71 分,建議附條件核貸並於面談釐清資金方案。",
    finalScore: 71,
    waterfall: [
      { label: "基礎分", value: 60, type: "base" }, { label: "技術護城河", value: 18, type: "plus" },
      { label: "產業景氣", value: 9, type: "plus" }, { label: "財務體質", value: -12, type: "minus" },
      { label: "客戶集中", value: -4, type: "minus" },
    ],
  },
  radar: [
    { key: "tech", label: "技術壁壘", score: 82, benchmark: 55, agent: "tech", reason: "專利 47 件、12 件遭國際大廠引用,近三年申請量成長 3 倍。", cites: ["TIPO 專利檢索"] },
    { key: "market", label: "市場規模", score: 74, benchmark: 60, agent: "tech", reason: "2028 CAGR 預估 34%,惟量產良率爬坡中,放量時點不確定。", cites: ["產業研報 2025Q4"] },
    { key: "finance", label: "財務體質", score: 48, benchmark: 65, agent: "finance", reason: "自由現金流連兩年為負、流動比率 0.94,為六維最弱項。", cites: ["113 年報 p.45"] },
    { key: "legal", label: "訴訟風險", score: 71, benchmark: 70, agent: "judge", reason: "近五年僅一件勞資調解已和解,無專利侵權訴訟在案。", cites: ["司法院裁判書 API"] },
    { key: "esg", label: "ESG 合規", score: 66, benchmark: 68, agent: "judge", reason: "一筆廢水裁罰(12 萬)已改善結案,勞動部名單無紀錄。", cites: ["環境部裁罰紀錄"] },
    { key: "macro", label: "產業景氣", score: 77, benchmark: 62, agent: "finance", reason: "EV 滲透率上升、鋰價回落 40%,循環位置有利。", cites: ["FRED 指數"] },
  ],
  questions: [
    { id: 1, dim: "財務體質", q: "自由現金流連續兩年為負,量產前 2–3 年資金缺口的具體銜接方案?", why: "財務分析 Agent 判定最大違約風險(113 年報 p.45)" },
    { id: 2, dim: "市場規模", q: "目前量產良率實際數字?損益兩平所需良率門檻?", why: "技術情報 Agent 發現新聞提及良率仍在爬坡(GDELT)" },
    { id: 3, dim: "技術壁壘", q: "前兩大客戶是否即為專利主要引用方?合約年限?", why: "審查官交叉質詢發現客戶集中與技術授權可能綁定" },
  ],
  postExtract: {
    commitments: [
      { item: "提供 B 輪投資意向書副本", owner: "財務長 林OO", due: "115-08-15" },
      { item: "提供良率改善合約", owner: "技術長 張OO", due: "115-08-15" },
    ],
    responses: [
      { risk: "資金銜接方案", summary: "B 輪意向書 8 億、Q4 交割,惟未具約束力", verdict: "partial" },
      { risk: "量產良率門檻", summary: "現況 63%/門檻 75%,有改善合約與明確時程", verdict: "resolved" },
      { risk: "客戶集中與專利綁定", summary: "證實綁定、2027 到期,續約中且第三客戶送樣", verdict: "partial" },
    ],
    newRisks: [{ text: "廠房二期再投入 12 億,原財報未揭露,資金缺口實際擴大。" }],
  },
  postScore: {
    final: 68,
    waterfall: [
      { label: "拜訪前基準", value: 71, type: "base" }, { label: "良率已化解", value: 8, type: "plus" },
      { label: "承諾具體可驗", value: 4, type: "plus" }, { label: "資金仍未落定", value: -6, type: "minus" },
      { label: "新增未揭露支出", value: -9, type: "minus" },
    ],
    rec: "附條件核貸:以 8/15 承諾文件到齊 + B 輪正式簽約為撥款前提;二期廠房資金計畫須補件。",
  },
};

const VERDICT = {
  resolved: { label: "已化解", cls: "bg-emerald-50 text-emerald-800 border-emerald-400" },
  partial: { label: "部分化解", cls: "bg-amber-50 text-amber-800 border-amber-400" },
  unresolved: { label: "未化解", cls: "bg-rose-50 text-rose-800 border-rose-400" },
};
const STAGE_LABEL = { pre: "拜訪前", mid: "拜訪中", post: "拜訪後" };

// ============================================================
// 版面骨架
// ============================================================

// 上方工具列(深色細帶):政府網站標配
function UtilityBar({ fontScale, setFontScale }) {
  const sizes = [{ k: "s", label: "小" }, { k: "m", label: "中" }, { k: "l", label: "大" }];
  return (
    <div className="bg-sky-950 text-sky-100 text-xs">
      <div className="max-w-5xl mx-auto px-4 h-8 flex items-center justify-between">
        <span>精誠 SEI 競賽展示系統 · 非正式金融服務</span>
        <div className="flex items-center gap-3">
          <a href="#" onClick={(e) => e.preventDefault()} className={`hover:underline underline-offset-2 rounded-sm px-0.5 ${focusRing}`}>網站導覽</a>
          <span aria-hidden="true" className="text-sky-800">|</span>
          <span className="flex items-center gap-1" role="group" aria-label="字級調整">
            字級
            {sizes.map((s) => (
              <button key={s.k} onClick={() => setFontScale(s.k)} aria-pressed={fontScale === s.k}
                className={`w-6 h-6 rounded-sm ${focusRing} ${fontScale === s.k ? "bg-sky-100 text-sky-950 font-bold" : "hover:bg-sky-800"}`}>
                {s.label}
              </button>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}

function Header({ nav, onNav }) {
  const items = ["案件總覽", "情資查詢", "報告中心", "關於平臺"];
  return (
    <header className="bg-white border-b-4 border-sky-900">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-6 flex-wrap">
        <button onClick={() => onNav("案件總覽")} className={`flex items-center gap-3 rounded-sm ${focusRing}`}>
          <span aria-hidden="true" className="grid place-items-center w-11 h-11 rounded-sm bg-sky-900 text-white">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /><path d="M8 11h6M11 8v6" />
            </svg>
          </span>
          <span className="text-left">
            <span className="block text-xl font-bold text-sky-950 leading-tight">智貸先鋒 企業授信情資服務網</span>
            <span className="block text-xs text-slate-500 leading-tight tracking-wide">Credit-Lens Corporate Credit Intelligence</span>
          </span>
        </button>
        <nav aria-label="主選單">
          <ul className="flex items-center gap-1">
            {items.map((t) => (
              <li key={t}>
                <button onClick={() => onNav(t)} aria-current={nav === t ? "page" : undefined}
                  className={`px-3 py-2 text-sm font-medium border-b-2 motion-safe:transition-colors ${focusRing} ${
                    nav === t ? "border-sky-800 text-sky-900 font-bold" : "border-transparent text-slate-600 hover:text-sky-900 hover:border-sky-300"}`}>
                  {t}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

// Hero 色帶:標語 + 大搜尋框 + 統計數字(data.taipei 式)
function Hero({ query, setQuery }) {
  return (
    <div className="bg-sky-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">多源情資交叉驗證,開啟新興產業授信新視野</h1>
        <p className="text-sky-200 text-sm mb-5">整合財報、專利、裁判書、裁罰紀錄等 7 項公開資料源,由 AI 審查委員會為每一件授信案把關。</p>
        <form role="search" onSubmit={(e) => e.preventDefault()} className="flex max-w-2xl">
          <label htmlFor="case-search" className="sr-only">搜尋案件</label>
          <input id="case-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="請輸入公司名稱或統一編號…" autoComplete="off" spellCheck={false}
            className={`flex-1 h-12 px-4 text-slate-900 bg-white rounded-l-sm placeholder-slate-400 ${focusRing}`} />
          <button type="submit" className={`h-12 px-6 bg-amber-500 hover:bg-amber-400 text-sky-950 font-bold rounded-r-sm motion-safe:transition-colors ${focusRing}`}>
            搜尋
          </button>
        </form>
        <dl className="flex gap-8 mt-6 text-sm flex-wrap">
          {[["介接資料源", "7 項"], ["進行中案件", "3 件"], ["本月 AI 分析", "128 次"]].map(([k, v]) => (
            <div key={k} className="flex items-baseline gap-2">
              <dt className="text-sky-300">{k}</dt>
              <dd className={`${num} text-xl font-bold`}>{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function Breadcrumb({ trail }) {
  return (
    <nav aria-label="麵包屑" className="text-sm text-slate-500">
      <ol className="flex items-center gap-1 flex-wrap">
        {trail.map((t, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <span aria-hidden="true" className="text-slate-400 px-0.5">/</span>}
            {t.onClick ? (
              <button onClick={t.onClick} className={`text-sky-800 hover:underline underline-offset-2 rounded-sm px-0.5 ${focusRing}`}>
                {t.label}
              </button>
            ) : (
              <span aria-current="page" className="text-slate-700">{t.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const TABS = [
  { key: "committee", label: "AI 審查會議" },
  { key: "pre", label: "拜訪前情資" },
  { key: "mid", label: "拜訪中提詞" },
  { key: "post", label: "拜訪後評分" },
];

// 頁籤:政府網站常見的方塊型頁籤(作用中=深藍底白字)
function Tabs({ tab, setTab }) {
  return (
    <div role="tablist" aria-label="工作流階段" className="flex flex-wrap gap-1 border-b-2 border-sky-900">
      {TABS.map((t, i) => {
        const active = tab === t.key;
        return (
          <button key={t.key} role="tab" aria-selected={active} id={`tab-${t.key}`} aria-controls={`panel-${t.key}`}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm rounded-t-sm border border-b-0 motion-safe:transition-colors ${focusRing} ${
              active ? "bg-sky-900 border-sky-900 text-white font-bold"
              : "bg-slate-100 border-slate-300 text-slate-700 hover:bg-sky-50 hover:text-sky-900"}`}>
            <span className={`${num} mr-1.5 ${active ? "text-sky-300" : "text-slate-400"}`}>{i + 1}.</span>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function Footer() {
  return (
    <footer className="bg-slate-800 text-slate-300 mt-12">
      <div className="max-w-5xl mx-auto px-4 py-8 grid gap-6 sm:grid-cols-3 text-sm">
        <div>
          <div className="text-white font-bold mb-2">智貸先鋒 企業授信情資服務網</div>
          <p className="text-xs leading-relaxed text-slate-400">
            主辦單位:精誠 SEI 競賽第 X 組<br />
            技術架構:Multi-Agent · GraphRAG · LLM-as-a-Judge<br />
            本站為競賽展示系統,所有企業資料皆為模擬情境。
          </p>
        </div>
        <div>
          <div className="text-white font-bold mb-2">介接資料來源</div>
          <ul className="text-xs space-y-1 text-slate-400">
            {["TWSE 公開資訊觀測站", "經濟部商工登記(data.gov.tw)", "司法院裁判書開放 API", "環境部裁罰紀錄/勞動部違規名單"].map((t) => (
              <li key={t}>
                <a href="#" onClick={(e) => e.preventDefault()} className={`hover:text-white hover:underline underline-offset-2 rounded-sm ${focusRing}`}>{t}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="text-white font-bold mb-2">網站資訊</div>
          <ul className="text-xs space-y-1 text-slate-400">
            {["隱私權及資訊安全政策", "政府資料開放授權條款", "網站導覽"].map((t) => (
              <li key={t}>
                <a href="#" onClick={(e) => e.preventDefault()} className={`hover:text-white hover:underline underline-offset-2 rounded-sm ${focusRing}`}>{t}</a>
              </li>
            ))}
          </ul>
          <span className="inline-block mt-3 px-2 py-1 border border-slate-500 rounded-sm text-xs text-slate-300">
            通過 AA 無障礙規範(示意)
          </span>
        </div>
      </div>
      <div className="border-t border-slate-700">
        <div className="max-w-5xl mx-auto px-4 py-3 text-xs text-slate-500 flex justify-between flex-wrap gap-2">
          <span>建議使用 Chrome、Edge、Firefox、Safari 瀏覽器</span>
          <span>© 2026 Credit-Lens Team. All Rights Reserved.</span>
        </div>
      </div>
    </footer>
  );
}

// ============================================================
// 頁面 1:案件總覽(政府網站的列表風格)
// ============================================================
function Dashboard({ openCase, query }) {
  const list = CASES.filter((c) => !query.trim() || c.name.includes(query.trim()) || c.id.includes(query.trim()));
  return (
    <main id="main" className="max-w-5xl mx-auto px-4 py-6 w-full">
      <Breadcrumb trail={[{ label: "首頁" }, { label: "案件總覽" }]} />
      <div className="mt-4">
        <SectionTitle action={
          <button className={`px-4 py-2 text-sm font-bold text-white bg-sky-900 hover:bg-sky-800 rounded-sm motion-safe:transition-colors ${focusRing}`}>
            + 新增授信案件
          </button>
        }>
          進行中案件{query.trim() && <span className="text-sm font-normal text-slate-500">(搜尋:「{query.trim()}」,共 {list.length} 件)</span>}
        </SectionTitle>

        {list.length === 0 ? (
          <div className="border border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            查無符合的案件,請調整搜尋條件。
          </div>
        ) : (
          <ul className="border-t-2 border-sky-900">
            {list.map((c) => (
              <li key={c.id} className="border-b border-slate-300">
                <button onClick={() => openCase(c)}
                  className={`w-full text-left bg-white hover:bg-sky-50 px-4 py-3.5 flex items-center gap-4 flex-wrap motion-safe:transition-colors group ${focusRing}`}>
                  <span className={`${num} text-xs text-slate-500 w-24 shrink-0`}>{c.updated}</span>
                  <span className="text-xs px-1.5 py-0.5 border border-sky-300 bg-sky-50 text-sky-900 rounded-sm shrink-0">{c.industry}</span>
                  <span className="flex-1 min-w-48">
                    <span className="text-slate-900 font-medium group-hover:text-sky-900 group-hover:underline underline-offset-2">{c.name}</span>
                    <span className={`block text-xs text-slate-500 mt-0.5 ${num}`}>統一編號 {c.id}</span>
                  </span>
                  <span className="text-xs text-slate-600 w-24">目前階段:<span className="font-medium text-slate-800">{STAGE_LABEL[c.stage]}</span></span>
                  <span className="w-16 text-right">
                    {c.score !== null ? <Score value={c.score} size="text-lg" /> : <span className="text-xs text-slate-400">評分中</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <SectionTitle>最新公告</SectionTitle>
        <ul className="border-t-2 border-sky-900">
          {[
            ["115-07-16", "系統更新", "AI 審查委員會新增「交叉質詢」逐字揭露功能。"],
            ["115-07-14", "資料介接", "已完成司法院裁判書開放 API 之訴訟風險訊號介接。"],
            ["115-07-10", "功能上線", "拜訪中「即時提詞卡」行動版正式提供試用。"],
          ].map(([d, tag, t], i) => (
            <li key={i} className="border-b border-slate-300 bg-white px-4 py-3 flex items-center gap-3 text-sm flex-wrap">
              <span className={`${num} text-xs text-slate-500 w-24 shrink-0`}>{d}</span>
              <span className="text-xs px-1.5 py-0.5 border border-amber-400 bg-amber-50 text-amber-800 rounded-sm shrink-0">{tag}</span>
              <a href="#" onClick={(e) => e.preventDefault()}
                className={`text-slate-800 hover:text-sky-900 hover:underline underline-offset-2 rounded-sm ${focusRing}`}>{t}</a>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

// ============================================================
// 頁籤 1:AI 審查會議
// ============================================================
function AgentCard({ k, thinking, children }) {
  const a = AGENT[k];
  return (
    <div className={`bg-white border border-slate-300 border-l-4 ${a.edge} p-4 motion-safe:animate-[fadeUp_.4s_ease-out]`}>
      <div className={`font-bold text-sm mb-2.5 ${a.text}`}>{a.name} Agent</div>
      {thinking ? <div className="text-sm text-slate-500">分析中<Dots /></div> : children}
    </div>
  );
}

function CommitteeTab() {
  const [phase, setPhase] = useState("idle");
  const [r, setR] = useState({});
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [phase]);

  async function run() {
    setR({}); setPhase("finance");
    await sleep(1800); setR((x) => ({ ...x, finance: MOCK.finance })); setPhase("tech");   // [API] /api/review/finance
    await sleep(1800); setR((x) => ({ ...x, tech: MOCK.tech })); setPhase("judge");        // [API] /api/review/tech
    await sleep(2000); setR((x) => ({ ...x, judge: MOCK.judge })); setPhase("done");       // [API] /api/review/judge
  }
  const busy = phase !== "idle" && phase !== "done";

  return (
    <div className="space-y-3">
      <div className="bg-sky-50 border border-sky-200 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-slate-700">由財務、技術兩位分析 Agent 發言,風險審查官交叉質詢後裁決基準分。</p>
        <button onClick={run} disabled={busy}
          className={`px-4 py-2 text-sm font-bold text-white bg-sky-900 hover:bg-sky-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-sm motion-safe:transition-colors ${focusRing}`}>
          {busy ? "審查進行中…" : phase === "done" ? "重新召開會議" : "召開審查會議"}
        </button>
      </div>

      {phase === "idle" && (
        <div className="bg-white border border-dashed border-slate-400 py-12 text-center text-sm text-slate-500">
          尚未召開審查會議。
        </div>
      )}

      {(phase === "finance" || r.finance) && (
        <AgentCard k="finance" thinking={phase === "finance" && !r.finance}>
          {r.finance && <>
            <div className="text-right -mt-7 mb-1"><Score value={r.finance.score} size="text-xl" color="text-amber-800" /></div>
            {r.finance.findings.map((f, i) => (
              <div key={i} className="mb-2 text-sm leading-relaxed text-slate-800">{f.text}<br /><Cite text={f.cite} /></div>
            ))}
          </>}
        </AgentCard>
      )}
      {(phase === "tech" || r.tech) && (
        <AgentCard k="tech" thinking={phase === "tech" && !r.tech}>
          {r.tech && <>
            <div className="text-right -mt-7 mb-1"><Score value={r.tech.score} size="text-xl" color="text-sky-800" /></div>
            {r.tech.findings.map((f, i) => (
              <div key={i} className="mb-2 text-sm leading-relaxed text-slate-800">{f.text}<br /><Cite text={f.cite} /></div>
            ))}
          </>}
        </AgentCard>
      )}
      {(phase === "judge" || r.judge) && (
        <AgentCard k="judge" thinking={phase === "judge" && !r.judge}>
          {r.judge && <>
            <div className="text-sm text-slate-600 mb-2.5">交叉質詢完成,發現 {r.judge.contradictions.length} 項矛盾:</div>
            {r.judge.contradictions.map((c, i) => (
              <div key={i} className="mb-2 border border-rose-300 bg-rose-50 p-3">
                <div className="text-rose-800 font-bold text-sm mb-1">【矛盾 {i + 1}】{c.title}</div>
                <div className="text-sm text-slate-800 leading-relaxed">{c.detail}</div>
              </div>
            ))}
            <div className="mt-3 text-sm leading-relaxed text-slate-900 bg-slate-50 border border-slate-200 p-3">
              <span className="font-bold text-rose-800">裁決:</span>{r.judge.verdict}
            </div>
          </>}
        </AgentCard>
      )}
      {phase === "done" && r.judge && (
        <div className="bg-white border border-slate-300 border-t-4 border-t-sky-900 p-4 motion-safe:animate-[fadeUp_.4s_ease-out]">
          <h3 className="font-bold text-slate-900 mb-3">拜訪前基準評分</h3>
          <Waterfall items={r.judge.waterfall} finalScore={r.judge.finalScore} />
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

// ============================================================
// 頁籤 2:拜訪前情資
// ============================================================
function PreTab() {
  const [sel, setSel] = useState("finance");
  const d = MOCK.radar.find((x) => x.key === sel);
  const weakest = [...MOCK.radar].sort((a, b) => a.score - b.score)[0];
  const data = MOCK.radar.map((x) => ({ subject: x.label, 該企業: x.score, 產業基準: x.benchmark }));

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-300 p-3">
          <h3 className="text-sm font-bold text-slate-900 border-l-4 border-sky-800 pl-2 mb-1">護城河雷達圖</h3>
          <ResponsiveContainer width="100%" height={290}>
            <RadarChart data={data} outerRadius="70%">
              <PolarGrid stroke="#cbd5e1" />
              <PolarAngleAxis dataKey="subject" tick={({ payload, x, y, textAnchor }) => {
                const dim = MOCK.radar.find((z) => z.label === payload.value);
                const on = dim.key === sel;
                return (
                  <text x={x} y={y} textAnchor={textAnchor} fill={on ? "#0c4a6e" : "#475569"}
                    fontSize={12} fontWeight={on ? 700 : 400} style={{ cursor: "pointer" }}
                    onClick={() => setSel(dim.key)}>
                    {payload.value} {dim.score}
                  </text>);
              }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} />
              <Radar name="產業基準" dataKey="產業基準" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.12} strokeDasharray="4 4" />
              <Radar name="該企業" dataKey="該企業" stroke="#0c4a6e" fill="#0369a1" fillOpacity={0.22} strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
          <p className="text-xs text-slate-500 text-center">點選維度名稱可查看評分理由與資料來源</p>
        </div>

        <div className="space-y-3">
          <div className="bg-white border border-slate-300 border-t-4 border-t-sky-900 p-4">
            <div className="flex items-baseline justify-between mb-1.5 gap-2">
              <h3 className="font-bold text-slate-900">{d.label}</h3>
              <Score value={d.score} size="text-xl" />
            </div>
            <div className="flex items-center gap-2 text-xs mb-2.5 flex-wrap">
              <span className={`px-1.5 py-0.5 border rounded-sm ${AGENT[d.agent].chip}`}>評分:{AGENT[d.agent].name} Agent</span>
              <span className={`text-slate-500 ${num}`}>產業基準 {d.benchmark} 分({d.score >= d.benchmark ? "高於" : "低於"}基準 {Math.abs(d.score - d.benchmark)} 分)</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-800 mb-1.5">{d.reason}</p>
            {d.cites.map((c, i) => <Cite key={i} text={c} />)}
          </div>
          <div className="bg-amber-50 border border-amber-300 border-l-4 border-l-amber-500 p-4 text-sm leading-relaxed">
            <div className="font-bold text-amber-900 mb-1">本次拜訪建議聚焦</div>
            <p className="text-slate-800">
              最弱維度為「{weakest.label}」({weakest.score} 分,低於產業基準 {weakest.benchmark - weakest.score} 分),
              下方防禦提問單已優先針對此維度生成追問。
            </p>
          </div>
        </div>
      </div>

      <div>
        <SectionTitle>護城河防禦提問單</SectionTitle>
        <ol className="border-t-2 border-sky-900">
          {MOCK.questions.map((q) => (
            <li key={q.id} className="bg-white border-b border-slate-300 px-4 py-3 hover:bg-sky-50 motion-safe:transition-colors">
              <div className="flex gap-3">
                <span className={`${num} text-sky-900 font-bold text-sm shrink-0 w-8`}>Q{q.id}.</span>
                <div className="min-w-0">
                  <p className="text-sm text-slate-900 font-medium leading-relaxed">{q.q}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    <span className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded-sm mr-1">AI 出題依據</span>
                    {q.why}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ============================================================
// 頁籤 3:拜訪中提詞
// ============================================================
function assess(answer) {
  if (/(已簽|簽約|核貸|承諾函|保證)/.test(answer))
    return { verdict: "resolved", reason: "客戶提出具法律效力之資金承諾,量級相符,風險點視為化解。", follow: "建議索取文件副本附入審查報告。" };
  if (/(意向|洽談|規劃|預計|評估|募資|B輪|b輪)/.test(answer))
    return { verdict: "partial", reason: "提出資金方向但屬意向性質、未具約束力,時程未完全對上。", follow: "追問:意向書是否具法律約束力?交割時點?募資延遲的備援方案?" };
  return { verdict: "unresolved", reason: "回答未提出具體來源或時程,風險點未化解。", follow: "追問:請以數字說明缺口金額、資金來源、到位時間三項。" };
}

function MidTab() {
  const [qs, setQs] = useState(MOCK.questions.map((q) => ({ ...q, status: q.id === 1 ? "active" : "pending" })));
  const [activeId, setActiveId] = useState(1);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [rec, setRec] = useState(false);
  const timer = useRef(null);
  const active = qs.find((q) => q.id === activeId);
  const done = qs.filter((q) => q.status === "resolved").length;

  function toggleRec() {
    if (rec) { clearInterval(timer.current); setRec(false); return; }
    const demo = "我們已取得兩家創投的B輪投資意向書,預計第四季完成募資,金額約八億。";
    let i = 0; setInput(""); setRec(true);
    timer.current = setInterval(() => {
      i += 3; setInput(demo.slice(0, i));
      if (i >= demo.length) { clearInterval(timer.current); setRec(false); }
    }, 80);
  }
  async function submit() {
    if (!input.trim() || busy) return;
    setBusy(true); setRes(null);
    await sleep(1400);                                   // [API] /api/interview/assess
    const r = assess(input);
    setRes(r);
    setQs((x) => x.map((q) => (q.id === activeId ? { ...q, status: r.verdict } : q)));
    setBusy(false);
  }

  return (
    <div className="grid lg:grid-cols-5 gap-4">
      {/* 左:風險點清單(政府列表風) */}
      <div className="lg:col-span-2">
        <h3 className="text-sm font-bold text-slate-900 border-l-4 border-sky-800 pl-2 mb-2">
          風險點清單(已化解 <span className={num}>{done}/{qs.length}</span>)
        </h3>
        <ul className="border-t-2 border-sky-900">
          {qs.map((q) => {
            const on = q.id === activeId;
            const v = VERDICT[q.status];
            return (
              <li key={q.id} className="border-b border-slate-300">
                <button onClick={() => { setActiveId(q.id); setInput(""); setRes(null); }} aria-current={on ? "true" : undefined}
                  className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 motion-safe:transition-colors ${focusRing} ${
                    on ? "bg-sky-900 text-white" : "bg-white hover:bg-sky-50 text-slate-800"}`}>
                  <span className={`${num} font-bold shrink-0`}>Q{q.id}</span>
                  <span className="flex-1 min-w-0 truncate">{q.dim}</span>
                  {v ? <span className={`text-xs px-1.5 py-0.5 border rounded-sm shrink-0 ${on ? "bg-white" : ""} ${v.cls}`}>{v.label}</span>
                    : <span className={`text-xs shrink-0 ${on ? "text-sky-200" : "text-slate-400"}`}>{on ? "進行中" : "待提問"}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-slate-500 mt-2 leading-relaxed">
          行動版介面同步提供;面談時輸入客戶回答,AI 即時判定風險是否化解。
        </p>
      </div>

      {/* 右:提問與判定 */}
      <div className="lg:col-span-3 space-y-3">
        <div className="bg-white border border-slate-300 border-l-4 border-l-sky-600 p-4">
          <div className={`text-xs text-sky-900 font-bold mb-1 ${num}`}>問題 {active.id}/{qs.length} · {active.dim}</div>
          <p className="text-sm text-slate-900 leading-relaxed font-medium">{active.q}</p>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">AI 出題依據:{active.why}</p>
        </div>

        <div className="bg-white border border-slate-300 p-4">
          <div className="text-xs text-slate-600 mb-1.5 flex items-center justify-between">
            <label htmlFor="ans" className="font-bold">客戶回答(輸入或口述)</label>
            {rec && <span className="text-rose-700 motion-safe:animate-pulse">● 語音轉文字中…</span>}
          </div>
          <textarea id="ans" value={input} onChange={(e) => setInput(e.target.value)} rows={3}
            placeholder="請輸入客戶的回答,或按「語音輸入」口述…" spellCheck={false}
            className={`w-full border border-slate-300 p-2.5 text-sm text-slate-800 resize-none placeholder-slate-400 rounded-sm focus:border-sky-700 ${focusRing}`} />
          <div className="flex gap-2 mt-2">
            <button onClick={toggleRec}
              className={`px-4 h-10 text-sm font-bold rounded-sm border motion-safe:transition-colors ${focusRing} ${
                rec ? "bg-rose-700 border-rose-700 text-white" : "bg-white border-slate-400 text-slate-700 hover:bg-slate-100"}`}>
              {rec ? "停止" : "語音輸入"}
            </button>
            <button onClick={submit} disabled={busy || !input.trim()}
              className={`flex-1 h-10 text-sm font-bold text-white bg-sky-900 hover:bg-sky-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-sm motion-safe:transition-colors ${focusRing}`}>
              {busy ? "AI 判定中…" : "送出判定"}
            </button>
          </div>
        </div>

        {busy && <div className="bg-white border border-slate-300 p-3.5 text-sm text-slate-500" aria-live="polite">風險審查官比對回答與風險點中<Dots /></div>}
        {res && (
          <div aria-live="polite" className={`border border-l-4 p-4 motion-safe:animate-[fadeUp_.35s_ease-out] ${VERDICT[res.verdict].cls} ${
            res.verdict === "resolved" ? "border-l-emerald-600" : res.verdict === "partial" ? "border-l-amber-500" : "border-l-rose-600"}`}>
            <div className="font-bold text-sm mb-1.5">判定結果:{VERDICT[res.verdict].label}</div>
            <p className="text-sm text-slate-800 leading-relaxed mb-2">{res.reason}</p>
            <div className="bg-white border border-slate-300 p-2.5 text-sm leading-relaxed">
              <span className="font-bold text-sky-900">建議追問:</span>
              <span className="text-slate-800"> {res.follow}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// 頁籤 4:拜訪後評分
// ============================================================
const SAMPLE_NOTES = `7/16 下午拜訪,出席:財務長林OO、技術長張OO。
資金缺口:已取得兩家創投B輪意向書約8億,預計Q4交割,尚未簽署具約束力文件。
良率:試產線63%,損益兩平需75%,預計明年Q2達標,已與設備商簽改善合約。
客戶集中:承認最大客戶即專利主要引用方,合約2027到期,續約洽談中、第三家客戶送樣。
新資訊:廠房二期已動工,將再投入12億(原財報未揭露)。
承諾8/15前提供:意向書副本、良率改善合約。`;

function PostTab() {
  const [notes, setNotes] = useState(SAMPLE_NOTES);
  const [stage, setStage] = useState("idle");
  const [ext, setExt] = useState(null);
  const [sc, setSc] = useState(null);

  async function run() {
    setExt(null); setSc(null); setStage("extracting");
    await sleep(1700); setExt(MOCK.postExtract); setStage("extracted");   // [API] /api/postvisit/extract
    await sleep(1100); setStage("scoring");
    await sleep(1500); setSc(MOCK.postScore); setStage("done");           // [API] /api/postvisit/score
  }
  const busy = stage === "extracting" || stage === "scoring";

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-300 p-4">
        <label htmlFor="notes" className="block text-sm font-bold text-slate-900 mb-2">
          會議紀錄<span className="ml-2 text-xs font-normal text-slate-500">貼上自由格式紀錄,AI 自動結構化萃取</span>
        </label>
        <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={7} spellCheck={false}
          className={`w-full border border-slate-300 p-3 text-sm leading-relaxed text-slate-800 resize-none rounded-sm bg-slate-50 focus:bg-white focus:border-sky-700 ${focusRing}`} />
        <button onClick={run} disabled={busy || !notes.trim()}
          className={`mt-2.5 px-6 h-10 text-sm font-bold text-white bg-sky-900 hover:bg-sky-800 disabled:bg-slate-300 disabled:text-slate-500 rounded-sm motion-safe:transition-colors ${focusRing}`}>
          {busy ? "分析中…" : "開始分析"}
        </button>
      </div>

      {stage === "extracting" && (
        <div className="bg-white border border-slate-300 p-4 text-sm text-slate-500" aria-live="polite">
          結構化萃取中:承諾事項/風險回應/新發現風險<Dots />
        </div>
      )}
      {ext && (
        <div className="bg-white border border-slate-300 border-t-4 border-t-sky-900 p-4 space-y-4 motion-safe:animate-[fadeUp_.4s_ease-out]">
          <h3 className="font-bold text-slate-900">結構化萃取結果</h3>

          <div>
            <div className="text-xs font-bold text-slate-700 mb-1.5">一、承諾事項({ext.commitments.length} 項,自動列入追蹤)</div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs">
                  <th scope="col" className="border border-slate-300 px-2 py-1.5 text-left font-bold">承諾內容</th>
                  <th scope="col" className="border border-slate-300 px-2 py-1.5 text-left font-bold w-28">承諾人</th>
                  <th scope="col" className="border border-slate-300 px-2 py-1.5 text-left font-bold w-28">期限</th>
                </tr>
              </thead>
              <tbody>
                {ext.commitments.map((c, i) => (
                  <tr key={i} className="hover:bg-sky-50">
                    <td className="border border-slate-300 px-2 py-1.5 text-slate-800">{c.item}</td>
                    <td className="border border-slate-300 px-2 py-1.5 text-slate-600">{c.owner}</td>
                    <td className={`border border-slate-300 px-2 py-1.5 text-amber-800 ${num}`}>{c.due}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="text-xs font-bold text-slate-700 mb-1.5">二、風險點回應(對應防禦提問單)</div>
            {ext.responses.map((r, i) => (
              <div key={i} className="border border-slate-300 border-t-0 first:border-t px-3 py-2 flex items-center gap-3 flex-wrap hover:bg-sky-50">
                <span className="text-sm text-slate-900 font-medium w-44 shrink-0">{r.risk}</span>
                <span className="text-xs text-slate-600 flex-1 min-w-40">{r.summary}</span>
                <span className={`text-xs px-1.5 py-0.5 border rounded-sm shrink-0 ${VERDICT[r.verdict].cls}`}>{VERDICT[r.verdict].label}</span>
              </div>
            ))}
          </div>

          {ext.newRisks.length > 0 && (
            <div>
              <div className="text-xs font-bold text-rose-800 mb-1.5">三、面談中新發現的風險</div>
              {ext.newRisks.map((n, i) => (
                <div key={i} className="border border-rose-300 border-l-4 border-l-rose-600 bg-rose-50 p-3 text-sm text-slate-800 leading-relaxed">{n.text}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {stage === "scoring" && (
        <div className="bg-white border border-slate-300 p-4 text-sm text-slate-500" aria-live="polite">
          比對拜訪前基準,計算增減項<Dots />
        </div>
      )}
      {sc && (
        <div className="bg-white border border-slate-300 border-t-4 border-t-emerald-600 p-4 motion-safe:animate-[fadeUp_.4s_ease-out]">
          <h3 className="font-bold text-slate-900 mb-3">評分瀑布 — 每一分的來源</h3>
          <Waterfall items={sc.waterfall} finalScore={sc.final} />
          <div className="mt-4 bg-slate-50 border border-slate-300 p-3 text-sm leading-relaxed">
            <span className="font-bold text-sky-900">審查官建議:</span>
            <span className="text-slate-800"> {sc.rec}</span>
          </div>
          <button onClick={() => alert("Demo:呼叫 POST /api/report 產出 PDF")}
            className={`mt-3 px-6 h-11 text-sm font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-sm motion-safe:transition-colors ${focusRing}`}>
            產出授信審查報告(PDF)
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// 頁面 2:案件詳情
// ============================================================
function CasePage({ c, goHome }) {
  const [tab, setTab] = useState("committee");
  return (
    <main id="main" className="max-w-5xl mx-auto px-4 py-5 w-full">
      <Breadcrumb trail={[
        { label: "首頁", onClick: goHome },
        { label: "案件總覽", onClick: goHome },
        { label: c.name },
      ]} />
      <div className="mt-4 mb-4 pb-3 border-b border-slate-300 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{c.name}</h1>
          <p className={`text-sm text-slate-500 mt-1 ${num}`}>統一編號 {c.id} · {c.industry} · 最近更新 {c.updated}</p>
        </div>
        {c.score !== null && (
          <div className="text-right">
            <div className="text-xs text-slate-500">目前綜合評分</div>
            <Score value={c.score} size="text-3xl" />
          </div>
        )}
      </div>
      <Tabs tab={tab} setTab={setTab} />
      <div className="pt-4 pb-2" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "committee" && <CommitteeTab />}
        {tab === "pre" && <PreTab />}
        {tab === "mid" && <MidTab />}
        {tab === "post" && <PostTab />}
      </div>
    </main>
  );
}

// ============================================================
// App 根元件
// ============================================================
export default function CreditLensApp() {
  const [page, setPage] = useState("dashboard");
  const [current, setCurrent] = useState(null);
  const [query, setQuery] = useState("");
  const [nav, setNav] = useState("案件總覽");
  const [fontScale, setFontScale] = useState("m");
  const goHome = () => { setPage("dashboard"); setCurrent(null); setNav("案件總覽"); };
  const fontSize = { s: "15px", m: "16px", l: "17.5px" }[fontScale];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col"
      style={{ fontFamily: "'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif", fontSize, colorScheme: "light" }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion: reduce){ *{animation:none!important;transition:none!important} }
        button{touch-action:manipulation}
      `}</style>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-3 focus:py-2 focus:bg-sky-900 focus:text-white focus:rounded-sm">
        跳至主要內容
      </a>
      <UtilityBar fontScale={fontScale} setFontScale={setFontScale} />
      <Header nav={nav} onNav={(t) => { setNav(t); if (t === "案件總覽") goHome(); }} />
      {page === "dashboard" && <Hero query={query} setQuery={setQuery} />}
      <div className="flex-1">
        {page === "dashboard"
          ? <Dashboard query={query} openCase={(c) => { setCurrent(c); setPage("case"); }} />
          : <CasePage c={current} goHome={goHome} />}
      </div>
      <Footer />
    </div>
  );
}
