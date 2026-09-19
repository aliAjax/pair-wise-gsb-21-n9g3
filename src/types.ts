// 航空维修检查清单 —— 放行签署闭环数据模型

/** 缺陷等级：一般 / 重要 / 严重 */
export type DefectLevel = "一般" | "重要" | "严重";

/** 延期依据：逾期缺陷每次延期必须留下依据和新的整改期限 */
export interface Extension {
  id: string;
  /** 延期依据（必答） */
  reason: string;
  /** 延期后的整改期限 yyyy-MM-dd */
  nextDeadline: string;
  /** 登记时间 */
  at: string;
}

export interface Defect {
  id: string;
  /** 所属 ATA 检查项 ID（刷新后仍靠它对应回去） */
  itemId: string;
  description: string;
  level: DefectLevel;
  /** 原始整改期限 yyyy-MM-dd，实际期限取最后一次延期后的日期 */
  deadline: string;
  /** 责任工程师 */
  engineer: string;
  status: "open" | "closed";
  closedAt?: string;
  closeNote?: string;
  /** 延期依据链，按时间顺序追加、不可改写 */
  extensions: Extension[];
  createdAt: string;
}

export interface CheckItem {
  id: string;
  /** ATA 章节，如 ATA 32 */
  ata: string;
  /** 检查区域，如 起落架 */
  area: string;
  /** 检查项目名称 */
  title: string;
  /** 责任工程师 */
  engineer: string;
  createdAt: number;
}

/**
 * 放行签署版本。
 * 已生成的版本只允许追加、不允许修改或删除：
 * 关闭缺陷后重新签署，会保留原签署并生成带原因的新版本。
 */
export interface SignVersion {
  version: number;
  signer: string;
  /** 新版本原因；初次签署时为固定说明 */
  reason: string;
  at: string;
  /** 签署瞬间的台账快照 */
  itemCount: number;
  defectCount: number;
  first?: boolean;
}

/** 机位占用冲突快照（随被拒记录一起持久化） */
export interface ConflictSnapshot {
  occupationId: string;
  bay: string;
  vehicle: string;
  start: string;
  end: string;
  itemId: string | null;
}

export interface Occupation {
  id: string;
  /** 维修车辆编号 */
  vehicle: string;
  /** 机位 */
  bay: string;
  /** 时段（datetime-local：yyyy-MM-ddTHH:mm） */
  start: string;
  end: string;
  /** 关联的 ATA 检查项，用于冲突时指出“冲突检查项” */
  itemId: string | null;
  /** 待确认 -> 确认成功 / 与先确认的一条重叠则驳回 */
  status: "pending" | "confirmed" | "rejected";
  confirmedAt: number | null;
  createdAt: number;
  conflict?: ConflictSnapshot;
}

export interface AppState {
  items: CheckItem[];
  defects: Defect[];
  versions: SignVersion[];
  occupations: Occupation[];
}
