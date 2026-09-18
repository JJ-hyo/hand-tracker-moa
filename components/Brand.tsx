import Image from "next/image";

/** Motion Archive 워드마크 (public/brand/logo.png, 1112×531 흰색) */
export function Logo({ width = 180, className = "" }: { width?: number; className?: string }) {
  return (
    <Image
      src="/brand/logo.png"
      alt="Motion Archive"
      width={width}
      height={Math.round((width * 531) / 1112)}
      priority
      className={className}
    />
  );
}

type Motif = "orange" | "cyan" | "magenta" | "green";
const MOTIF_SIZE: Record<Motif, number> = { orange: 348, cyan: 124, magenta: 119, green: 119 };

/** 하프톤 점무늬 십자 모티프 — 장식용, 클릭 불가 */
export function Motif({ kind, size, className = "", style }: { kind: Motif; size: number; className?: string; style?: React.CSSProperties }) {
  const nat = MOTIF_SIZE[kind];
  return (
    <Image
      src={`/brand/motif-${kind}.png`}
      alt=""
      aria-hidden
      width={size}
      height={Math.round((size * (kind === "cyan" ? 108 : nat)) / nat)}
      className={`pointer-events-none select-none ${className}`}
      style={style}
    />
  );
}
