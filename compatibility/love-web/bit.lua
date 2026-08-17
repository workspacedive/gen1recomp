-- Pure Lua 5.1 compatibility implementation of the LuaJIT BitOp API.
-- This is a host shim for runtimes without LuaJIT; Gen1Recomp core is unchanged.

local bit = {}

local TWO32 = 4294967296
local TWO31 = 2147483648
local POW2 = { [0] = 1 }
for i = 1, 32 do POW2[i] = POW2[i - 1] * 2 end

local function roundedInteger(value, argument)
  local number = tonumber(value)
  if number == nil then
    error("bad argument #" .. tostring(argument or 1) .. " (number expected)", 3)
  end
  if number ~= number or number == math.huge or number == -math.huge then
    return 0
  end
  local lower = math.floor(number)
  local fraction = number - lower
  if fraction > 0.5 or (fraction == 0.5 and lower % 2 ~= 0) then
    lower = lower + 1
  end
  return lower
end

local function unsigned(value, argument)
  return roundedInteger(value, argument) % TWO32
end

local function signed(value)
  value = value % TWO32
  if value >= TWO31 then return value - TWO32 end
  return value
end

local and4, or4, xor4 = {}, {}, {}
for left = 0, 15 do
  for right = 0, 15 do
    local index = left * 16 + right
    local a, b = left, right
    local av, ov, xv, place = 0, 0, 0, 1
    for _ = 1, 4 do
      local abit, bbit = a % 2, b % 2
      if abit == 1 and bbit == 1 then av = av + place end
      if abit == 1 or bbit == 1 then ov = ov + place end
      if abit ~= bbit then xv = xv + place end
      a = math.floor(a / 2)
      b = math.floor(b / 2)
      place = place * 2
    end
    and4[index], or4[index], xor4[index] = av, ov, xv
  end
end

local function binary(operation, left, right)
  local result, place = 0, 1
  for _ = 1, 8 do
    local a, b = left % 16, right % 16
    result = result + operation[a * 16 + b] * place
    left = math.floor(left / 16)
    right = math.floor(right / 16)
    place = place * 16
  end
  return result
end

local function reduce(operation, ...)
  local count = select("#", ...)
  if count == 0 then error("bad argument #1 (number expected)", 3) end
  local result = unsigned(select(1, ...), 1)
  for index = 2, count do
    result = binary(operation, result, unsigned(select(index, ...), index))
  end
  return signed(result)
end

function bit.tobit(value)
  return signed(unsigned(value, 1))
end

function bit.bnot(value)
  return signed(TWO32 - 1 - unsigned(value, 1))
end

function bit.band(...)
  return reduce(and4, ...)
end

function bit.bor(...)
  return reduce(or4, ...)
end

function bit.bxor(...)
  return reduce(xor4, ...)
end

local function shiftCount(value)
  return unsigned(value, 2) % 32
end

function bit.lshift(value, count)
  local amount = shiftCount(count)
  return signed((unsigned(value, 1) * POW2[amount]) % TWO32)
end

function bit.rshift(value, count)
  local amount = shiftCount(count)
  return signed(math.floor(unsigned(value, 1) / POW2[amount]))
end

function bit.arshift(value, count)
  local amount = shiftCount(count)
  return signed(math.floor(signed(unsigned(value, 1)) / POW2[amount]))
end

function bit.rol(value, count)
  local amount = shiftCount(count)
  local input = unsigned(value, 1)
  if amount == 0 then return signed(input) end
  local left = (input * POW2[amount]) % TWO32
  local right = math.floor(input / POW2[32 - amount])
  return signed(left + right)
end

function bit.ror(value, count)
  return bit.rol(value, -roundedInteger(count, 2))
end

function bit.bswap(value)
  local input = unsigned(value, 1)
  local byte1 = input % 256
  input = math.floor(input / 256)
  local byte2 = input % 256
  input = math.floor(input / 256)
  local byte3 = input % 256
  local byte4 = math.floor(input / 256) % 256
  return signed(byte1 * 16777216 + byte2 * 65536 + byte3 * 256 + byte4)
end

function bit.tohex(value, digits)
  local width = digits == nil and 8 or roundedInteger(digits, 2)
  local alphabet = width < 0 and "0123456789ABCDEF" or "0123456789abcdef"
  width = math.abs(width)
  if width == 0 then return "" end

  local input = unsigned(value, 1)
  local encoded = ""
  for _ = 1, 8 do
    local nibble = input % 16
    encoded = alphabet:sub(nibble + 1, nibble + 1) .. encoded
    input = math.floor(input / 16)
  end
  if width < 8 then return encoded:sub(9 - width) end
  if width > 8 then return string.rep("0", width - 8) .. encoded end
  return encoded
end

return bit
