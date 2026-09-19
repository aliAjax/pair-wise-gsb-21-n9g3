// 航空维修检查清单 —— 领域模型定义

/** 缺陷等级 */
export type DefectLevel = "一般" | "重要" | "MEL保留";

export interface Defect {
  id: string;
  level: DefectLevel;
  description: string;
  /** 整改期限 YYYY-MM-DD */
  deadline: string;
  status: "open" | "closed";
  createdAt: string;
  closedAt?: string;
  /** 逾期缺陷的延期依据（MEL 批复 / 器材调拨单号等） */
  extensionReason?: string;
  extensionUpdatedAt?: string;
}

/** ATA 检查项 */
export interface CheckItem {
  id: string;
  /** 机型 / 机号 */
  aircraft: string;
  /** ATA 章节，如 ATA 32 */
  ata: string;
  /** 检查区域 */
  area: string;
  /** 检查项目 */
  name: string;
  /** 责任工程师 */
  engineer: string;
  createdAt: string;
  defects: Defect[];
}

/** 放行签署版本（一经生成不可修改，只能追加新版本） */
export interface ReleaseVersion {
  version: number;
  /** 签署时间 YYYY-MM-DDTHH:mm */
  signedAt: string;
  signer: string;
  /** 再签署时必填的新版本生成原因；初次放行可缺省 */
  reason?: string;
  /** 签署时刻的检查状态快照，历史版本不随后续数据变化 */
  snapshot: {
    itemCount: number;
    openCount: number;
    closedCount: number;
    overdueBasisCount: number;
  };
}

/** 维修车辆机位占用（先确认者保留，重叠提交直接驳回） */
export interface Occupancy {
  id: string;
  vehicle: string;
  /** 机位 */
  stand: string;
  /** 占用开始 YYYY-MM-DDTHH:mm */
  start: string;
  /** 占用结束 YYYY-MM-DDTHH:mm */
  end: string;
  /** 关联检查项 ID（冲突时用于定位冲突检查项） */
  checkItemId: string;
  /** 确认时间：先到先得的唯一排序依据 */
  confirmedAt: string;
}

export interface AppState {
  items: CheckItem[];
  versions: ReleaseVersion[];
  occupancies: Occupancy[];
}
