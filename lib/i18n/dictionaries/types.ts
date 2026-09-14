import type ja from "./ja";

type DeepStringify<T> = {
  [K in keyof T]: T[K] extends object ? DeepStringify<T[K]> : string;
};

export type Dictionary = DeepStringify<typeof ja>;
