-- Cooperative main-thread audio tuning for hosts where love.thread workers are
-- unavailable. The synth, sample rate, channel programs and PCM values remain
-- unchanged; only the queue's hand-off granularity is reduced so one render
-- call cannot monopolize many display frames.

local Audio = {}
local installed = false

local function integer(value, fallback, minimum, maximum)
  value = tonumber(value) or fallback
  value = math.floor(value)
  assert(value >= minimum and value <= maximum, "audio tuning value out of range")
  return value
end

function Audio.install(loveApi, options)
  if installed then return nil end
  assert(type(loveApi) == "table", "love API table required")
  options = options or {}

  local ChipSynth = require("src.core.ChipSynth")
  assert(ChipSynth.MUSIC_BUFFER_SAMPLES == 8192,
    "unexpected upstream music buffer size")
  assert(ChipSynth.MUSIC_BUFFER_COUNT == 32,
    "unexpected upstream music buffer count")

  local bufferSamples = integer(options.bufferSamples, 1024, 256, 8192)
  local bufferCount = integer(options.bufferCount, 128, 4, 256)
  local initialFill = integer(options.initialFill, 4, 1, bufferCount)
  local fillPerCall = integer(options.fillPerCall, 1, 1, 8)

  ChipSynth.MUSIC_BUFFER_SAMPLES = bufferSamples
  ChipSynth.MUSIC_BUFFER_COUNT = bufferCount
  ChipSynth.MUSIC_FILL_INITIAL = initialFill
  ChipSynth.MUSIC_FILL_PER_CALL = fillPerCall

  -- Aggregate synthesis cost from the exact device runtime. This measures the
  -- suspected hot path without logging samples, programs, ROM-derived data or
  -- every buffer call. os.clock is CPU time and is available in PUC Lua even
  -- when the browser does not expose the Long Tasks API correctly.
  local originalSoundData = ChipSynth.soundData
  local calls, samples, totalSeconds, maxSeconds = 0, 0, 0, 0
  local reportStarted = os.clock()
  ChipSynth.soundData = function(engine, count, channels)
    local started = os.clock()
    local result = originalSoundData(engine, count, channels)
    local elapsed = os.clock() - started
    calls = calls + 1
    samples = samples + count
    totalSeconds = totalSeconds + elapsed
    maxSeconds = math.max(maxSeconds, elapsed)
    local now = os.clock()
    if now - reportStarted >= 5 then
      print(("[host-perf] music synth calls=%d samples=%d cpu=%.1fms max=%.1fms slice=%d")
        :format(calls, samples, totalSeconds * 1000, maxSeconds * 1000,
          bufferSamples))
      calls, samples, totalSeconds, maxSeconds = 0, 0, 0, 0
      reportStarted = now
    end
    return result
  end

  local originalEffectData = ChipSynth.renderEffectData
  ChipSynth.renderEffectData = function(...)
    local started = os.clock()
    local result = originalEffectData(...)
    local elapsed = os.clock() - started
    local sampleCount = 0
    if result and type(result.getSampleCount) == "function" then
      local ok, value = pcall(result.getSampleCount, result)
      if ok then sampleCount = value end
    end
    print(("[host-perf] effect synth samples=%d cpu=%.1fms")
      :format(sampleCount, elapsed * 1000))
    return result
  end

  installed = true
  print(("[host-perf] audio slicing samples=%d buffers=%d initial=%d perCall=%d")
    :format(bufferSamples, bufferCount, initialFill, fillPerCall))
  return {
    bufferSamples = bufferSamples,
    bufferCount = bufferCount,
    initialFill = initialFill,
    fillPerCall = fillPerCall,
  }
end

return Audio
