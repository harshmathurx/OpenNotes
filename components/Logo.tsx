import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The OpenNotes mark — an open book. Two pages fanning from a spine, the gap
 * between them reading as "open" (open source, open format, notes open to you).
 * One geometric gesture, calm, legible from 16px up. This is the brand mark —
 * use it instead of a generic lucide file icon.
 */
export function Logo({
  className,
  size = 16,
}: {
  className?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="OpenNotes"
      className={cn("shrink-0", className)}
    >
      <rect width="1024" height="1024" rx="230" fill="currentColor" opacity="0" />
      {/* pages — currentColor so the mark inherits light/dark foreground */}
      <path
        fill="currentColor"
        d="M500 306 C424 266 342 258 268 268 L268 730 C342 720 424 728 500 766 Z"
      />
      <path
        fill="currentColor"
        d="M524 306 C600 266 682 258 756 268 L756 730 C682 720 600 728 524 766 Z"
      />
    </svg>
  )
}

/** The mark on its ink tile, for app-icon / splash contexts. */
export function LogoTile({
  className,
  size = 32,
}: {
  className?: string
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="OpenNotes"
      className={cn("shrink-0", className)}
    >
      <defs>
        <linearGradient id="on-g" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2B2640" />
          <stop offset="1" stopColor="#191430" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="230" fill="url(#on-g)" />
      <path
        fill="#F5F1E8"
        d="M500 306 C424 266 342 258 268 268 L268 730 C342 720 424 728 500 766 Z"
      />
      <path
        fill="#F5F1E8"
        d="M524 306 C600 266 682 258 756 268 L756 730 C682 720 600 728 524 766 Z"
      />
    </svg>
  )
}
