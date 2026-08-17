export type GameButton =
  | "up"
  | "down"
  | "left"
  | "right"
  | "a"
  | "b"
  | "start"
  | "select"
  | "menu"

export type InputSource = "touch" | "controller" | "keyboard"

export type InputSample = {
  readonly sequence: number
  readonly monotonicTime: number
  readonly source: InputSource
  readonly held: ReadonlySet<GameButton>
  readonly pressed: ReadonlySet<GameButton>
  readonly released: ReadonlySet<GameButton>
}

export type SerializedInputSample = {
  readonly sequence: number
  readonly monotonicTime: number
  readonly source: InputSource
  readonly held: readonly GameButton[]
  readonly pressed: readonly GameButton[]
  readonly released: readonly GameButton[]
}

export interface InputPort {
  sample(): InputSample
  cancelAll(reason: "suspend" | "focusLost" | "rotation" | "pointerCancelled" | "runtimeStop"): InputSample
}

export function serializeInputSample(sample: InputSample): SerializedInputSample {
  return {
    sequence: sample.sequence,
    monotonicTime: sample.monotonicTime,
    source: sample.source,
    held: [...sample.held],
    pressed: [...sample.pressed],
    released: [...sample.released],
  }
}
