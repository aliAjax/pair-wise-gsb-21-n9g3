import { useState } from "react";
import type { Action } from "../store";
import type { CheckItem, Defect, DefectLevel } from "../types";
import { formatDateTime, isOverdue, todayLocal } from "../domain";

const LEVELS: DefectLevel[] = ["一般", "重要", "MEL保留"];

const levelClass: Record<DefectLevel, string> = {
  一般: "badge-level-minor",
  重要: "badge-level-major",
  MEL保留: "badge-level-mel",
};

function DefectCard({
  item,
  defect,
  dispatch,
}: {
  item: CheckItem;
  defect: Defect;
  dispatch: React.Dispatch<Action>;
}) {
  const [extension, setExtension] = useState(defect.extensionReason ?? "");
  const overdue = isOverdue(defect);
  const hasBasis = (defect.extensionReason ?? "").trim().length > 0;

  return (
    <div className={`defect-card ${defect.status === "open" ? "defect-open" : "defect-closed"}`}>
      <div className="defect-head">
        <span className={`badge ${levelClass[defect.level]}`}>{defect.level}</span>
        <span className={`badge ${defect.status === "open" ? "badge-open" : "badge-closed"}`}>
          {defect.status === "open" ? "未关闭" : "已关闭"}
        </span>
        {overdue && (
          <span className={`badge ${hasBasis ? "badge-basis" : "badge-overdue"}`}>
            {hasBasis ? "逾期·已填延期依据" : "逾期·缺延期依据"}
          </span>
        )}
        <span className="defect-time">
          整改期限 {defect.deadline}
          {overdue && "（已逾期）"}
        </span>
      </div>

      <p className="defect-desc">{defect.description}</p>

      <dl className="defect-meta">
        <div>
          <dt>登记时间</dt>
          <dd>{formatDateTime(defect.createdAt)}</dd>
        </div>
        {defect.closedAt && (
          <div>
            <dt>关闭时间</dt>
            <dd>{formatDateTime(defect.closedAt)}</dd>
          </div>
        )}
        {defect.extensionUpdatedAt && (
          <div>
            <dt>延期依据更新</dt>
            <dd>{formatDateTime(defect.extensionUpdatedAt)}</dd>
          </div>
        )}
      </dl>

      {overdue && (
        <div className="extension-box">
          <label>
            <span>
              逾期缺陷 · 延期依据（MEL 批复 / 器材调拨单 / 质量部门批准文件，签署放行前必填）
            </span>
            <textarea
              value={extension}
              placeholder="例如：MEL 保留至下一定检，器材调拨单 WL-xxxx，质量经理批准"
              onChange={(e) => setExtension(e.target.value)}
              rows={2}
            />
          </label>
          <div className="extension-actions">
            <button
              className="primary-action small"
              disabled={!extension.trim() || extension === defect.extensionReason}
              onClick={() =>
                dispatch({
                  type: "set_extension",
                  itemId: item.id,
                  defectId: defect.id,
                  reason: extension,
                })
              }
            >
              保存延期依据
            </button>
            {hasBasis && <em className="hint">已登记，可继续流转</em>}
          </div>
          {defect.extensionReason && (
            <p className="basis-text">当前依据：{defect.extensionReason}</p>
          )}
        </div>
      )}

      <div className="defect-actions">
        {defect.status === "open" ? (
          <button
            className="primary-action small"
            onClick={() =>
              dispatch({ type: "close_defect", itemId: item.id, defectId: defect.id })
            }
          >
            确认关闭缺陷
          </button>
        ) : (
          <button
            className="small"
            onClick={() =>
              dispatch({ type: "reopen_defect", itemId: item.id, defectId: defect.id })
            }
          >
            重新打开（用于演示再签署）
          </button>
        )}
      </div>
    </div>
  );
}

