import { useCallback, useEffect, useState } from "react";
import type {
  AppState,
  CheckItem,
  Defect,
  DefectLevel,
  Extension,
  Occupation,
  SignVersion,
} from "./types";
import { buildSeed, effectiveDeadline, overlaps, uid } from "./domain";

const STORAGE_KEY = "hxwl-07-maintenance-state-v1";

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (
        Array.isArray(parsed.items) &&
        Array.isArray(parsed.defects) &&
        Array.isArray(parsed.versions) &&
        Array.isArray(parsed.occupations)
      ) {
        return parsed;
      }
    }
  } catch {
    // 存档损坏时回落到演示数据
  }
  return buildSeed();
}

export function useStore() {
  const [state, setState] = useState<AppState>(loadState);

  // 任意改动整体落盘；刷新后检查项/缺陷/签署版本/占用仍通过 ID 对应
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const addItem = useCallback(
    (input: Omit<CheckItem, "id" | "createdAt">) => {
      const item: CheckItem = {
        ...input,
        id: uid("item"),
        createdAt: Date.now(),
      };
      setState((s) => ({ ...s, items: [...s.items, item] }));
      return item;
    },
    []
  );

  const addDefect = useCallback(
    (input: {
      itemId: string;
      description: string;
      level: DefectLevel;
      deadline: string;
      engineer: string;
    }) => {
      const defect: Defect = {
        id: uid("def"),
        status: "open",
        extensions: [],
        createdAt: new Date().toISOString(),
        ...input,
      };
      setState((s) => ({ ...s, defects: [...s.defects, defect] }));
    },
    []
  );

  const addExtension = useCallback(
    (defectId: string, reason: string, nextDeadline: string) => {
      const ext: Extension = {
        id: uid("ext"),
        reason,
        nextDeadline,
        at: new Date().toISOString(),
      };
      setState((s) => ({
        ...s,
        defects: s.defects.map((d) =>
          d.id === defectId ? { ...d, extensions: [...d.extensions, ext] } : d
        ),
      }));
    },
    []
  );

  const closeDefect = useCallback((defectId: string, note: string) => {
    setState((s) => ({
      ...s,
      defects: s.defects.map((d) =>
        d.id === defectId
          ? {
              ...d,
              status: "closed",
              closedAt: new Date().toISOString(),
              closeNote: note,
            }
          : d
      ),
    }));
  }, []);

  /** 签署放行：闸口已拦截未关闭缺陷，这里只负责生成不可变新版本 */
  const signRelease = useCallback((signer: string, reason: string) => {
    let created: SignVersion | null = null;
    setState((s) => {
      const version = s.versions.length + 1;
      created = {
        version,
        signer,
        reason: version === 1 ? "初次放行：全部缺陷已关闭" : reason.trim(),
        at: new Date().toISOString(),
        itemCount: s.items.length,
        defectCount: s.defects.length,
        first: version === 1,
      };
      return { ...s, versions: [...s.versions, created] };
    });
  }, []);

  const submitOccupation = useCallback(
    (input: {
      vehicle: string;
      bay: string;
      start: string;
      end: string;
      itemId: string | null;
    }) => {
      const occupation: Occupation = {
        id: uid("occ"),
        ...input,
        status: "pending",
        confirmedAt: null,
        createdAt: Date.now(),
      };
      setState((s) => ({
        ...s,
        occupations: [...s.occupations, occupation],
      }));
      return occupation;
    },
    []
  );

  /**
   * 确认占用：与该机位已确认（先确认）的记录做时段重叠判定。
   * 重叠 -> 只保留先确认的一条，本条驳回并记录机位、时段、冲突检查项；
   * 不重叠 -> 确认成功。
   */
  const confirmOccupation = useCallback((occupationId: string) => {
    setState((s) => ({
      ...s,
      occupations: s.occupations.map((o) => {
        if (o.id !== occupationId || o.status !== "pending") return o;
        const clash = s.occupations.find(
          (other) =>
            other.status === "confirmed" &&
            other.id !== o.id &&
            overlaps(o, other)
        );
        if (clash) {
          return {
            ...o,
            status: "rejected",
            conflict: {
              occupationId: clash.id,
              bay: clash.bay,
              vehicle: clash.vehicle,
              start: clash.start,
              end: clash.end,
              itemId: clash.itemId,
            },
          };
        }
        return { ...o, status: "confirmed", confirmedAt: Date.now() };
      }),
    }));
  }, []);

  const resetAll = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setState(buildSeed());
  }, []);

  return {
    state,
    addItem,
    addDefect,
    addExtension,
    closeDefect,
    signRelease,
    submitOccupation,
    confirmOccupation,
    resetAll,
  };
}

export type Store = ReturnType<typeof useStore>;
export { effectiveDeadline };
