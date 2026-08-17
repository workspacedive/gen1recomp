local adapterPath = assert(arg[1], "audio adapter path required")
local files = {}
local originalEffects = 0

local function soundData(samples)
  local pcm = string.rep("\0\0\0\0", samples)
  return {
    getChannelCount = function() return 2 end,
    getSampleRate = function() return 44100 end,
    getBitDepth = function() return 16 end,
    getString = function() return pcm end,
    getSampleCount = function() return samples end,
  }
end

local ChipSynth = {
  MUSIC_BUFFER_SAMPLES = 8192,
  MUSIC_BUFFER_COUNT = 32,
  soundData = function() return soundData(512) end,
  renderEffectData = function()
    originalEffects = originalEffects + 1
    return soundData(10)
  end,
  getChannelVolumes = function() return { 1, 1, 1, 1 } end,
  getChannelPitches = function() return { 1, 1, 1, 1 } end,
  getStereo = function() return true end,
}
local ChipAudio = {}
ChipAudio.newSfx = function(data, name, pitch)
  return ChipSynth.renderEffectData(data, { name = name }, { pitch = pitch })
end
ChipAudio.newCry = function(data, species)
  return ChipSynth.renderEffectData(data, { species = species }, {})
end
package.preload["src.core.ChipSynth"] = function() return ChipSynth end
package.preload["src.core.ChipAudio"] = function() return ChipAudio end

local love = {
  filesystem = {
    getInfo = function(path) return files[path] and {} or nil end,
    read = function(path) return files[path] end,
    createDirectory = function() return true end,
    write = function(path, value) files[path] = value return true end,
    remove = function(path) files[path] = nil return true end,
  },
  sound = {
    newSoundData = function(path)
      assert(files[path]:sub(1, 4) == "RIFF", "cache is not PCM WAV")
      return soundData((#files[path] - 44) / 4)
    end,
  },
}

local Audio = assert(loadfile(adapterPath))()
local config = assert(Audio.install(love))
assert(config.bufferSamples == 512 and config.bufferCount == 256)
assert(config.fillPerCall == 2 and config.cache)
local data = { audio = { generation = 1, programFile = "programs.bin" } }
assert(ChipAudio.newSfx(data, "PRESS_AB", 0):getSampleCount() == 10)
assert(originalEffects == 1)
assert(ChipAudio.newSfx(data, "PRESS_AB", 0):getSampleCount() == 10)
assert(originalEffects == 1, "identical second render did not hit cache")
assert(ChipAudio.newSfx(data, "PRESS_AB", 1):getSampleCount() == 10)
assert(originalEffects == 2, "changed options accepted stale cache")
assert(ChipAudio.newCry(data, "PIKACHU"):getSampleCount() == 10)
assert(originalEffects == 3)
print("audio adapter fake runtime: passed")
