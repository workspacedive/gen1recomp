function love.conf(t)
    t.identity = "gen1recomp-lovejs-smoke"
    t.version = "11.5"
    t.console = true
    t.window.title = "Gen1Recomp LÖVE Web Probe"
    t.window.width = 160
    t.window.height = 144
    t.window.resizable = false
    t.window.vsync = 1
    t.modules.physics = false
    t.modules.video = false
end
