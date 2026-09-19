import { useMemo, useState } from "react";
import "./styles.css";
import { useStore } from "./store";
import type { CheckItem, Defect, Occupation } from "./types";
import {
  computeMetrics,
  effectiveDeadline,
  evaluateGate,
  formatTs,
  isOverdue,
  LEVELS,
  todayStr,
} from "./domain";

type Toast = { msg: string; kind: "ok" | "err" } | null;
type Notify = (msg: string, kind?: "ok" | "err") => void;

/* =============================== 小部件 =============================== */

function LevelBadge({ level }: { level: Defect["level"] }) {
  return (
    <span className={`badge level-${level}`} title="缺陷等级">
      {level}缺陷
    </span>
  );
}

function ToastBar({ toast }: { toast: Toast }) {
  if (!toast) return null;
  return <div className={`toast toast-${toast.kind}`}>{toast.msg}</div>;
}

/* ======================= ATA 检查项卡片（含缺陷闭环） ======================= */

function ExtensionsTimeline({ defect }: { defect: Defect }) {
  if (defect.extensions.length === 0) return null;
  return (
    <div className="ext-chain">
      <p className="mini-title">延期依据（{defect.extensions.length}）</p>
      {defect.extensions.map((e, i) => (
        <div className="ext-item" key={e.id}>
          <span className="ext-index">第{i + 1}次延期</span>
          <p>{e.reason}</p>
          <small>
            延至 {e.nextDeadline} · 登记于 {formatTs(e.at)}
          </small>
        </div>
      ))}
    </div>
  );
}

