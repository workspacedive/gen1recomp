-- Runtime capability normalization for the pinned love.js compatibility layer.
-- Applied by the generated host wrapper before Gen1Recomp's original main.lua.

local Bootstrap = {}

function Bootstrap.install(loveApi, options)
  assert(type(loveApi) == "table", "love API table required")
  options = options or {}
  local report = {
    threadWorker = "unchanged",
    bitGlobal = "unchanged",
    queueLoopGuard = "unchanged",
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

  -- LÖVE forbids Source:setLooping on queueable sources. Upstream chip music
  -- owns looping inside ChipSynth but still reaches the generic Music looping
  -- call after constructing its queue. Desktop LuaJIT happened not to expose
  -- this during the launcher path; love.js raises a fatal C++ exception. Patch
  -- the shared Source method table lazily on the first queue source and ignore
  -- only this invalid/redundant operation. Static/stream source looping still
  -- delegates unchanged. This is a host semantic guard, not a core edit.
  if loveApi.audio and type(loveApi.audio.newQueueableSource) == "function" then
    local originalNewQueueableSource = loveApi.audio.newQueueableSource
    local patched = false
    loveApi.audio.newQueueableSource = function(...)
      local source = originalNewQueueableSource(...)
      if not patched then
        local mt = getmetatable(source)
        local methods = type(mt) == "table" and mt.__index or nil
        local originalSetLooping = type(methods) == "table" and methods.setLooping or nil
        if type(originalSetLooping) == "function" then
          methods.setLooping = function(self, enabled)
            local okType, sourceType = pcall(self.getType, self)
            if okType and sourceType == "queue" then return end
            return originalSetLooping(self, enabled)
          end
          patched = true
        end
      end
      return source
    end
    report.queueLoopGuard = "installed"
  end

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
