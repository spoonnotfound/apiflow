import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { RouteLink } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const makeId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const resequenceLinks = (links: RouteLink[]) =>
  links
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((link, idx) => ({ ...link, priority: idx + 1 }));