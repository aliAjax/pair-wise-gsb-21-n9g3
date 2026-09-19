import "./styles.css";
import { useAppState } from "./store";
import { countDefects, evaluateGate } from "./domain";
import { CheckItemsPanel } from "./components/CheckItemsPanel";
import { ReleasePanel } from "./components/ReleasePanel";
import { OccupancyPanel } from "./components/OccupancyPanel";

function MetricCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  tone: "ok" | "watch" | "danger" | "neutral";
  hint?: string;
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {hint && <em className="metric-hint">{hint}</em>}
      <i className={`status-${tone}`} />
    </article>
  );
}

function App() {
  const { state, dispatch } = useAppState();
  const gate = evaluateGate(state);
  const counts = countDefects(state);
  const ataCount = new Set(state.items.map((it) => it.ata)).size;

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-07 · port 5107</p>
          <h1>航空维修检查清单</h1>
          <p className="subtitle">
            按 ATA 章节推进维修放行前检查：每个检查项记录缺陷等级、整改期限与责任工程师；
            缺陷不关闭、逾期无依据均不得签署放行；关闭后再签保留原签署并生成带原因的新版本；
            维修车辆机位占用先确认者保留。数据本地持久化，刷新后检查项、缺陷、签署版本与占用仍对应。
          </p>
        </div>
        <div className="stack-card">
          <span>闭环规则</span>
          <strong>缺陷闭环 → 闸门校验 → 签署版本化</strong>
          <strong>机位占用 → 先到先得 → 冲突驳回</strong>
          <button
            className="reset-btn"
            onClick={() => {
              if (window.confirm("恢复为演示数据？当前本地修改将被清空。")) {
                dispatch({ type: "reset_seed" });
              }
            }}
          >
            恢复演示数据
          </button>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="ATA 检查项" value={state.items.length} tone="neutral" hint={`覆盖 ${ataCount} 个 ATA 章节`} />
        <MetricCard label="未关闭缺陷" value={counts.open} tone={counts.open > 0 ? "danger" : "ok"} hint="存在即禁止放行" />
        <MetricCard
          label="逾期缺依据"
          value={gate.overdueNoBasisRows.length}
          tone={gate.overdueNoBasisRows.length > 0 ? "watch" : "ok"}
          hint="须填延期依据"
        />
        <MetricCard
          label="放行版本"
          value={`V${state.versions[state.versions.length - 1]?.version ?? 0}`}
          tone={gate.canSign ? "ok" : "danger"}
          hint={gate.canSign ? "闸门通过" : "闸门未通过"}
        />
      </section>

      <section className="workspace">
        <div className="panel-left">
          <CheckItemsPanel items={state.items} dispatch={dispatch} />
        </div>
        <div className="panel-right">
          <ReleasePanel state={state} gate={gate} dispatch={dispatch} />
          <OccupancyPanel state={state} dispatch={dispatch} />
        </div>
      </section>

      <footer className="page-foot">
        数据保存在浏览器 localStorage（键 hxwl-07-maintenance-state-v1），签署版本为时刻快照、历史只读。
      </footer>
    </main>
  );
}

export default App;
