-- Cooperative main-thread audio scheduling and private rendered-effect caching
-- for hosts where love.thread workers are unavailable. The synth, sample rate,
-- channel programs and per-sample algorithm remain unchanged.

local Audio = {}
local installed = false

local function integer(value, fallback, minimum, maximum)
  value = math.floor(tonumber(value) or fallback)
  assert(value >= minimum and value <= maximum, "audio tuning value out of range")
  return value
end

local function canonical(value, seen, depth)
  depth = depth or 0
  if depth > 24 then error("audio cache signature is too deep") end
  local kind = type(value)
  if kind == "nil" then return "n" end
  if kind == "boolean" then return value and "b1" or "b0" end
  if kind == "number" then return "d" .. ("%.17g"):format(value) end
  if kind == "string" then return "s" .. #value .. ":" .. value end
  if kind ~= "table" then error("unsupported audio cache signature type: " .. kind) end
  seen = seen or {}
  if seen[value] then error("cyclic audio cache signature") end
  seen[value] = true
  local items = {}
  for key, item in pairs(value) do
    local encodedKey = canonical(key, seen, depth + 1)
    items[#items + 1] = encodedKey .. "=" .. canonical(item, seen, depth + 1)
  end
  seen[value] = nil
  table.sort(items)
  return "t" .. #items .. "{" .. table.concat(items, ";") .. "}"
end

local function rollingHash(value, seed, multiplier)
  local result = seed
  for index = 1, #value do
    result = (result * multiplier + value:byte(index)) % 4294967296
  end
  return result
end

local function little16(value)
  return string.char(value % 256, math.floor(value / 256) % 256)
end

local function little32(value)
  return string.char(
    value % 256,
    math.floor(value / 256) % 256,
    math.floor(value / 65536) % 256,
    math.floor(value / 16777216) % 256)
end

local function wavData(soundData)
  local channels = soundData:getChannelCount()
  local rate = soundData:getSampleRate()
  local bits = soundData:getBitDepth()
  if channels ~= 2 or rate ~= 44100 or bits ~= 16 then return nil end
  local pcm = soundData:getString()
  local block = channels * bits / 8
  return "RIFF" .. little32(36 + #pcm) .. "WAVE"
    .. "fmt " .. little32(16) .. little16(1) .. little16(channels)
    .. little32(rate) .. little32(rate * block) .. little16(block)
    .. little16(bits) .. "data" .. little32(#pcm) .. pcm
end

local function safeLabel(value)
  return tostring(value or "unknown"):gsub("[^%w_.:-]", "_"):sub(1, 80)
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

  local bufferSamples = integer(options.bufferSamples, 512, 256, 8192)
  local bufferCount = integer(options.bufferCount, 256, 4, 512)
  local initialFill = integer(options.initialFill, 4, 1, bufferCount)
  local fillPerCall = integer(options.fillPerCall, 2, 1, 8)

  ChipSynth.MUSIC_BUFFER_SAMPLES = bufferSamples
  ChipSynth.MUSIC_BUFFER_COUNT = bufferCount
  ChipSynth.MUSIC_FILL_INITIAL = initialFill
  ChipSynth.MUSIC_FILL_PER_CALL = fillPerCall

  local game = os.getenv("POKEPORT_GAME")
  local cacheNamespace = os.getenv("POKEPORT_AUDIO_CACHE_NAMESPACE")
  local cacheEnabled = os.getenv("POKEPORT_AUDIO_CACHE") == "1"
    and type(game) == "string" and game:match("^[%w_-]+$")
    and type(cacheNamespace) == "string" and #cacheNamespace <= 80
    and cacheNamespace:match("^[%w_.-]+$")
  local cacheDirectory = cacheEnabled
    and (game .. "/audio-render-cache-" .. cacheNamespace) or nil
  local effectContext = "effect:unknown"

  local function effectSignature(data, header, effectOptions)
    return canonical({
      schema = 1,
      game = game,
      namespace = cacheNamespace,
      generation = data and data.audio and data.audio.generation,
      programFile = data and data.audio and data.audio.programFile,
      header = header,
      options = effectOptions,
      volume = ChipSynth.getChannelVolumes(),
      pitch = ChipSynth.getChannelPitches(),
      stereo = ChipSynth.getStereo(),
    })
  end

  local function cachePaths(signature)
    local first = rollingHash(signature, 5381, 33)
    local second = rollingHash(signature, 17, 65599)
    local name = ("%08x-%08x-%d"):format(first, second, #signature)
    return cacheDirectory .. "/" .. name .. ".wav",
      cacheDirectory .. "/" .. name .. ".key"
  end

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
  ChipSynth.renderEffectData = function(data, header, effectOptions)
    local started = os.clock()
    local signature, wavPath, keyPath
    if cacheDirectory then
      local ok, value = pcall(effectSignature, data, header, effectOptions)
      if ok then
        signature = value
        wavPath, keyPath = cachePaths(signature)
        if loveApi.filesystem.getInfo(wavPath)
            and loveApi.filesystem.read(keyPath) == signature then
          local decoded, cached = pcall(loveApi.sound.newSoundData, wavPath)
          if decoded and cached then
            print(("[host-perf] effect cache=hit label=%s samples=%d cpu=%.1fms")
              :format(safeLabel(effectContext), cached:getSampleCount(),
                (os.clock() - started) * 1000))
            return cached
          end
          pcall(loveApi.filesystem.remove, wavPath)
          pcall(loveApi.filesystem.remove, keyPath)
        end
      end
    end

    local result = originalEffectData(data, header, effectOptions)
    local elapsed = os.clock() - started
    local sampleCount = result and result:getSampleCount() or 0
    local stored = false
    if result and signature and wavPath and keyPath then
      local encoded = wavData(result)
      if encoded and loveApi.filesystem.createDirectory(cacheDirectory) then
        local wroteWav = loveApi.filesystem.write(wavPath, encoded)
        local wroteKey = wroteWav and loveApi.filesystem.write(keyPath, signature)
        stored = not not wroteKey
        if not stored then
          pcall(loveApi.filesystem.remove, wavPath)
          pcall(loveApi.filesystem.remove, keyPath)
        end
      end
    end
    print(("[host-perf] effect cache=%s label=%s samples=%d cpu=%.1fms")
      :format(stored and "store" or "miss", safeLabel(effectContext),
        sampleCount, elapsed * 1000))
    return result
  end

  -- Load ChipAudio now, after publishing the host constants, then attach names
  -- around its public constructors so renderEffectData telemetry is actionable.
  local ChipAudio = require("src.core.ChipAudio")
  local originalNewSfx = ChipAudio.newSfx
  ChipAudio.newSfx = function(data, name, ...)
    local previous = effectContext
    effectContext = "sfx:" .. safeLabel(name)
    local ok, a, b = pcall(originalNewSfx, data, name, ...)
    effectContext = previous
    if not ok then error(a, 0) end
    return a, b
  end
  local originalNewCry = ChipAudio.newCry
  ChipAudio.newCry = function(data, species, ...)
    local previous = effectContext
    effectContext = "cry:" .. safeLabel(species)
    local ok, a, b = pcall(originalNewCry, data, species, ...)
    effectContext = previous
    if not ok then error(a, 0) end
    return a, b
  end

  installed = true
  print(("[host-perf] audio slicing samples=%d buffers=%d initial=%d perCall=%d cache=%s")
    :format(bufferSamples, bufferCount, initialFill, fillPerCall,
      cacheDirectory and "private" or "off"))
  return {
    bufferSamples = bufferSamples,
    bufferCount = bufferCount,
    initialFill = initialFill,
    fillPerCall = fillPerCall,
    cache = cacheDirectory ~= nil,
  }
end

return Audio
