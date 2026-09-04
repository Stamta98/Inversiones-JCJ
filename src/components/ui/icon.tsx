/**
 * Inline icon set.
 *
 * Bundling the handful of icons we use as paths keeps the mobile build free of
 * an icon dependency and lets every icon inherit the current text colour.
 */

import type { SVGProps } from "react";

const PATHS: Record<string, string[]> = {
  "layout-dashboard": [
    "M3 3h8v8H3z",
    "M13 3h8v5h-8z",
    "M13 10h8v11h-8z",
    "M3 13h8v8H3z",
  ],
  users: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M22 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  "hand-coins": [
    "M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17",
    "m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9",
    "m2 16 6 6",
    "M16 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ],
  receipt: [
    "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z",
    "M8 7h8",
    "M8 11h8",
    "M8 15h5",
  ],
  route: [
    "M6 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M18 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M9 16h5a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8",
  ],
  wallet: [
    "M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5",
    "M17 13h.01",
  ],
  "trending-down": ["m22 17-8.5-8.5-5 5L2 7", "M16 17h6v-6"],
  "bar-chart": ["M12 20V10", "M18 20V4", "M6 20v-4"],
  "file-text": [
    "M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z",
    "M14 2v5h6",
    "M8 13h8",
    "M8 17h8",
    "M8 9h2",
  ],
  headset: [
    "M3 14v-3a9 9 0 0 1 18 0v3",
    "M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2z",
    "M3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z",
    "M18 18v1a3 3 0 0 1-3 3h-3",
  ],
  "message-circle": [
    "M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 4 11.5a8.5 8.5 0 0 1 8.5-8.5 8.4 8.4 0 0 1 8.5 8.5z",
  ],
  blocks: [
    "M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z",
    "M20 13h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z",
    "M14 3h6a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
    "M4 15h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z",
  ],
  settings: [
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5 8.9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z",
  ],
  plus: ["M12 5v14", "M5 12h14"],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "m21 21-4.3-4.3"],
  menu: ["M4 6h16", "M4 12h16", "M4 18h16"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  "chevron-right": ["m9 18 6-6-6-6"],
  "chevron-left": ["m15 18-6-6 6-6"],
  "chevron-down": ["m6 9 6 6 6-6"],
  "arrow-left": ["m12 19-7-7 7-7", "M19 12H5"],
  "arrow-up": ["m5 12 7-7 7 7", "M12 19V5"],
  "arrow-down": ["m19 12-7 7-7-7", "M12 5v14"],
  check: ["M20 6 9 17l-5-5"],
  "alert-triangle": [
    "m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0z",
    "M12 9v4",
    "M12 17h.01",
  ],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
  phone: [
    "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.4 1.8.6 2.8.7a2 2 0 0 1 1.8 2z",
  ],
  "map-pin": [
    "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z",
    "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ],
  "log-out": [
    "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4",
    "m16 17 5-5-5-5",
    "M21 12H9",
  ],
  "more-horizontal": ["M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z", "M5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"],
  building: [
    "M4 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z",
    "M16 10h2a2 2 0 0 1 2 2v10",
    "M8 6h4",
    "M8 10h4",
    "M8 14h4",
    "M8 18h4",
  ],
  send: ["m22 2-7 20-4-9-9-4Z", "M22 2 11 13"],
  trash: [
    "M3 6h18",
    "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6",
    "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  ],
  pencil: [
    "M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z",
  ],
  "credit-card": ["M2 5h20v14H2z", "M2 10h20"],
  camera: [
    "M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z",
    "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ],
  image: [
    "M3 3h18v18H3z",
    "M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
    "m21 15-5-5L5 21",
  ],
  calendar: [
    "M8 2v4",
    "M16 2v4",
    "M3 4h18v18H3z",
    "M3 10h18",
  ],
  "more-vertical": [
    "M12 6.5a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2z",
    "M12 12.6a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2z",
    "M12 18.7a.6.6 0 1 0 0-1.2.6.6 0 0 0 0 1.2z",
  ],
  "message-square": ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  refresh: [
    "M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7.5-4",
    "M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7.5 4",
    "m20 3-.5 4-4-.5",
    "m4 21 .5-4 4 .5",
  ],
};

export type IconName = keyof typeof PATHS | string;

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  const paths = PATHS[name];
  if (!paths) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
