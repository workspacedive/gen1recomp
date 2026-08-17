export interface LoveJsViewportPlan {
  readonly cssWidth: number
  readonly cssHeight: number
  readonly width: number
  readonly height: number
  readonly gameScale: number
  readonly orientation: "portrait" | "landscape"
  readonly devicePixelRatio: number
}

export type LoveJsViewportQuality = "bounded" | "native-pixels"

const GAME_WIDTH = 160
const GAME_HEIGHT = 144
const TABLET_SHORT_EDGE = 600
const PHONE_GAME_SCALE = 4
const TABLET_GAME_SCALE = 5
const MIN_WIDTH = GAME_WIDTH * 2
const MIN_HEIGHT = GAME_HEIGHT * 2
const MAX_DIMENSION = 4096

/**
 * Selects an aspect-preserving love.js backing surface for a browser viewport.
 *
 * `bounded` keeps fill-rate near a 1024x768 surface. `native-pixels` maps the
 * canvas one-to-one to the device framebuffer, retaining exact viewport aspect
 * and integer Gen1Recomp pixels while giving vector overlays Retina detail.
 */
export function planLoveJsViewport(
  cssWidthValue: number,
  cssHeightValue: number,
  devicePixelRatioValue: number,
  quality: LoveJsViewportQuality = "bounded",
): LoveJsViewportPlan {
  const cssWidth = Math.max(1, Math.round(cssWidthValue))
  const cssHeight = Math.max(1, Math.round(cssHeightValue))
  const devicePixelRatio = Number.isFinite(devicePixelRatioValue) && devicePixelRatioValue > 0
    ? devicePixelRatioValue
    : 1
  const aspect = cssWidth / cssHeight
  let width: number
  let height: number
  let gameScale: number

  if (quality === "native-pixels") {
    width = Math.round(cssWidth * devicePixelRatio)
    height = Math.round(cssHeight * devicePixelRatio)
    gameScale = Math.floor(Math.min(width / GAME_WIDTH, height / GAME_HEIGHT))
  } else {
    gameScale = Math.min(cssWidth, cssHeight) >= TABLET_SHORT_EDGE
      ? TABLET_GAME_SCALE
      : PHONE_GAME_SCALE
    const landscapeGameAspect = GAME_WIDTH / GAME_HEIGHT
    width = aspect >= landscapeGameAspect
      ? Math.round(GAME_HEIGHT * gameScale * aspect)
      : GAME_WIDTH * gameScale
    height = aspect >= landscapeGameAspect
      ? GAME_HEIGHT * gameScale
      : Math.round(GAME_WIDTH * gameScale / aspect)
  }

  if (width < MIN_WIDTH || height < MIN_HEIGHT || gameScale < 2
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
