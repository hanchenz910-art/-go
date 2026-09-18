import {
  preventRollback,
  type HighWater,
  type VerifiedBundle,
} from "./security";
import { z } from "zod";

const STORAGE_KEY = "rest-evidence:v1";
export type HistoryEntry = {
  date: string;
  datasetId: string;
  sequence: number;
  digest: string;
  source: string;
};
export type StoredState = {
  initialized?: boolean;
  raw?: string;
  highWaters: Record<string, HighWater>;
  history: HistoryEntry[];
};
const stateSchema = z
  .object({
    initialized: z.boolean().optional(),
    raw: z
      .string()
      .max(2 * 1024 * 1024)
      .optional(),
    highWaters: z.record(
      z
        .object({
          sequence: z.number().int().positive(),
          digest: z.string().regex(/^[a-f0-9]{64}$/),
        })
        .strict(),
    ),
    history: z
      .array(
        z
          .object({
            date: z.string().datetime(),
            datasetId: z.string(),
            sequence: z.number().int().positive(),
            digest: z.string(),
            source: z.string(),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export function readState(): StoredState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { highWaters: {}, history: [] };
  const value = stateSchema.safeParse(JSON.parse(raw));
  if (!value.success) throw new Error("本地缓存格式损坏，请重新导入已签名名单");
  return value.data;
}
export function watermarkKey(bundle: VerifiedBundle): string {
  return bundle.data.environment + ":" + bundle.data.datasetId;
}
export function acceptBundle(
  current: StoredState,
  bundle: VerifiedBundle,
  source: string,
): StoredState {
  const key = watermarkKey(bundle);
  preventRollback(bundle, current.highWaters[key]);
  const existing = current.history[0];
  const history =
    existing?.digest === bundle.digest
      ? current.history
      : [
          {
            date: new Date().toISOString(),
            datasetId: bundle.data.datasetId,
            sequence: bundle.data.sequence,
            digest: bundle.digest,
            source,
          },
          ...current.history,
        ].slice(0, 20);
  const next = {
    initialized: true,
    raw: JSON.stringify(bundle.envelope),
    highWaters: {
      ...current.highWaters,
      [key]: { sequence: bundle.data.sequence, digest: bundle.digest },
    },
    history,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
export function clearDataset(current: StoredState): StoredState {
  const next = {
    initialized: true,
    highWaters: current.highWaters,
    history: current.history,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
export function downloadFile(
  name: string,
  text: string,
  mime = "application/json",
): void {
  const url = URL.createObjectURL(
    new Blob([text], { type: mime + ";charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
