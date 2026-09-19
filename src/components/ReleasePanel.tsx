import { useState } from "react";
import type { Action } from "../store";
import type { AppState } from "../types";
import type { GateRow } from "../domain";
import { evaluateGate, formatDateTime } from "../domain";

function GateRowList({ title, rows }: { title: string; rows: GateRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="gate-block">
      <h4>{title}</h4>
      <ul className="gate-list">
        {rows.map(({ item, defect }) => (
          <li key={defect.id}>
            <span className="gate-ata">{item.ata}</span>
            <span className="gate-name">{item.name}</span>
            <span className="gate-engineer">责任工程师：{item.engineer}</span>
            <span className="gate-defect">
              {defect.level} · 期限 {defect.deadline} · {defect.description}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReleasePanel({
  state,
  gate,
  dispatch,
}: {
  state: AppState;
  gate: ReturnType<typeof evaluateGate>;
  dispatch: React.Dispatch<Action>;
}) {
  const latestVersion = state.versions[state.versions.length - 1];
  const isReSign = state.versions.length > 0;
  const [signer, setSigner] = useState("");
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const submit = () => {
    if (gate.openRows.length > 0) {
      setFeedback("签署被驳回：仍存在未关闭缺陷，按规则不得签署放行。");
      return;
    }
    if (gate.overdueNoBasisRows.length > 0) {
      setFeedback("签署被驳回：存在逾期缺陷未填写延期依据，请先补齐后再签。");
      return;
    }
    if (!signer.trim()) {
      setFeedback("请填写放行签署人。");
      return;
    }
    if (isReSign && !reason.trim()) {
      setFeedback("已有历史签署，本次为关闭后再签署，必须填写新版本生成原因（原签署保留不动）。");
      return;
    }
    dispatch({ type: "sign_release", signer, reason: isReSign ? reason : undefined });
    setSigner("");
    setReason("");
    setFeedback(
      isReSign
        ? `已保留原签署并生成 V${(latestVersion?.version ?? 0) + 1}，新版本带生成原因。`
        : "V1 放行签署完成。"
    );
  };

  return (
    <section className="panel release-panel">
      <div className="section-heading">
        <div>
          <p>放行签署闭环</p>
          <h2>签署放行</h2>
        </div>
      </div>

      {/* 签署前闸门 */}
      <div className={`gate-card ${gate.canSign ? "gate-pass" : "gate-blocked"}`}>
        <div className="gate-status">
          <span className={`gate-dot ${gate.canSign ? "dot-pass" : "dot-block"}`} />
          <strong>{gate.canSign ? "闸门通过：可以签署放行" : "闸门未通过：禁止签署放行"}</strong>
        </div>
        <p className="gate-rule">
          规则：存在未关闭缺陷不得签署；逾期缺陷必须填写延期依据；关闭后再签仅保留原签署并生成带原因的新版本。
        </p>
        <GateRowList title={`未关闭缺陷（${gate.openRows.length}）— 必须先关闭`} rows={gate.openRows} />
        <GateRowList
          title={`逾期且缺延期依据（${gate.overdueNoBasisRows.length}）— 必须补填`}
          rows={gate.overdueNoBasisRows}
        />
      </div>

      {/* 签署表单 */}
      <div className="sign-form">
        <label>
          <span>放行签署人</span>
          <input
            value={signer}
            onChange={(e) => setSigner(e.target.value)}
            placeholder="放行人员姓名 / 授权号"
          />
        </label>
        {isReSign && (
          <label>
            <span>新版本生成原因（再签署必填）</span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`当前最新版本 V${latestVersion?.version} 将原样保留；说明本次重新签署的原因，如：缺陷关闭后复核、新增检查项复验通过`}
            />
          </label>
        )}
        <button className="primary-action sign-btn" disabled={!gate.canSign} onClick={submit}>
          {isReSign ? `签署并生成 V${(latestVersion?.version ?? 0) + 1}` : "签署 V1 放行"}
        </button>
        {feedback && <p className="sign-feedback">{feedback}</p>}
      </div>

      {/* 版本链：历史版本只读、不可修改 */}
      <div className="version-chain">
        <h4>签署版本链（历史版本只读保留）</h4>
        {state.versions.length === 0 && <p className="hint">尚未产生任何放行签署。</p>}
        {[...state.versions].reverse().map((v) => (
          <article key={v.version} className={`version-card ${v.version === latestVersion?.version ? "version-latest" : ""}`}>
            <header>
              <span className="version-tag">V{v.version}</span>
              {v.version === latestVersion?.version && <span className="badge badge-closed">当前版本</span>}
              <time>{formatDateTime(v.signedAt)}</time>
            </header>
            <p className="version-signer">签署人：{v.signer}</p>
            {v.reason && <p className="version-reason">新版本生成原因：{v.reason}</p>}
            <p className="version-snapshot">
              签署时刻快照：检查项 {v.snapshot.itemCount} · 未关闭缺陷 {v.snapshot.openCount} ·
              已关闭 {v.snapshot.closedCount} · 附延期依据 {v.snapshot.overdueBasisCount}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