function DefectRow({
  defect,
  item,
  today,
  store,
  notify,
}: {
  defect: Defect;
  item: CheckItem;
  today: string;
  store: ReturnType<typeof useStore>;
  notify: Notify;
}) {
  const [mode, setMode] = useState<"none" | "extend" | "close">("none");
  const [reason, setReason] = useState("");
  const [nextDeadline, setNextDeadline] = useState("");
  const [note, setNote] = useState("");

  const overdue = isOverdue(defect, today);
  const deadline = effectiveDeadline(defect);

  const submitExtend = () => {
    if (!reason.trim()) return notify("必须填写延期依据", "err");
    if (!nextDeadline) return notify("必须选择延期后的整改期限", "err");
    if (nextDeadline <= today)
      return notify("延期后的整改期限必须晚于今天", "err");
    store.addExtension(defect.id, reason.trim(), nextDeadline);
    notify("延期依据已登记");
    setReason("");
    setNextDeadline("");
    setMode("none");
  };

  const submitClose = () => {
    if (!note.trim()) return notify("必须填写关闭说明（整改结果）", "err");
    store.closeDefect(defect.id, note.trim());
    notify("缺陷已关闭");
    setNote("");
    setMode("none");
  };

  return (
    <div className={`defect-row ${defect.status === "closed" ? "closed" : ""}`}>
      <div className="defect-head">
        <LevelBadge level={defect.level} />
        <span
          className={`badge ${defect.status === "closed" ? "st-closed" : overdue ? "st-overdue" : "st-open"}`}
        >
          {defect.status === "closed" ? "已关闭" : overdue ? "逾期未关闭" : "未关闭"}
        </span>
        <span className="defect-engineer">责任工程师：{defect.engineer}</span>
      </div>
      <p className="defect-desc">{defect.description}</p>
      <div className="defect-meta">
        <span>
          整改期限：<strong>{deadline}</strong>
          {defect.extensions.length > 0 && (
            <em>（原期限 {defect.deadline}，已延期 {defect.extensions.length} 次）</em>
          )}
        </span>
        {overdue && (
          <span className="overdue-tip">已逾期：签署放行前必须补填延期依据</span>
        )}
      </div>

      {defect.status === "open" && mode === "none" && (
        <div className="defect-actions">
          <button onClick={() => setMode("extend")}>填写延期依据</button>
          <button className="primary-action" onClick={() => setMode("close")}>
            整改完成，关闭缺陷
          </button>
        </div>
      )}

      {defect.status === "open" && mode === "extend" && (
        <div className="inline-form">
          <label>
            <span>延期依据（必填）</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="如：备件调拨中 / 已挂 MEL 保留 / 厂家答复等待中…"
              rows={2}
            />
          </label>
          <label className="date-cell">
            <span>延期后整改期限（必填）</span>
            <input
              type="date"
              value={nextDeadline}
              min={today}
              onChange={(e) => setNextDeadline(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button onClick={() => setMode("none")}>取消</button>
            <button className="primary-action" onClick={submitExtend}>
              登记延期
            </button>
          </div>
        </div>
      )}

      {defect.status === "open" && mode === "close" && (
        <div className="inline-form">
          <label>
            <span>关闭说明 / 整改结果（必填）</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="描述实际完成的整改工作与复核结果"
              rows={2}
            />
          </label>
          <div className="form-actions">
            <button onClick={() => setMode("none")}>取消</button>
            <button className="primary-action" onClick={submitClose}>
              确认关闭
            </button>
          </div>
        </div>
      )}

      {defect.status === "closed" && (
        <p className="close-note">
          关闭说明：{defect.closeNote}（{defect.closedAt ? formatTs(defect.closedAt) : ""}）
        </p>
      )}

      <ExtensionsTimeline defect={defect} />
      <small className="belong">归属检查项：{item.ata} · {item.title}</small>
    </div>
  );
}

function ItemCard({
  item,
  defects,
  today,
  store,
  notify,
}: {
  item: CheckItem;
  defects: Defect[];
  today: string;
  store: ReturnType<typeof useStore>;
  notify: Notify;
}) {
  const [open, setOpen] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<Defect["level"]>("一般");
  const [deadline, setDeadline] = useState("");
  const [engineer, setEngineer] = useState(item.engineer);

  const openDefects = defects.filter((d) => d.status === "open");
  const overdueCount = defects.filter((d) => isOverdue(d, today)).length;

  const submitDefect = () => {
    if (!description.trim()) return notify("请填写缺陷描述", "err");
    if (!deadline) return notify("请选择整改期限", "err");
    if (!engineer.trim()) return notify("请填写责任工程师", "err");
    store.addDefect({
      itemId: item.id,
      description: description.trim(),
      level,
      deadline,
      engineer: engineer.trim(),
    });
    notify("缺陷已登记到该 ATA 检查项");
    setDescription("");
    setDeadline("");
    setLevel("一般");
    setShowAdd(false);
  };

  return (
    <article className={`item-card ${openDefects.length ? "has-open" : ""}`}>
      <header className="item-head" onClick={() => setOpen((v) => !v)}>
        <div>
          <div className="item-title-line">
            <span className="ata-chip">{item.ata}</span>
            <h3>{item.title}</h3>
          </div>
          <p className="item-sub">
            检查区域：{item.area} · 责任工程师：{item.engineer}
          </p>
        </div>
        <div className="item-stats">
          <span className={overdueCount ? "stat-danger" : ""}>
            逾期 {overdueCount}
          </span>
          <span>未关闭 {openDefects.length}</span>
          <span>共 {defects.length}</span>
          <button
            className="collapse-btn"
            aria-label="折叠"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            {open ? "收起" : "展开"}
          </button>
        </div>
      </header>

      {open && (
        <div className="item-body">
          {defects.length === 0 && (
            <p className="empty-line">该检查项目前无缺陷记录。</p>
          )}
          <div className="defect-list">
            {defects.map((d) => (
              <DefectRow
                key={d.id}
                defect={d}
                item={item}
                today={today}
                store={store}
                notify={notify}
              />
            ))}
          </div>

          {!showAdd ? (
            <button className="ghost-btn" onClick={() => setShowAdd(true)}>
              + 为该检查项登记缺陷
            </button>
          ) : (
            <div className="inline-form add-defect-form">
              <p className="mini-title">登记缺陷（等级 / 整改期限 / 责任工程师）</p>
              <label className="full">
                <span>缺陷描述</span>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="描述检查中发现的缺陷"
                />
              </label>
              <label>
                <span>缺陷等级</span>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as Defect["level"])}
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>整改期限</span>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
              </label>
              <label className="full">
                <span>责任工程师</span>
                <input
                  value={engineer}
                  onChange={(e) => setEngineer(e.target.value)}
                />
              </label>
              <div className="form-actions full">
                <button onClick={() => setShowAdd(false)}>取消</button>
                <button className="primary-action" onClick={submitDefect}>
                  登记缺陷
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

/* =============================== 放行签署 =============================== */

function SignPanel({
  store,
  today,
  notify,
}: {
  store: ReturnType<typeof useStore>;
  today: string;
  notify: Notify;
}) {
  const { state } = store;
  const gate = useMemo(
    () => evaluateGate(state.defects, today),
    [state.defects, today]
  );
  const itemMap = useMemo(
    () => new Map(state.items.map((i) => [i.id, i])),
    [state.items]
  );
  const [signer, setSigner] = useState("");
  const [reason, setReason] = useState("");
  const isResign = state.versions.length > 0;

  const submit = () => {
    if (!signer.trim()) return notify("请填写放行签署人", "err");
    if (isResign && !reason.trim())
      return notify("重新签署必须填写本次新版本的原因", "err");
    store.signRelease(signer.trim(), reason.trim());
    notify(isResign ? `已保留历史签署并生成 V${state.versions.length + 1}` : "已签署放行 V1");
    setReason("");
  };

  return (
    <section className="panel sign-panel">
      <div className="section-heading">
        <div>
          <p>放行签署</p>
          <h2>签署闸口与版本</h2>
        </div>
        <span
          className={`badge ${gate.canSign ? "st-closed" : "st-overdue"} big`}
        >
          {gate.canSign ? "满足签署条件" : "禁止放行签署"}
        </span>
      </div>

      {!gate.canSign && (
        <div className="gate-box">
          <p className="mini-title">
            未关闭缺陷 {gate.openDefects.length} 项，存在未关闭缺陷时不得签署放行：
          </p>
          <ul className="blocker-list">
            {gate.openDefects.map((d) => {
              const item = itemMap.get(d.itemId);
              const needExt = gate.overdueWithoutExtension.includes(d);
              return (
                <li key={d.id} className={needExt ? "need-ext" : ""}>
                  <div className="blocker-line">
                    <LevelBadge level={d.level} />
                    <span className="blocker-item">
                      {item ? `${item.ata} · ${item.title}` : "检查项已缺失"}
                    </span>
                  </div>
                  <p>{d.description}</p>
                  <small>
                    责任工程师：{d.engineer} · 整改期限：{effectiveDeadline(d)}
                  </small>
                  {needExt && (
                    <strong className="ext-required">
                      已逾期：必须先到该检查项下填写延期依据，或整改后关闭缺陷
                    </strong>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className={`sign-form ${gate.canSign ? "" : "disabled-mask"}`}>
        <label>
          <span>放行签署人</span>
          <input
            value={signer}
            onChange={(e) => setSigner(e.target.value)}
            placeholder="放行人员姓名 / 工号"
          />
        </label>
        <label>
          <span>
            {isResign
              ? "新版本原因（必填，原签署仅保留不可修改）"
              : "签署说明"}
          </span>
          {isResign ? (
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="如：ATA 27 作动器换件复查合格，关闭缺陷后重新签署"
            />
          ) : (
            <input value="初次放行：全部缺陷已关闭" disabled />
          )}
        </label>
        <button
          className="primary-action sign-btn"
          disabled={!gate.canSign}
          onClick={submit}
        >
          {isResign
            ? `保留 V${state.versions.length}，签署 V${state.versions.length + 1}`
            : "签署放行 V1"}
        </button>
        {!gate.canSign && <p className="form-hint">闸口未通过，签署按钮锁定</p>}
      </div>

      <div className="version-timeline">
        <p className="mini-title">签署版本（历史版本不可变，只保留原签署）</p>
        {state.versions.length === 0 && (
          <p className="empty-line">尚未产生任何放行签署。</p>
        )}
        {[...state.versions].reverse().map((v) => (
          <div key={v.version} className={`version-item ${v.first ? "first" : ""}`}>
            <div className="version-head">
              <strong>V{v.version}</strong>
              {v.first ? (
                <span className="badge st-closed">初次签署</span>
              ) : (
                <span className="badge st-revised">缺陷关闭后重新签署</span>
              )}
              <span className="immutable">原签署已锁定保留</span>
            </div>
            <p className="version-reason">原因：{v.reason}</p>
            <small>
              签署人：{v.signer} · 时间：{formatTs(v.at)} · 快照：检查项{" "}
              {v.itemCount} / 缺陷 {v.defectCount}
            </small>
          </div>
        ))}
        {isResign && gate.openDefects.length > 0 && (
          <p className="form-hint">
            上一版本放行后又登记了新缺陷；全部关闭后才能再次签署，并必须填写新版本原因。
          </p>
        )}
      </div>
    </section>
  );
}

/* =============================== 机位占用仲裁 =============================== */

function dtLabel(v: string): string {
  return v ? v.replace("T", " ") : "—";
}

function OccupationCard({
  occ,
  items,
  store,
  notify,
}: {
  occ: Occupation;
  items: CheckItem[];
  store: ReturnType<typeof useStore>;
  notify: Notify;
}) {
  const itemMap = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items]
  );
  const selfItem = occ.itemId ? itemMap.get(occ.itemId) : undefined;
  const conflictItem = occ.conflict?.itemId
    ? itemMap.get(occ.conflict.itemId)
    : undefined;

  return (
    <article className={`occ-card occ-${occ.status}`}>
      <div className="occ-head">
        <strong>{occ.vehicle}</strong>
        <span
          className={`badge ${
            occ.status === "confirmed"
              ? "st-closed"
              : occ.status === "rejected"
              ? "st-overdue"
              : "st-open"
          }`}
        >
          {occ.status === "confirmed"
            ? "已确认占用"
            : occ.status === "rejected"
            ? "冲突驳回"
            : "待确认"}
        </span>
      </div>
      <dl className="occ-grid">
        <div>
          <dt>机位</dt>
          <dd>{occ.bay}</dd>
        </div>
        <div>
          <dt>占用时段</dt>
          <dd>
            {dtLabel(occ.start)} ~ {dtLabel(occ.end)}
          </dd>
        </div>
        <div>
          <dt>关联检查项</dt>
          <dd>
            {selfItem ? `${selfItem.ata} · ${selfItem.title}` : "未关联"}
          </dd>
        </div>
      </dl>

      {occ.status === "pending" && (
        <button
          className="primary-action"
          onClick={() => {
            store.confirmOccupation(occ.id);
            notify("已提交确认，系统将按机位时段仲裁");
          }}
        >
          确认占用
        </button>
      )}
      {occ.status === "confirmed" && (
        <small className="confirmed-at">
          确认时间：{occ.confirmedAt ? new Date(occ.confirmedAt).toLocaleString() : "—"}
          ，后续重叠申请将被驳回
        </small>
      )}
      {occ.status === "rejected" && occ.conflict && (
        <div className="conflict-box">
          <p className="mini-title">
            与先确认的一条占用重叠，只保留先确认记录，本条驳回：
          </p>
          <ul>
            <li>冲突机位：{occ.conflict.bay}</li>
            <li>
              已确认时段：{dtLabel(occ.conflict.start)} ~{" "}
              {dtLabel(occ.conflict.end)}
            </li>
            <li>先确认车辆：{occ.conflict.vehicle}</li>
            <li>
              冲突检查项：
              {conflictItem
                ? `${conflictItem.ata} · ${conflictItem.title}`
                : occ.conflict.itemId
                ? `原检查项 ${occ.conflict.itemId} 已不存在`
                : "未关联检查项"}
            </li>
          </ul>
        </div>
      )}
    </article>
  );
}

function BayPanel({
  store,
  notify,
}: {
  store: ReturnType<typeof useStore>;
  notify: Notify;
}) {
  const { state } = store;
  const [vehicle, setVehicle] = useState("");
  const [bay, setBay] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [itemId, setItemId] = useState("");

  const submit = () => {
    if (!vehicle.trim()) return notify("请填写维修车辆编号", "err");
    if (!bay.trim()) return notify("请填写机位", "err");
    if (!start || !end) return notify("请选择占用时段", "err");
    if (end <= start) return notify("结束时间必须晚于开始时间", "err");
    store.submitOccupation({
      vehicle: vehicle.trim(),
      bay: bay.trim(),
      start,
      end,
      itemId: itemId || null,
    });
    notify("占用申请已提交，进入待确认列表");
    setVehicle("");
    setBay("");
    setStart("");
    setEnd("");
    setItemId("");
  };

  const pending = state.occupations.filter((o) => o.status === "pending");
  const confirmed = state.occupations.filter((o) => o.status === "confirmed");
  const rejected = state.occupations.filter((o) => o.status === "rejected");

  return (
    <section className="panel bay-panel">
      <div className="section-heading">
        <div>
          <p>机位调度</p>
          <h2>维修车辆机位占用</h2>
        </div>
      </div>

      <div className="inline-form bay-form">
        <label>
          <span>维修车辆</span>
          <input
            value={vehicle}
            onChange={(e) => setVehicle(e.target.value)}
            placeholder="如 高空车 A-07"
          />
        </label>
        <label>
          <span>机位</span>
          <input
            value={bay}
            onChange={(e) => setBay(e.target.value)}
            placeholder="如 B-203"
          />
        </label>
        <label>
          <span>开始时间</span>
          <input
            type="datetime-local"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          <span>结束时间</span>
          <input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label className="full">
          <span>关联检查项（用于指出冲突检查项）</span>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">不关联</option>
            {state.items.map((i) => (
              <option key={i.id} value={i.id}>
                {i.ata} · {i.title}（{i.engineer}）
              </option>
            ))}
          </select>
        </label>
        <div className="form-actions full">
          <button className="primary-action" onClick={submit}>
            提交占用申请
          </button>
        </div>
      </div>

      {pending.length > 0 && (
        <>
          <p className="mini-title group-title">待确认（{pending.length}）</p>
          <div className="occ-list">
            {pending.map((o) => (
              <OccupationCard
                key={o.id}
                occ={o}
                items={state.items}
                store={store}
                notify={notify}
              />
            ))}
          </div>
        </>
      )}

      <p className="mini-title group-title">已确认 · 先到先得（{confirmed.length}）</p>
      <div className="occ-list">
        {confirmed.length === 0 && (
          <p className="empty-line">暂无已确认的机位占用。</p>
        )}
        {confirmed.map((o) => (
          <OccupationCard
            key={o.id}
            occ={o}
            items={state.items}
            store={store}
            notify={notify}
          />
        ))}
      </div>

      {rejected.length > 0 && (
        <>
          <p className="mini-title group-title">冲突驳回记录（{rejected.length}）</p>
          <div className="occ-list">
            {rejected.map((o) => (
              <OccupationCard
                key={o.id}
                occ={o}
                items={state.items}
                store={store}
                notify={notify}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* =============================== 主应用 =============================== */

function App() {
  const store = useStore();
  const { state } = store;
  const today = todayStr();
  const metrics = useMemo(
    () => computeMetrics(state, today),
    [state, today]
  );
  const [toast, setToast] = useState<Toast>(null);
  const notify: Notify = (msg, kind = "ok") => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), 2600);
  };

  // 新增检查项的小表单
  const [newItem, setNewItem] = useState({
    ata: "",
    area: "",
    title: "",
    engineer: "",
  });
  const submitItem = () => {
    if (!newItem.ata.trim()) return notify("请填写 ATA 章节", "err");
    if (!newItem.title.trim()) return notify("请填写检查项目名称", "err");
    if (!newItem.engineer.trim()) return notify("请填写责任工程师", "err");
    store.addItem({
      ata: newItem.ata.trim(),
      area: newItem.area.trim() || "未分区",
      title: newItem.title.trim(),
      engineer: newItem.engineer.trim(),
    });
    notify("ATA 检查项已新增");
    setNewItem({ ata: "", area: "", title: "", engineer: "" });
  };

  const metricCards = [
    { label: "ATA 检查项", value: String(metrics.itemCount), cls: "status-ok" },
    { label: "未关闭缺陷", value: String(metrics.openCount), cls: "status-danger" },
    { label: "逾期缺陷", value: String(metrics.overdueCount), cls: "status-watch" },
    { label: "放行签署版本", value: String(metrics.versionCount), cls: "status-ok" },
  ];

  return (
    <main className="app-shell">
      <ToastBar toast={toast} />
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-07 · port 5107</p>
          <h1>航空维修检查清单 · 放行签署闭环</h1>
          <p className="subtitle">
            按 ATA 章节管理检查项与缺陷（等级 / 整改期限 / 责任工程师）：存在未关闭缺陷不得签署放行，
            逾期缺陷必须填写延期依据，缺陷关闭后再签仅保留原签署并生成带原因的新版本；
            维修车辆机位占用按“先确认先保留”仲裁。数据本地持久化，刷新后检查项、缺陷、签署版本与占用记录仍对应。
          </p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>React 19 + Vite + TypeScript + localStorage</strong>
          <span className="today-tag">业务日期：{today}</span>
        </div>
      </section>

      <section className="metrics-grid">
        {metricCards.map((m) => (
          <article className="metric-card" key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
            <i className={m.cls} />
          </article>
        ))}
      </section>

      <section className="workspace two-col">
        <div className="col-left">
          <section className="panel">
            <div className="section-heading">
              <div>
                <p>ATA 检查项</p>
                <h2>检查项与缺陷台账</h2>
              </div>
            </div>

            <div className="inline-form new-item-form">
              <p className="mini-title">新增 ATA 检查项</p>
              <div className="new-item-grid">
                <label>
                  <span>ATA 章节</span>
                  <input
                    placeholder="如 ATA 36"
                    value={newItem.ata}
                    onChange={(e) =>
                      setNewItem({ ...newItem, ata: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>检查区域</span>
                  <input
                    placeholder="如 引气系统"
                    value={newItem.area}
                    onChange={(e) =>
                      setNewItem({ ...newItem, area: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>检查项目</span>
                  <input
                    placeholder="检查项目名称"
                    value={newItem.title}
                    onChange={(e) =>
                      setNewItem({ ...newItem, title: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>责任工程师</span>
                  <input
                    placeholder="责任工程师"
                    value={newItem.engineer}
                    onChange={(e) =>
                      setNewItem({ ...newItem, engineer: e.target.value })
                    }
                  />
                </label>
              </div>
              <div className="form-actions">
                <button className="primary-action" onClick={submitItem}>
                  新增检查项
                </button>
              </div>
            </div>

            <div className="item-list">
              {state.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  today={today}
                  defects={state.defects.filter((d) => d.itemId === item.id)}
                  store={store}
                  notify={notify}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="col-right">
          <SignPanel store={store} today={today} notify={notify} />
          <BayPanel store={store} notify={notify} />
        </div>
      </section>

      <footer className="persist-bar">
        <span>
          ✓ 检查项、缺陷、延期依据、签署版本、机位占用（含驳回冲突快照）均已存入
          localStorage，刷新页面后按 ID 关联恢复
        </span>
        <button
          onClick={() => {
            if (window.confirm("确定清空当前台账并恢复演示数据？")) {
              store.resetAll();
              notify("已恢复演示数据");
            }
          }}
        >
          重置为演示数据
        </button>
      </footer>
    </main>
  );
}

export default App;
