export type Landmark = { x: number; y: number; z: number };
export type Side = "Left" | "Right" | "Unknown";

export type Gesture = { key: string; name: string; emoji: string; detail: string };

export type TrackedHand = {
  side: Side;
  score: number;
  landmarks: Landmark[];
  gesture: Gesture;
};

export type SourceKind = "none" | "local" | "remote";
