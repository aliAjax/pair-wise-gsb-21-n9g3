import type {
  AppState,
  CheckItem,
  Defect,
  DefectLevel,
  Occupation,
} from "./types";

/* ---------------- 基础工具 ---------------- */

let seq = 0;
export function uid(prefix: string): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}${seq}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/** 本地时间 yyyy-MM-dd */
export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatTs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

/** 实际整改期限：有延期取最后一次延期后的日期，否则取原始期限 */
export function effectiveDeadline(defect: Defect): string {
  return defect.extensions.length
    ? defect.extensions[defect.extensions.length - 1].nextDeadline
    : defect.deadline;
}

/** 是否逾期（按实际整改期限与今天比较） */
export function isOverdue(defect: Defect, today: string): boolean {
  return defect.status === "open" && effectiveDeadline(defect) < today;
}

/* ---------------- 放行闸口 ---------------- */

export interface GateResult {
  openDefects: Defect[];
  overdueWithoutExtension: Defect[];
  canSign: boolean;
}

/**
 * 放行规则：
 * 1. 存在未关闭缺陷 -> 不得签署；
 * 2. 未关闭的逾期缺陷 -> 必须先填写延期依据（即便刚延过期，只要新期限仍逾期也继续拦截）。
 */
export function evaluateGate(defects: Defect[], today: string): GateResult {
  const openDefects = defects.filter((d) => d.status === "open");
  const overdueWithoutExtension = openDefects.filter((d) => {
    if (!isOverdue(d, today)) return false;
    const last = d.extensions[d.extensions.length - 1];
    // 最近一次延期后的新期限仍早于今天 => 仍需继续补延期依据
    return !last || last.nextDeadline < today;
  });
  return {
    openDefects,
    overdueWithoutExtension,
    canSign: openDefects.length === 0,
  };
}

/* ---------------- 机位占用冲突 ---------------- */

/** 同机位半开区间重叠：start < other.end && other.start < end */
export function overlaps(
  a: { bay: string; start: string; end: string },
  b: { bay: string; start: string; end: string }
): boolean {
  if (a.bay.trim() !== b.bay.trim()) return false;
  return a.start < b.end && b.start < a.end;
}

/* ---------------- 指标 ---------------- */

export interface Metrics {
  itemCount: number;
  openCount: number;
  overdueCount: number;
  versionCount: number;
}

export function computeMetrics(state: AppState, today: string): Metrics {
  return {
    itemCount: state.items.length,
    openCount: state.defects.filter((d) => d.status === "open").length,
    overdueCount: state.defects.filter((d) => isOverdue(d, today)).length,
    versionCount: state.versions.length,
  };
}

/* ---------------- 初始演示数据（刷新后仍在；可一键清空重来） ---------------- */

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function buildSeed(): AppState {
  const items: CheckItem[] = [
    {
      id: "item-32",
      ata: "ATA 32",
      area: "起落架",
      title: "主轮磨损与刹车装置检查",
      engineer: "张工",
      createdAt: 1,
    },
    {
      id: "item-27",
      ata: "ATA 27",
      area: "飞控",
      title: "副翼作动器行程与响应测试",
      engineer: "李工",
      createdAt: 2,
    },
    {
      id: "item-24",
      ata: "ATA 24",
      area: "电源系统",
      title: "电瓶电压与应急电源检查",
      engineer: "王工",
      createdAt: 3,
    },
  ];

  const defects: Defect[] = [
    {
      id: "def-1",
      itemId: "item-32",
      description: "1 号主轮磨损接近限制值，需持续监控",
      level: "重要",
      deadline: daysFromNow(5),
      engineer: "张工",
      status: "open",
      extensions: [],
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "def-2",
      itemId: "item-27",
      description: "副翼作动测试响应偏慢，待换件后复查",
      level: "严重",
      deadline: daysFromNow(-2),
      engineer: "李工",
      status: "open",
      extensions: [
        {
          id: "ext-1",
          reason: "作动器备件调拨中，已加挂MEL保留并加密检查",
          nextDeadline: daysFromNow(3),
          at: new Date(Date.now() - 3600000).toISOString(),
        },
      ],
      createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      id: "def-3",
      itemId: "item-24",
      description: "电瓶桩头轻微氧化物",
      level: "一般",
      deadline: daysFromNow(-1),
      engineer: "王工",
      status: "closed",
      closedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      closeNote: "已清洁桩头并涂抹防腐脂，复测电压正常",
      extensions: [],
      createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
  ];

  const base = Date.now();
  const occupations: Occupation[] = [
    {
      id: "occ-1",
      vehicle: "除冰车 B-12",
      bay: "B-203",
      start: seedTime(base, 2),
      end: seedTime(base, 4),
      itemId: "item-32",
      status: "confirmed",
      confirmedAt: base - 600000,
      createdAt: base - 600000,
    },
    {
      id: "occ-2",
      vehicle: "高空车 A-07",
      bay: "B-203",
      start: seedTime(base, 3),
      end: seedTime(base, 5),
      itemId: "item-27",
      status: "pending",
      confirmedAt: null,
      createdAt: base,
    },
  ];

  return { items, defects, versions: [], occupations };
}

function seedTime(base: number, offsetHours: number): string {
  const d = new Date(base + offsetHours * 3600000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
}

export const LEVELS: DefectLevel[] = ["一般", "重要", "严重"];
