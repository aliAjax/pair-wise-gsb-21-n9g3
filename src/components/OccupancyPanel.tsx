import { useState } from "react";
import type { Action } from "../store";
import type { AppState } from "../types";
import type { OccupancyConflict } from "../domain";
import { dateTimeOffset, findConflicts, formatDateTime } from "../domain";

export function OccupancyPanel({
  state,
  dispatch,
}: {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}) {
  const [vehicle, setVehicle] = useState("");
  const [stand, setStand] = useState("203");
  const [start, setStart] = useState(dateTimeOffset(0, 13, 0));
  const [end, setEnd] = useState(dateTimeOffset(0, 15, 0));
  const [checkItemId, setCheckItemId] = useState(state.items[0]?.id ?? "");
  const [conflicts, setConflicts] = useState<OccupancyConflict[] | null>(null);
  const [rangeError, setRangeError] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const itemName = (id: string) =>
    state.items.find((it) => it.id === id)?.name ?? "（关联检查项已删除）";
  const itemAta = (id: string) => state.items.find((it) => it.id === id)?.ata ?? "";

  const submit = () => {
    setOkMsg(null);
    setConflicts(null);
    setRangeError(false);

    if (!vehicle.trim() || !stand.trim() || !start || !end || !checkItemId) return;
    if (end <= start) {
      setRangeError(true);
      return;
    }
    const found = findConflicts(state, { stand: stand.trim(), start, end });
    if (found.length > 0) {
      // 后提交不入库：列出机位、时段与冲突检查项，只保留先确认的一条
      setConflicts(found);
      return;
    }
    dispatch({ type: "add_occupancy", vehicle, stand, start, end, checkItemId });
    setOkMsg(
      `机位 ${stand.trim()} 占用已确认（${formatDateTime(start)} – ${formatDateTime(
        end
      )}）。`
    );
    setVehicle("");
  };

  return (
    <section className="panel occupancy-panel">
      <div className="section-heading">
        <div>
          <p>维修车辆机位占用</p>
          <h2>机位占用申报</h2>
        </div>
      </div>

      <p className="gate-rule">
        规则：同一机位时段重叠时只保留先确认的一条；后提交的申报将被驳回，并列出机位、时段与冲突检查项。
      </p>

      <div className="occ-form">
        <div className="form-row">
          <label>
            <span>车辆 *</span>
            <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="升降平台车 / 牵引车编号" />
          </label>
          <label>
            <span>机位 *</span>
            <input value={stand} onChange={(e) => setStand(e.target.value)} placeholder="如 203" />
          </label>
        </div>
        <div className="form-row">
          <label>
            <span>开始时间 *</span>
            <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label>
            <span>结束时间 *</span>
            <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
        </div>
        <label>
          <span>关联检查项 *</span>
          <select value={checkItemId} onChange={(e) => setCheckItemId(e.target.value)}>
            {state.items.map((it) => (
              <option key={it.id} value={it.id}>
                {it.ata} · {it.name}（{it.aircraft}）
              </option>
            ))}
          </select>
        </label>
        <button className="primary-action" onClick={submit}>
          确认占用机位
        </button>

        {rangeError && <p className="sign-feedback">结束时间必须晚于开始时间。</p>}
        {okMsg && <p className="occ-ok">{okMsg}</p>}

        {conflicts && (
          <div className="conflict-box">
            <h4>占用冲突，本次申报未保留</h4>
            <p>
              申报机位 <strong>{stand.trim()}</strong>，时段{" "}
              <strong>
                {formatDateTime(start)} – {formatDateTime(end)}
              </strong>{" "}
              与下列先确认记录重叠，按先到先得规则只保留先确认的一条：
            </p>
            <ul className="conflict-list">
              {conflicts.map(({ existing, item }) => (
                <li key={existing.id}>
                  <span className="conflict-stand">机位 {existing.stand}</span>
                  <span className="conflict-time">
                    已占时段：{formatDateTime(existing.start)} – {formatDateTime(existing.end)}
                  </span>
                  <span className="conflict-vehicle">先确认车辆：{existing.vehicle}</span>
                  <span className="conflict-item">
                    冲突检查项：{item ? `${item.ata} · ${item.name}（责任工程师 ${item.engineer}）` : itemName(existing.checkItemId)}
                  </span>
                  <span className="conflict-confirmed">
                    确认时间：{formatDateTime(existing.confirmedAt)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="hint">请调整机位或时段后重新提交。</p>
          </div>
        )}
      </div>

      <div className="occ-list">
        <h4>已确认占用（{state.occupancies.length}）</h4>
        {state.occupancies
          .slice()
          .sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt))
          .map((o) => (
            <article key={o.id} className="occ-card">
              <header>
                <span className="occ-stand">{o.stand}</span>
                <span>{o.vehicle}</span>
              </header>
              <p>
                {formatDateTime(o.start)} – {formatDateTime(o.end)}
              </p>
              <p className="occ-item">
                {itemAta(o.checkItemId) ? `${itemAta(o.checkItemId)} · ` : ""}
                {itemName(o.checkItemId)}
              </p>
              <time>确认于 {formatDateTime(o.confirmedAt)}</time>
            </article>
          ))}
      </div>
    </section>
  );
}
