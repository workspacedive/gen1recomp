export interface LoveJsViewportPlan {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly width: number
  readonly height: number
  readonly gameScale: number
  readonly orientation: "portrait" | "landscape"
  readonly devicePixelRatio: number
}

const GAME_WIDTH = 160
const GAME_HEIGHT = 144
const TABLET_SHORT_EDGE = 600
const PHONE_GAME_SCALE = 4
const TABLET_GAME_SCALE = 5
const MIN_WIDTH = GAME_WIDTH * 2
const MIN_HEIGHT = GAME_HEIGHT * 2
const MAX_DIMENSION = 2048

/**
 * Selects an aspect-preserving love.js backing surface for a browser viewport.
 *
 * The backing surface follows the viewport aspect while its constrained game
 * edge remains an integer multiple of Gen1Recomp's 160x144 composition area.
 * CSS then scales the whole surface uniformly into the WebView. This gives the
 * renderer the long edge for expanded-world drawing, keeps touch controls
 * large, and bounds fill-rate near the previous 1024x768 surface. Device pixel
 * ratio is diagnostic only: multiplying by Retina DPR would add fill cost
 * without adding game information.
 */
export function planLoveJsViewport(
  cssWidthValue: number,
  cssHeightValue: number,
  devicePixelRatioValue: number,
): LoveJsViewportPlan {
  const cssWidth = Math.max(1, Math.round(cssWidthValue))
  const cssHeight = Math.max(1, Math.round(cssHeightValue))
  const devicePixelRatio = Number.isFinite(devicePixelRatioValue) && devicePixelRatioValue > 0
    ? devicePixelRatioValue
    : 1
  const aspect = cssWidth / cssHeight
  const gameScale = Math.min(cssWidth, cssHeight) >= TABLET_SHORT_EDGE
    ? TABLET_GAME_SCALE
    : PHONE_GAME_SCALE
  const landscapeGameAspect = GAME_WIDTH / GAME_HEIGHT
  const width = aspect >= landscapeGameAspect
    ? Math.round(GAME_HEIGHT * gameScale * aspect)
    : GAME_WIDTH * gameScale
  const height = aspect >= landscapeGameAspect
    ? GAME_HEIGHT * gameScale
    : Math.round(GAME_WIDTH * gameScale / aspect)

  if (width < MIN_WIDTH || height < MIN_HEIGHT
      || width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error(
      `unsupported viewport geometry ${cssWidth}x${cssHeight} -> ${width}x${height}`,
    )
  }

  return Object.freeze({
    cssWidth,
    cssHeight,
    width,
    height,
    gameScale,
    orientation: aspect >= 1 ? "landscape" : "portrait",
    devicePixelRatio,
  })
}
