-- High-quality vector presentation for the existing upstream TouchControls
-- input owner. Hit testing, touch ownership, GB button state and release/reset
-- behavior remain in src.core.TouchControls; this adapter replaces draw only.

local TouchVisuals = {}
local installed = false

local function fontFor(cache, size)
  size = math.max(12, math.floor(size + 0.5))
  if not cache[size] then cache[size] = love.graphics.newFont(size) end
  return cache[size]
end

local function centered(text, font, cx, cy)
  love.graphics.setFont(font)
  love.graphics.print(text,
    math.floor(cx - font:getWidth(text) / 2 + 0.5),
    math.floor(cy - font:getHeight() / 2 + 0.5))
end

local function disc(zone, pressed, label, accent, fonts)
  local radius = zone.w * 0.47
  local shadow = math.max(3, zone.w * 0.025)
  love.graphics.setColor(0, 0, 0, pressed and 0.30 or 0.22)
  love.graphics.circle("fill", zone.cx, zone.cy + shadow, radius)
  local brightness = pressed and 1 or 0.82
  love.graphics.setColor(accent[1] * brightness, accent[2] * brightness,
    accent[3] * brightness, pressed and 0.94 or 0.78)
  love.graphics.circle("fill", zone.cx, zone.cy, radius)
  love.graphics.setLineWidth(math.max(2, zone.w * 0.018))
  love.graphics.setColor(1, 1, 1, pressed and 0.94 or 0.70)
  love.graphics.circle("line", zone.cx, zone.cy, radius)
  love.graphics.setColor(1, 1, 1, pressed and 1 or 0.92)
  centered(label, fontFor(fonts, zone.w * 0.42), zone.cx, zone.cy)
end

local function capsule(zone, pressed, label, fonts)
  local width, height = zone.w * 1.34, zone.w * 0.56
  local x, y = zone.cx - width / 2, zone.cy - height / 2
  local radius = height / 2
  local shadow = math.max(2, zone.w * 0.025)
  love.graphics.setColor(0, 0, 0, 0.24)
  love.graphics.rectangle("fill", x, y + shadow, width, height, radius, radius)
  love.graphics.setColor(0.10, 0.13, 0.19, pressed and 0.94 or 0.78)
  love.graphics.rectangle("fill", x, y, width, height, radius, radius)
  love.graphics.setLineWidth(math.max(2, zone.w * 0.018))
  love.graphics.setColor(1, 1, 1, pressed and 0.92 or 0.64)
  love.graphics.rectangle("line", x, y, width, height, radius, radius)
  love.graphics.setColor(1, 1, 1, pressed and 1 or 0.88)
  centered(label, fontFor(fonts, zone.w * 0.24), zone.cx, zone.cy)
end

local function arrow(cx, cy, size, direction)
  local points
  if direction == "up" then
    points = { cx, cy - size, cx - size * 0.72, cy + size * 0.45,
      cx + size * 0.72, cy + size * 0.45 }
  elseif direction == "down" then
    points = { cx, cy + size, cx - size * 0.72, cy - size * 0.45,
      cx + size * 0.72, cy - size * 0.45 }
  elseif direction == "left" then
    points = { cx - size, cy, cx + size * 0.45, cy - size * 0.72,
      cx + size * 0.45, cy + size * 0.72 }
  else
    points = { cx + size, cy, cx - size * 0.45, cy - size * 0.72,
      cx - size * 0.45, cy + size * 0.72 }
  end
  love.graphics.polygon("fill", points)
end

local function dpad(zone, pressedDirection)
  local width = zone.w
  local arm = width * 0.34
  local radius = arm * 0.18
  local xh, yh = zone.cx - width / 2, zone.cy - arm / 2
  local xv, yv = zone.cx - arm / 2, zone.cy - width / 2
  local shadow = math.max(3, width * 0.022)
  love.graphics.setColor(0, 0, 0, 0.25)
  love.graphics.rectangle("fill", xh, yh + shadow, width, arm, radius, radius)
  love.graphics.rectangle("fill", xv, yv + shadow, arm, width, radius, radius)
  love.graphics.setColor(0.10, 0.13, 0.19, 0.84)
  love.graphics.rectangle("fill", xh, yh, width, arm, radius, radius)
  love.graphics.rectangle("fill", xv, yv, arm, width, radius, radius)

  if pressedDirection then
    love.graphics.setColor(0.24, 0.55, 1.0, 0.82)
    if pressedDirection == "up" then
      love.graphics.rectangle("fill", xv, yv, arm, width / 2, radius, radius)
    elseif pressedDirection == "down" then
      love.graphics.rectangle("fill", xv, zone.cy, arm, width / 2, radius, radius)
    elseif pressedDirection == "left" then
      love.graphics.rectangle("fill", xh, yh, width / 2, arm, radius, radius)
    else
      love.graphics.rectangle("fill", zone.cx, yh, width / 2, arm, radius, radius)
    end
  end

  love.graphics.setColor(1, 1, 1, 0.70)
  local offset, size = width * 0.32, width * 0.055
  arrow(zone.cx, zone.cy - offset, size, "up")
  arrow(zone.cx, zone.cy + offset, size, "down")
  arrow(zone.cx - offset, zone.cy, size, "left")
  arrow(zone.cx + offset, zone.cy, size, "right")
  love.graphics.setColor(0.04, 0.06, 0.10, 0.72)
  love.graphics.circle("fill", zone.cx, zone.cy, arm * 0.31)
end

function TouchVisuals.install(loveApi)
  if installed then return false end
  assert(type(loveApi) == "table" and type(loveApi.graphics) == "table",
    "love graphics API required")
  local TouchControls = require("src.core.TouchControls")
  local fonts = {}
  TouchControls.draw = function(self)
    if not self:visible() then return end
    local layout = self:layout()
    love.graphics.push("all")
    love.graphics.origin()
    love.graphics.setLineStyle("smooth")
    love.graphics.setLineJoin("bevel")

    local dpadTouch = self.dpadTouch and self.touches[self.dpadTouch]
    dpad(layout.dpad, dpadTouch and dpadTouch.dir)
    disc(layout.a, self.held.a ~= nil, "A", { 0.80, 0.18, 0.20 }, fonts)
    disc(layout.b, self.held.b ~= nil, "B", { 0.16, 0.38, 0.72 }, fonts)
    capsule(layout.start, self.held.start ~= nil, "START", fonts)
    capsule(layout.select, self.held.select ~= nil, "SELECT", fonts)
    love.graphics.pop()
  end
  installed = true
  print("[host-ui] vector touch controls installed")
  return true
end

return TouchVisuals
