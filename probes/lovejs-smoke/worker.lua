require("love.thread")
local channel = love.thread.getChannel("gen1recomp-smoke-worker")
channel:push("worker-ok")
