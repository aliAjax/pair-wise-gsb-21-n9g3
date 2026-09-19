// 领域规则：逾期判定、放行闸门、签署、机位冲突、演示数据
import type {
  AppState,
  CheckItem,
  Defect,
  Occupancy,
  ReleaseVersion,
} from "./types";

/* ---------------- 时间与 ID 工具 ---------------- */

const pad = (n: number) => String(n).padStart(2, "0");

/** 当前本地时间，datetime-local 格式 YYYY-MM-DDTHH:mm */
export function nowLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 当前本地日期 YYYY-MM-DD */
export function todayLocal(): string {
  return nowLocal().slice(0, 10);
}

/** 今天相对偏移 offset 天的日期 */
export function dateOffset(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 今天相对偏移 offset 天的时刻（保留当前时分） */
export function dateTimeOffset(offsetDays: number, hour: number, minute = 0): string {
  return `${dateOffset(offsetDays)}T${pad(hour)}:${pad(minute)}`;
}

/** datetime-local -> 展示用文本 */
export function formatDateTime(value?: string): string {
  if (!value) return "—";
  const [date, time = ""] = value.split("T");
  return time ? `${date} ${time}` : date;
}

/** 缺陷是否逾期：整改期限早于今天（无论是否关闭，关闭晚了也要有延期依据） */
export function isOverdue(defect: Defect): boolean {
  return defect.deadline < todayLocal();
}

let seq = 0;
export function nextId(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
}

/* ---------------- 放行闸门 ---------------- */

export interface GateRow {
  item: CheckItem;
  defect: Defect;
}

export interface GateResult {
  openRows: GateRow[];
  overdueNoBasisRows: GateRow[];
  /** 可放行：无未关闭缺陷，且所有逾期缺陷均已填写延期依据 */
  canSign: boolean;
}

export function evaluateGate(state: AppState): GateResult {
  const openRows: GateRow[] = [];
  const overdueNoBasisRows: GateRow[] = [];
  for (const item of state.items) {
    for (const defect of item.defects) {
      if (defect.status === "open") {
        openRows.push({ item, defect });
      }
      if (isOverdue(defect) && !(defect.extensionReason ?? "").trim()) {
        overdueNoBasisRows.push({ item, defect });
      }
    }
  }
  return {
    openRows,
    overdueNoBasisRows,
    canSign: openRows.length === 0 && overdueNoBasisRows.length === 0,
  };
}

export function countDefects(state: AppState) {
  let open = 0;
  let closed = 0;
  let overdueBasis = 0;
  for (const item of state.items) {
    for (const defect of item.defects) {
      if (defect.status === "open") open += 1;
      else closed += 1;
      if (isOverdue(defect) && (defect.extensionReason ?? "").trim()) {
        overdueBasis += 1;
      }
    }
  }
  return { open, closed, overdueBasis, total: open + closed };
}

/* ---------------- 签署放行 ---------------- */

export interface SignInput {
  signer: string;
  /** 再次签署（版本号 > 1）时必须携带生成原因 */
  reason?: string;
}

export interface SignOutcome {
  ok: boolean;
  error?: string;
  state?: AppState;
}

export function signRelease(prev: AppState, input: SignInput): SignOutcome {
  const gate = evaluateGate(prev);
  if (gate.openRows.length > 0) {
    return {
      ok: false,
      error: `存在 ${gate.openRows.length} 项未关闭缺陷，按规则不得签署放行。`,
    };
  }
  if (gate.overdueNoBasisRows.length > 0) {
    return {
      ok: false,
      error: `存在 ${gate.overdueNoBasisRows.length} 项逾期缺陷未填写延期依据，不得签署放行。`,
    };
  }
  const signer = input.signer.trim();
  if (!signer) {
    return { ok: false, error: "请填写放行签署人。" };
  }
  const nextVersion = (prev.versions[prev.versions.length - 1]?.version ?? 0) + 1;
  const reason = input.reason?.trim();
  if (nextVersion > 1 && !reason) {
    return {
      ok: false,
      error: "关闭后再次签署只能保留原签署并生成新版本，必须填写新版本生成原因。",
    };
  }

  const counts = countDefects(prev);
  const version: ReleaseVersion = {
    version: nextVersion,
    signedAt: nowLocal(),
    signer,
    ...(reason ? { reason } : {}),
    snapshot: {
      itemCount: prev.items.length,
      openCount: counts.open,
      closedCount: counts.closed,
      overdueBasisCount: counts.overdueBasis,
    },
  };
  return { ok: true, state: { ...prev, versions: [...prev.versions, version] } };
}

/* ---------------- 机位占用冲突 ---------------- */

/** 同一机位时间区间重叠判定（相邻不算重叠） */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export interface OccupancyConflict {
  existing: Occupancy;
  item: CheckItem | undefined;
}

export function findConflicts(
  state: AppState,
  input: { stand: string; start: string; end: string }
): OccupancyConflict[] {
  const stand = input.stand.trim();
  return state.occupancies
    .filter(
      (o) =>
        o.stand === stand && overlaps(input.start, input.end, o.start, o.end)
    )
    .map((existing) => ({
      existing,
      item: state.items.find((it) => it.id === existing.checkItemId),
    }));
}

/* ---------------- 演示数据（相对今天生成，保证逾期/临期场景可见） ---------------- */

export function buildSeedState(): AppState {
  const items: CheckItem[] = [
    {
      id: "chk-32",
      aircraft: "B-1807 / A320",
      ata: "ATA 32",
      area: "起落架",
      name: "主轮磨耗与刹车装置检查",
      engineer: "高志远",
      createdAt: dateTimeOffset(-6, 9, 20),
      defects: [
        {
          id: "def-32-1",
          level: "重要",
          description: "左主轮 2# 胎面磨耗接近限制值 1.5mm",
          deadline: dateOffset(-2),
          status: "closed",
          createdAt: dateTimeOffset(-6, 10, 5),
          closedAt: dateTimeOffset(-1, 16, 40),
          extensionReason:
            "MEL 保留至下一定检：器材调拨单 WL-20260912-031，已获质量经理批准",
          extensionUpdatedAt: dateTimeOffset(-1, 15, 10),
        },
      ],
    },
    {
      id: "chk-21",
      aircraft: "B-1807 / A320",
      ata: "ATA 21",
      area: "气源系统",
      name: "APU 引气压力检查",
      engineer: "林晓峰",
      createdAt: dateTimeOffset(-4, 8, 50),
      defects: [],
    },
    {
      id: "chk-27",
      aircraft: "B-2035 / ARJ21",
      ata: "ATA 27",
      area: "飞控",
      name: "副翼作动器全行程测试",
      engineer: "周敏",
      createdAt: dateTimeOffset(-5, 14, 0),
      defects: [
        {
          id: "def-27-1",
          level: "重要",
          description: "右副翼作动器低流量点测试偏差超限",
          deadline: dateOffset(1),
          status: "open",
          createdAt: dateTimeOffset(0, 8, 15),
        },
      ],
    },
    {
      id: "chk-24",
      aircraft: "B-2035 / ARJ21",
      ata: "ATA 24",
      area: "电源系统",
      name: "电瓶电压与充放电循环检查",
      engineer: "陈启航",
      createdAt: dateTimeOffset(-3, 10, 0),
      defects: [
        {
          id: "def-24-1",
          level: "一般",
          description: "2# 电瓶静置电压 23.1V，低于工卡要求 23.8V（复核确认已逾原工卡期限）",
          deadline: dateOffset(-1),
          status: "open",
          createdAt: dateTimeOffset(0, 8, 50),
        },
      ],
    },
    {
      id: "chk-05",
      aircraft: "B-5612 / B737",
      ata: "ATA 05",
      area: "机体结构",
      name: "机身蒙皮与铆钉检查",
      engineer: "赵雪",
      createdAt: dateTimeOffset(-2, 9, 40),
      defects: [
        {
          id: "def-05-1",
          level: "MEL保留",
          description: "41FR 蒙皮防撞灯透镜裂纹",
          deadline: dateOffset(6),
          status: "closed",
          createdAt: dateTimeOffset(-2, 10, 20),
          closedAt: dateTimeOffset(-2, 17, 5),
        },
      ],
    },
  ];

  const versions: ReleaseVersion[] = [
    {
      version: 1,
      signedAt: dateTimeOffset(-1, 18, 30),
      signer: "放行人员 王立军",
      snapshot: {
        itemCount: items.length,
        openCount: 0,
        closedCount: 2,
        overdueBasisCount: 1,
      },
    },
  ];

  const occupancies: Occupancy[] = [
    {
      id: "occ-1",
      vehicle: "升降平台车 GP-12",
      stand: "203",
      start: dateTimeOffset(0, 9, 0),
      end: dateTimeOffset(0, 12, 0),
      checkItemId: "chk-27",
      confirmedAt: dateTimeOffset(-1, 16, 12),
    },
  ];

  return { items, versions, occupancies };
}
