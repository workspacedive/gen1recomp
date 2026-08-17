local adapterPath = assert(arg[1], "touch adapter path required")
local calls = {}
local function called(name) calls[name] = (calls[name] or 0) + 1 end
local fontSize = 12
local graphics = {
  newFont = function(size)
    fontSize = size
    return {
      getWidth = function(_, text) return #text * size * 0.55 end,
      getHeight = function() return size end,
    }
  end,
  setFont = function() called("setFont") end,
  print = function() called("print") end,
  setColor = function() called("setColor") end,
  circle = function() called("circle") end,
  rectangle = function() called("rectangle") end,
  polygon = function() called("polygon") end,
  setLineWidth = function() called("setLineWidth") end,
  setLineStyle = function() called("setLineStyle") end,
  setLineJoin = function() called("setLineJoin") end,
  push = function() called("push") end,
  pop = function() called("pop") end,
  origin = function() called("origin") end,
}
local TouchControls = {}
package.preload["src.core.TouchControls"] = function() return TouchControls end
local loveApi = { graphics = graphics }
_G.love = loveApi
local adapter = assert(loadfile(adapterPath))()
assert(adapter.install(loveApi))
assert(type(TouchControls.draw) == "function")
local zones = {
  dpad = { cx = 150, cy = 700, w = 220 },
  a = { cx = 520, cy = 620, w = 100 },
  b = { cx = 430, cy = 700, w = 100 },
  start = { cx = 340, cy = 760, w = 72 },
  select = { cx = 260, cy = 760, w = 72 },
}
local controls = {
  dpadTouch = 1,
  touches = { [1] = { dir = "up" } },
  held = { a = true },
  visible = function() return true end,
  layout = function() return zones end,
}
TouchControls.draw(controls)
assert((calls.circle or 0) >= 5)
assert((calls.rectangle or 0) >= 8)
assert((calls.polygon or 0) == 4)
assert((calls.print or 0) == 4)
assert((calls.push or 0) == 1 and (calls.pop or 0) == 1)
assert(fontSize >= 12)
print("touch vector visuals fake runtime: passed")
