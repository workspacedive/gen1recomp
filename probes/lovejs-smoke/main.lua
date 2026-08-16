local results = {}
local frameCount = 0
local probeCanvas = nil

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

    report("audio.module", type(love.audio) == "table", type(love.audio))
    report("touch.module", type(love.touch) == "table", type(love.touch))
    report("joystick.module", type(love.joystick) == "table", type(love.joystick))
end

function love.update()
    frameCount = frameCount + 1
    if frameCount == 10 then
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
        love.graphics.setCanvas()
        love.graphics.setColor(1, 1, 1, 1)
        love.graphics.draw(probeCanvas, 0, 0)
    end
end
