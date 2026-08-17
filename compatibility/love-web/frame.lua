-- Low-overhead callback timing for the no-worker love.js host. Installed after
-- upstream main.lua defines love.update and love.draw.

local Frame = {}
local installed = false

function Frame.install(loveApi)
  if installed then return false end
  assert(type(loveApi) == "table", "love API table required")
  local originalUpdate = assert(loveApi.update, "love.update callback missing")
  local originalDraw = assert(loveApi.draw, "love.draw callback missing")

  local updateCalls, updateCpu, updateMax = 0, 0, 0
  local drawCalls, drawCpu, drawMax = 0, 0, 0
  local reportStarted = os.clock()

  loveApi.update = function(...)
    local started = os.clock()
    local a, b, c, d = originalUpdate(...)
    local elapsed = os.clock() - started
    updateCalls = updateCalls + 1
    updateCpu = updateCpu + elapsed
    updateMax = math.max(updateMax, elapsed)
    return a, b, c, d
  end

  loveApi.draw = function(...)
    local started = os.clock()
    local a, b, c, d = originalDraw(...)
    local elapsed = os.clock() - started
    drawCalls = drawCalls + 1
    drawCpu = drawCpu + elapsed
    drawMax = math.max(drawMax, elapsed)

    local now = os.clock()
    if now - reportStarted >= 5 then
      local updateAverage = updateCalls > 0 and updateCpu * 1000 / updateCalls or 0
      local drawAverage = drawCalls > 0 and drawCpu * 1000 / drawCalls or 0
      local memoryKb = collectgarbage("count")
      print(("[host-perf] frame update calls=%d cpu=%.1fms avg=%.2fms max=%.1fms "
        .. "draw calls=%d cpu=%.1fms avg=%.2fms max=%.1fms lua=%.0fKB")
        :format(updateCalls, updateCpu * 1000, updateAverage, updateMax * 1000,
          drawCalls, drawCpu * 1000, drawAverage, drawMax * 1000, memoryKb))
      updateCalls, updateCpu, updateMax = 0, 0, 0
      drawCalls, drawCpu, drawMax = 0, 0, 0
      reportStarted = now
    end
    return a, b, c, d
  end

  installed = true
  return true
end

return Frame
