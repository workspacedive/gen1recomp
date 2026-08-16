-- Runtime capability normalization for the pinned love.js compatibility layer.
-- Applied by the generated host wrapper before Gen1Recomp's original main.lua.

local Bootstrap = {}

function Bootstrap.install(loveApi, options)
  assert(type(loveApi) == "table", "love API table required")
  options = options or {}
  local report = {
    threadWorker = "unchanged",
    bitGlobal = "unchanged",
    reason = options.threadReason,
  }

  -- LuaJIT exposes BitOp as both require("bit") and the global `bit`. PUC Lua
  -- only receives our compatibility module, while a few upstream extraction
  -- and Gen 2 files intentionally use the LuaJIT global without requiring it.
  -- Install that host semantic before upstream main.lua loads; this stays in
  -- the love.js adapter and does not patch Gen1Recomp core.
  local okBit, bitApi = pcall(require, "bit")
  assert(okBit and type(bitApi) == "table", "BitOp compatibility module unavailable")
  _G.bit = bitApi
  report.bitGlobal = "installed"

  if options.disableThreadWorkers then
    if type(loveApi.thread) == "table" then
      -- Keep Channels available: they work in the measured runtime and some
      -- main-state code uses them. Only hide the worker constructor so all
      -- upstream capability checks select their explicit no-thread paths.
      loveApi.thread.newThread = nil
    end
    report.threadWorker = "disabled"
  end

  return report
end

return Bootstrap
