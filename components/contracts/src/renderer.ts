import type { Result } from "./result.js"

export type TextureSampling = "nearest" | "linear"
export type RendererCapability =
  | "textureAtlas"
  | "spriteBatch"
  | "renderTarget"
  | "shader"
  | "postProcessing"
  | "contextLoss"

export type RendererDescriptor = {
  readonly id: string
  readonly version: string
  readonly apiVersion: string
  readonly backend: "webgl" | "timelineCanvas" | "cpu"
  readonly capabilities: ReadonlySet<RendererCapability>
}

export type SurfaceOptions = {
  readonly sampling: TextureSampling
  readonly alpha: boolean
  readonly depth: boolean
}

export type TextureSource = {
  readonly assetId: string
  readonly bytes: Uint8Array
  readonly sampling: TextureSampling
}

export type AtlasEntry = {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export type DrawCommand = {
  readonly textureId: string
  readonly source: Readonly<{ x: number; y: number; width: number; height: number }>
  readonly destination: Readonly<{ x: number; y: number; width: number; height: number }>
  readonly color: readonly [number, number, number, number]
  readonly z: number
}

export type DrawBatch = {
  readonly id: string
  readonly commands: readonly DrawCommand[]
}

export type RenderViewport = {
  readonly drawableWidth: number
  readonly drawableHeight: number
  readonly logicalWidth: number
  readonly logicalHeight: number
  readonly integerScale: number
  readonly offsetX: number
  readonly offsetY: number
}

export type RendererStats = {
  readonly frameId: number
  readonly drawCalls: number | null
  readonly batches: number
  readonly textureCount: number
  readonly renderDurationMs: number | null
  readonly backendMetrics: Readonly<Record<string, number | null>>
}

export type RendererError = {
  readonly code: "unsupported" | "invalid_asset" | "context_lost" | "resource_limit" | "internal"
  readonly message: string
}

export interface RendererPort {
  describe(): RendererDescriptor
  createSurface(
    logicalWidth: number,
    logicalHeight: number,
    options: SurfaceOptions,
  ): Result<void, RendererError>
  loadTexture(source: TextureSource): Promise<Result<void, RendererError>>
  createAtlas(textureId: string, entries: readonly AtlasEntry[]): Result<void, RendererError>
  beginFrame(frameId: number): Result<void, RendererError>
  beginPass(targetId: string | null, clear: readonly [number, number, number, number]): Result<void, RendererError>
  drawBatch(batch: DrawBatch): Result<void, RendererError>
  applyPipeline(pipelineId: string, uniforms: Readonly<Record<string, number | readonly number[]>>): Result<void, RendererError>
  endPass(): Result<void, RendererError>
  present(viewport: RenderViewport): Result<void, RendererError>
  invalidate(reason: string): void
  stats(): RendererStats
}

export function pixelPerfectViewport(
  drawableWidth: number,
  drawableHeight: number,
  logicalWidth = 160,
  logicalHeight = 144,
): RenderViewport {
  if (![drawableWidth, drawableHeight, logicalWidth, logicalHeight].every(Number.isSafeInteger)) {
    throw new TypeError("viewport dimensions must be safe integers")
  }
  if (drawableWidth <= 0 || drawableHeight <= 0 || logicalWidth <= 0 || logicalHeight <= 0) {
    throw new RangeError("viewport dimensions must be positive")
  }
  const integerScale = Math.floor(
    Math.min(drawableWidth / logicalWidth, drawableHeight / logicalHeight),
  )
  if (integerScale < 1) {
    throw new RangeError("drawable surface cannot fit one logical pixel per output pixel")
  }
  const width = logicalWidth * integerScale
  const height = logicalHeight * integerScale
  return {
    drawableWidth,
    drawableHeight,
    logicalWidth,
    logicalHeight,
    integerScale,
    offsetX: Math.floor((drawableWidth - width) / 2),
    offsetY: Math.floor((drawableHeight - height) / 2),
  }
}
