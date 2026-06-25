/**
 * All member colour classes must appear here as complete literal strings
 * so Tailwind's JIT compiler includes them in the CSS bundle.
 * Never build class names with string interpolation from avatarColor.
 */

export interface MemberColors {
  bg: string;       // avatar background  e.g. bg-orange-400
  text: string;     // accent text        e.g. text-orange-600
  light: string;    // tinted background  e.g. bg-orange-50
  lightMid: string; // mid tint           e.g. bg-orange-100
  border: string;   // tinted border      e.g. border-orange-200
  ring: string;     // focus ring         e.g. focus:border-orange-400
}

const PALETTE: Record<string, MemberColors> = {
  "bg-orange-400": {
    bg:       "bg-orange-400",
    text:     "text-orange-600",
    light:    "bg-orange-50",
    lightMid: "bg-orange-100",
    border:   "border-orange-200",
    ring:     "focus:border-orange-400",
  },
  "bg-rose-400": {
    bg:       "bg-rose-400",
    text:     "text-rose-600",
    light:    "bg-rose-50",
    lightMid: "bg-rose-100",
    border:   "border-rose-200",
    ring:     "focus:border-rose-400",
  },
  "bg-violet-400": {
    bg:       "bg-violet-400",
    text:     "text-violet-600",
    light:    "bg-violet-50",
    lightMid: "bg-violet-100",
    border:   "border-violet-200",
    ring:     "focus:border-violet-400",
  },
  "bg-teal-400": {
    bg:       "bg-teal-400",
    text:     "text-teal-600",
    light:    "bg-teal-50",
    lightMid: "bg-teal-100",
    border:   "border-teal-200",
    ring:     "focus:border-teal-400",
  },
};

const FALLBACK: MemberColors = PALETTE["bg-orange-400"];

export function getMemberColors(avatarColor: string): MemberColors {
  return PALETTE[avatarColor] ?? FALLBACK;
}