function ItemCard({ item, dispatch }: { item: CheckItem; dispatch: React.Dispatch<Action> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [level, setLevel] = useState<DefectLevel>("一般");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(todayLocal());

  const submit = () => {
    if (!description.trim() || !deadline) return;
    dispatch({
      type: "add_defect",
      itemId: item.id,
      level,
      description,
      deadline,
    });
    setDescription("");
    setDeadline(todayLocal());
    setLevel("一般");
    setShowAdd(false);
  };

  return (
    <article className="item-card">
      <header className="item-head">
        <div>
          <span className="ata-tag">{item.ata}</span>
          <h3>{item.name}</h3>
          <p className="item-sub">
            {item.aircraft} · {item.area} · 责任工程师 <strong>{item.engineer}</strong>
          </p>
        </div>
        <div className="item-stat">
          <span>{item.defects.length}</span>
          <em>条缺陷记录</em>
        </div>
      </header>

      {item.defects.length === 0 ? (
        <p className="no-defect">本项检查正常，无缺陷记录。</p>
      ) : (
        <div className="defect-list">
          {item.defects.map((d) => (
            <DefectCard key={d.id} item={item} defect={d} dispatch={dispatch} />
          ))}
        </div>
      )}

      <div className="item-foot">
        {!showAdd && (
          <button className="small" onClick={() => setShowAdd(true)}>
            + 为本检查项登记缺陷
          </button>
        )}
        {showAdd && (
          <div className="inline-form">
            <div className="form-row">
              <label>
                <span>缺陷等级</span>
                <select value={level} onChange={(e) => setLevel(e.target.value as DefectLevel)}>
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
            </div>
            <label>
              <span>缺陷描述</span>
              <input
                placeholder="描述缺陷现象、位置与测量数据"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="form-actions">
              <button className="primary-action small" onClick={submit}>
                登记缺陷
              </button>
              <button className="small" onClick={() => setShowAdd(false)}>
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

export function CheckItemsPanel({
  items,
  dispatch,
}: {
  items: CheckItem[];
  dispatch: React.Dispatch<Action>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [aircraft, setAircraft] = useState("");
  const [ata, setAta] = useState("");
  const [area, setArea] = useState("");
  const [name, setName] = useState("");
  const [engineer, setEngineer] = useState("");
  const [withDefect, setWithDefect] = useState(false);
  const [level, setLevel] = useState<DefectLevel>("一般");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState(todayLocal());

  const resetForm = () => {
    setAircraft("");
    setAta("");
    setArea("");
    setName("");
    setEngineer("");
    setWithDefect(false);
    setDescription("");
    setDeadline(todayLocal());
    setLevel("一般");
  };

  const submit = () => {
    if (!aircraft.trim() || !ata.trim() || !area.trim() || !name.trim() || !engineer.trim()) return;
    if (withDefect && (!description.trim() || !deadline)) return;
    dispatch({
      type: "add_item",
      aircraft,
      ata,
      area,
      name,
      engineer,
      defect: withDefect ? { level, description, deadline } : undefined,
    });
    resetForm();
    setShowForm(false);
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>ATA 检查项 · 缺陷闭环</p>
          <h2>检查项与缺陷登记</h2>
        </div>
        <button className="primary-action" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "收起新增" : "+ 新增 ATA 检查项"}
        </button>
      </div>

      {showForm && (
        <div className="new-item-form">
          <div className="form-row">
            <label>
              <span>机型 / 机号 *</span>
              <input value={aircraft} onChange={(e) => setAircraft(e.target.value)} placeholder="B-1807 / A320" />
            </label>
            <label>
              <span>ATA 章节 *</span>
              <input value={ata} onChange={(e) => setAta(e.target.value)} placeholder="ATA 32" />
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>检查区域 *</span>
              <input value={area} onChange={(e) => setArea(e.target.value)} placeholder="起落架" />
            </label>
            <label>
              <span>责任工程师 *</span>
              <input value={engineer} onChange={(e) => setEngineer(e.target.value)} placeholder="姓名" />
            </label>
          </div>
          <label>
            <span>检查项目 *</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="主轮磨耗与刹车装置检查" />
          </label>

          <label className="check-line">
            <input type="checkbox" checked={withDefect} onChange={(e) => setWithDefect(e.target.checked)} />
            <span>同时登记一条缺陷（填写等级、整改期限）</span>
          </label>

          {withDefect && (
            <div className="defect-inline">
              <div className="form-row">
                <label>
                  <span>缺陷等级</span>
                  <select value={level} onChange={(e) => setLevel(e.target.value as DefectLevel)}>
                    {LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>整改期限</span>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
                </label>
              </div>
              <label>
                <span>缺陷描述</span>
                <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="描述缺陷现象" />
              </label>
            </div>
          )}

          <div className="form-actions">
            <button className="primary-action" onClick={submit}>
              保存检查项
            </button>
            <button onClick={() => { resetForm(); setShowForm(false); }}>取消</button>
          </div>
        </div>
      )}

      <div className="item-list">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} dispatch={dispatch} />
        ))}
      </div>
    </section>
  );
}
