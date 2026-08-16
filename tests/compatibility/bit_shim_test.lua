local native = require("bit")
local shimPath = assert(arg[1], "bit shim path required")
local shim = assert(dofile(shimPath))

local function same(label, actual, expected)
  if actual ~= expected then
    error(string.format("%s: expected %s, got %s", label, tostring(expected), tostring(actual)), 2)
  end
end

local values = {
  -4294967297, -4294967296, -2147483649, -2147483648, -65537, -256, -3, -1,
  0, 1, 2, 3, 15, 16, 255, 256, 65535, 2147483647, 2147483648,
  4294967295, 4294967296, 4294967297,
}
local counts = { -65, -33, -32, -31, -1, 0, 1, 7, 8, 15, 16, 24, 31, 32, 33, 65 }

for _, value in ipairs(values) do
  same("tobit", shim.tobit(value), native.tobit(value))
  same("bnot", shim.bnot(value), native.bnot(value))
  same("bswap", shim.bswap(value), native.bswap(value))
  for _, count in ipairs(counts) do
    same("lshift", shim.lshift(value, count), native.lshift(value, count))
    same("rshift", shim.rshift(value, count), native.rshift(value, count))
    same("arshift", shim.arshift(value, count), native.arshift(value, count))
    same("rol", shim.rol(value, count), native.rol(value, count))
    same("ror", shim.ror(value, count), native.ror(value, count))
  end
  for _, width in ipairs({ -12, -8, -4, -1, 0, 1, 4, 8, 12 }) do
    same("tohex", shim.tohex(value, width), native.tohex(value, width))
  end
end

for _, left in ipairs(values) do
  for _, right in ipairs(values) do
    same("band", shim.band(left, right), native.band(left, right))
    same("bor", shim.bor(left, right), native.bor(left, right))
    same("bxor", shim.bxor(left, right), native.bxor(left, right))
  end
end

math.randomseed(196)
for _ = 1, 2000 do
  local a = math.random(-2147483648, 2147483647)
  local b = math.random(-2147483648, 2147483647)
  local c = math.random(-2147483648, 2147483647)
  same("band3", shim.band(a, b, c), native.band(a, b, c))
  same("bor3", shim.bor(a, b, c), native.bor(a, b, c))
  same("bxor3", shim.bxor(a, b, c), native.bxor(a, b, c))
end

for _, value in ipairs({ -3.5, -2.7, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 2.7, 3.5 }) do
  same("rounded tobit", shim.tobit(value), native.tobit(value))
end
same("infinity", shim.tobit(math.huge), native.tobit(math.huge))
same("negative infinity", shim.tobit(-math.huge), native.tobit(-math.huge))
same("nan", shim.tobit(0 / 0), native.tobit(0 / 0))

for _, name in ipairs({ "band", "bor", "bxor" }) do
  local nativeOk = pcall(native[name])
  local shimOk = pcall(shim[name])
  same(name .. " empty errors", shimOk, nativeOk)
end

print("bit shim parity: passed")
