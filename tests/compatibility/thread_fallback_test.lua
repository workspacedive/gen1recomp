local source = assert(arg[1], "Gen1Recomp source path required")
local bootstrapPath = assert(arg[2], "bootstrap path required")
package.path = source .. "/?.lua;" .. source .. "/?/init.lua;" .. package.path

local function same(label, actual, expected)
  if actual ~= expected then
    error(string.format("%s: expected %s, got %s", label, tostring(expected), tostring(actual)), 2)
  end
end

love = {
  thread = {
    newThread = function() error("measured worker construction failure") end,
    getChannel = function() error("channel should not be reached by disabled paths") end,
  },
  timer = { getTime = function() return 0 end },
}

local Bootstrap = assert(dofile(bootstrapPath))
local report = Bootstrap.install(love, {
  disableThreadWorkers = true,
  threadReason = "characterization",
})
same("bootstrap report", report.threadWorker, "disabled")
same("bootstrap BitOp report", report.bitGlobal, "installed")
same("global BitOp installed", type(_G.bit), "table")
same("global BitOp functional", _G.bit.bxor(0xAA, 0x0F), 0xA5)
same("worker constructor hidden", love.thread.newThread, nil)
same("channels preserved", type(love.thread.getChannel), "function")

package.loaded["src.net.Fetch"] = nil
local Fetch = require("src.net.Fetch")
same("fetch availability", Fetch.available(), false)
local fetchId = Fetch.get("https://example.invalid")
local fetchState = Fetch.poll(fetchId)
same("fetch fallback status", fetchState.status, "error")
same("fetch fallback reason", fetchState.err, "background threads unavailable")

package.loaded["src.core.Platform"] = {
  networkValidated = function() return true end,
}
package.loaded["src.update.Check"] = nil
local Check = require("src.update.Check")
Check.start()
local checkState = Check.state()
same("update fallback status", checkState.status, "error")
same("update fallback reason", checkState.error, "background threads unavailable")

package.loaded["src.mods.Job"] = nil
local Job = require("src.mods.Job")
same("mod job availability", Job.available(), false)
local handle, jobError = Job.run({ mods = {} }, "example.mod", "mods/example", "worker.lua", {})
same("mod job handle", handle, nil)
same("mod job fallback reason", jobError, "background jobs are unavailable")

local importer = assert(io.open(source .. "/src/import/RomImporter.lua", "rb"))
local importerSource = importer:read("*a")
importer:close()
assert(importerSource:find('if not (love.thread and love.thread.newThread) then return false end', 1, true),
  "ROM importer no-thread gate missing")
assert(importerSource:find("self:_startExtractCoroutine", 1, true),
  "ROM importer coroutine fallback missing")

print("thread fallback characterization: passed")
