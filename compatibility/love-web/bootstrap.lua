-- Runtime capability normalization for the pinned love.js compatibility layer.
-- Applied by the generated host wrapper before Gen1Recomp's original main.lua.

local Bootstrap = {}

function Bootstrap.install(loveApi, options)
  assert(type(loveApi) == "table", "love API table required")
  options = options or {}
  local report = {
    threadWorker = "unchanged",
    reason = options.threadReason,
  }

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
