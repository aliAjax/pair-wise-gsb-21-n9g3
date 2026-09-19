// 集中状态管理：reducer + localStorage 持久化
import { useEffect, useReducer } from "react";
import type { AppState, CheckItem, Defect, DefectLevel, Occupancy } from "./types";
import {
  buildSeedState,
  findConflicts,
  nextId,
  nowLocal,
  signRelease,
} from "./domain";

const STORAGE_KEY = "hxwl-07-maintenance-state-v1";

export type Action =
  | {
      type: "add_item";
      aircraft: string;
      ata: string;
      area: string;
      name: string;
      engineer: string;
      defect?: {
        level: DefectLevel;
        description: string;
        deadline: string;
      };
    }
  | {
      type: "add_defect";
      itemId: string;
      level: DefectLevel;
      description: string;
      deadline: string;
    }
  | { type: "close_defect"; itemId: string; defectId: string }
  | { type: "reopen_defect"; itemId: string; defectId: string }
  | {
      type: "set_extension";
      itemId: string;
      defectId: string;
      reason: string;
    }
  | { type: "sign_release"; signer: string; reason?: string }
  | {
      type: "add_occupancy";
      vehicle: string;
      stand: string;
      start: string;
      end: string;
      checkItemId: string;
    }
  | { type: "reset_seed" };

function mapItem(state: AppState, itemId: string, fn: (item: CheckItem) => CheckItem): AppState {
  return {
    ...state,
    items: state.items.map((it) => (it.id === itemId ? fn(it) : it)),
  };
}

function mapDefect(state: AppState, itemId: string, defectId: string, fn: (d: Defect) => Defect): AppState {
  return mapItem(state, itemId, (item) => ({
    ...item,
    defects: item.defects.map((d) => (d.id === defectId ? fn(d) : d)),
  }));
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "add_item": {
      const item: CheckItem = {
        id: nextId("chk"),
        aircraft: action.aircraft.trim(),
        ata: action.ata.trim(),
        area: action.area.trim(),
        name: action.name.trim(),
        engineer: action.engineer.trim(),
        createdAt: nowLocal(),
        defects: action.defect
          ? [
              {
                id: nextId("def"),
                level: action.defect.level,
                description: action.defect.description.trim(),
                deadline: action.defect.deadline,
                status: "open",
                createdAt: nowLocal(),
              },
            ]
          : [],
      };
      return { ...state, items: [...state.items, item] };
    }

    case "add_defect": {
      const defect: Defect = {
        id: nextId("def"),
        level: action.level,
        description: action.description.trim(),
        deadline: action.deadline,
        status: "open",
        createdAt: nowLocal(),
      };
      return mapItem(state, action.itemId, (item) => ({
        ...item,
        defects: [...item.defects, defect],
      }));
    }

    case "close_defect":
      return mapDefect(state, action.itemId, action.defectId, (d) =>
        d.status === "open"
          ? { ...d, status: "closed", closedAt: nowLocal() }
          : d
      );

    case "reopen_defect":
      return mapDefect(state, action.itemId, action.defectId, (d) =>
        d.status === "closed"
          ? { ...d, status: "open", closedAt: undefined }
          : d
      );

    case "set_extension":
      return mapDefect(state, action.itemId, action.defectId, (d) => ({
        ...d,
        extensionReason: action.reason.trim(),
        extensionUpdatedAt: nowLocal(),
      }));

    case "sign_release": {
      const outcome = signRelease(state, { signer: action.signer, reason: action.reason });
      // UI 层已先行校验，此处兜底，规则不满足时状态不变
      return outcome.ok && outcome.state ? outcome.state : state;
    }

    case "add_occupancy": {
      // 先确认者占用：与已有同机位时段重叠的提交一律驳回、不落库
      const conflicts = findConflicts(state, {
        stand: action.stand,
        start: action.start,
        end: action.end,
      });
      if (conflicts.length > 0 || action.end <= action.start) return state;
      const occupancy: Occupancy = {
        id: nextId("occ"),
        vehicle: action.vehicle.trim(),
        stand: action.stand.trim(),
        start: action.start,
        end: action.end,
        checkItemId: action.checkItemId,
        confirmedAt: nowLocal(),
      };
      return { ...state, occupancies: [...state.occupancies, occupancy] };
    }

    case "reset_seed":
      return buildSeedState();

    default:
      return state;
  }
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.items) && Array.isArray(parsed.versions) && Array.isArray(parsed.occupancies)) {
        return parsed;
      }
    }
  } catch {
    // 数据损坏时回落到演示数据
  }
  return buildSeedState();
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // 存储不可用时仅影响刷新持久化，不阻断操作
    }
  }, [state]);

  return { state, dispatch };
}
