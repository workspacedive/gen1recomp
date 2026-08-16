local results = {}
local frameCount = 0
local accumulator = 0
local fixedTicks = 0
local movingX = 0
local completed = false
local workerStarted = false
local workerDone = false
local workerChannel = nil
local workerThread = nil
local probeCanvas = nil
local FIXED_STEP = 1 / 60

local function clean(value)
    return tostring(value):gsub("[\r\n|]", " ")
end

local function report(name, passed, detail)
    local status = passed and "PASS" or "FAIL"
    local line = "PROBE|" .. clean(name) .. "|" .. status .. "|" .. clean(detail or "")
    print(line)
    results[#results + 1] = { name = name, passed = passed, detail = detail }
end

local function guarded(name, body)
    local ok, detail = pcall(body)
    report(name, ok and detail ~= false, ok and (detail or "ok") or detail)
end

function love.load()
    local major, minor, revision, codename = love.getVersion()
    report("love.version", major == 11 and minor == 5,
        string.format("%d.%d.%d %s", major, minor, revision, codename or ""))

    report("lua.version", _VERSION == "Lua 5.1", _VERSION)
    report("lua.setfenv", type(setfenv) == "function", type(setfenv))
    report("lua.loadstring", type(loadstring) == "function", type(loadstring))
    guarded("lua.bit", function()
        local bitLibrary = require("bit")
        return type(bitLibrary) == "table" and bitLibrary.band(0xf3, 0x0f) == 3
    end)
    guarded("luajit.moduleAbsent", function()
        local available = pcall(require, "jit")
        return not available
    end)
    guarded("ffi.moduleAbsent", function()
        local available = pcall(require, "ffi")
        return not available
    end)

    guarded("graphics.canvas", function()
        probeCanvas = love.graphics.newCanvas(160, 144)
        return probeCanvas:getWidth() == 160 and probeCanvas:getHeight() == 144
    end)

    guarded("graphics.imageData", function()
        local imageData = love.image.newImageData(2, 2)
        imageData:setPixel(0, 0, 1, 0, 0, 1)
        local image = love.graphics.newImage(imageData)
        image:setFilter("nearest", "nearest")
        return image:getWidth() == 2 and image:getHeight() == 2
    end)

    guarded("graphics.shader", function()
        local shader = love.graphics.newShader([[
            vec4 effect(vec4 color, Image texture, vec2 textureCoordinates, vec2 screenCoordinates) {
                return Texel(texture, textureCoordinates) * color;
            }
        ]])
        return shader ~= nil
    end)

    guarded("filesystem.previousSession", function()
        local previous = love.filesystem.read("lovejs-smoke-persistent.txt")
        assert(love.filesystem.write("lovejs-smoke-persistent.txt", "persist-v1"))
        return previous == "persist-v1" and "present" or "not-yet"
    end)

    guarded("filesystem.sessionWrite", function()
        assert(love.filesystem.write("lovejs-smoke.txt", "session-probe"))
        return love.filesystem.read("lovejs-smoke.txt") == "session-probe"
    end)

    guarded("data.sha256", function()
        local digest = love.data.hash("sha256", "gen1recomp")
        return type(digest) == "string" and #digest == 32
    end)

    guarded("timer.monotonic", function()
        local before = love.timer.getTime()
        local after = love.timer.getTime()
        return after >= before
    end)

    guarded("lua.coroutine", function()
        local worker = coroutine.create(function(value) coroutine.yield(value + 1) end)
        local resumed, value = coroutine.resume(worker, 41)
        return resumed and value == 42
    end)

    guarded("audio.queueableBuffer", function()
        local source = love.audio.newQueueableSource(8000, 16, 1, 2)
        local samples = love.sound.newSoundData(64, 8000, 16, 1)
        source:queue(samples)
        local free = source:getFreeBufferCount()
        source:stop()
        return "queued; free=" .. tostring(free)
    end)

    guarded("thread.channel", function()
        local channel = love.thread.getChannel("gen1recomp-smoke")
        channel:clear()
        channel:push("roundtrip")
        return channel:pop() == "roundtrip"
    end)
    report("thread.newThreadCapability", true, type(love.thread.newThread))
    do
        workerChannel = love.thread.getChannel("gen1recomp-smoke-worker")
        workerChannel:clear()
        local started, threadOrError = pcall(love.thread.newThread, "worker.lua")
        if started then
            workerThread = threadOrError
            local ran, startError = pcall(workerThread.start, workerThread)
            if ran then
                workerStarted = true
                report("thread.workerStart", true, "started")
            else
                workerDone = true
                report("thread.workerFallback", true, "unavailable: " .. tostring(startError))
            end
        else
            workerDone = true
            report("thread.workerFallback", true, "unavailable: " .. tostring(threadOrError))
        end
    end
    report("audio.module", type(love.audio) == "table", type(love.audio))
    report("touch.module", type(love.touch) == "table", type(love.touch))
    report("joystick.module", type(love.joystick) == "table", type(love.joystick))
end

function love.update(dt)
    frameCount = frameCount + 1
    accumulator = accumulator + math.min(dt or 0, 0.25)
    while accumulator >= FIXED_STEP do
        accumulator = accumulator - FIXED_STEP
        fixedTicks = fixedTicks + 1
        movingX = (movingX + 1) % 160
    end

    if workerStarted and not workerDone then
        local value = workerChannel:pop()
        if value ~= nil then
            workerDone = true
            report("thread.workerRoundtrip", value == "worker-ok", tostring(value))
        elseif frameCount >= 240 then
            workerDone = true
            local threadError = workerThread and workerThread:getError() or nil
            report("thread.workerRoundtrip", false, threadError or "timeout")
        end
    end

    local ready = fixedTicks >= 5 and (not workerStarted or workerDone)
    if not completed and (ready or frameCount >= 240) then
        completed = true
        report("loop.fixedStep", fixedTicks >= 5 and movingX == fixedTicks % 160,
            string.format("frames=%d ticks=%d x=%d", frameCount, fixedTicks, movingX))
        local failures = 0
        for _, result in ipairs(results) do
            if not result.passed then failures = failures + 1 end
        end
        print(string.format("PROBE_COMPLETE|%s|checks=%d failures=%d",
            failures == 0 and "PASS" or "FAIL", #results, failures))
    end
end

function love.draw()
    if probeCanvas then
        love.graphics.setCanvas(probeCanvas)
        love.graphics.clear(0.055, 0.067, 0.09, 1)
        for y = 0, 8 do
            for x = 0, 9 do
                if (x + y) % 2 == 0 then
                    love.graphics.setColor(0.29, 0.84, 0.5, 1)
                else
                    love.graphics.setColor(0.23, 0.36, 0.82, 1)
                end
                love.graphics.rectangle("fill", x * 16, y * 16, 16, 16)
            end
        end
        love.graphics.setColor(1, 0.85, 0.25, 1)
        love.graphics.rectangle("fill", movingX, 68, 4, 8)
        love.graphics.setCanvas()
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.draw(probeCanvas, 0, 0)
    end
end
