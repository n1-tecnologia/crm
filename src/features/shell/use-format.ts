"use client";

/**
 * Binds the formatters to the workspace Locale.
 *
 * The `Intl` objects are built once per Locale rather than per call: they are
 * expensive to construct, and a dense table calls the same formatter sixty
 * times in one render.
 */

import { useMemo } from "react";
import { useData } from "@/data/store";
import { makeFormatters, type Formatters } from "./format";

export function useFormat(): Formatters {
  const locale = useData((data) => data.workspace.locale);
  // The Locale is a value object on the workspace and is replaced wholesale
  // when it changes, so its identity is the right dependency.
  return useMemo(() => makeFormatters(locale), [locale]);
}
