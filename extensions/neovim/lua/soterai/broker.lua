-- HTTP client for the SoterAI Local AI Broker.
--
-- Dependency-free: it shells out to `curl` and parses JSON with Neovim's
-- built-in vim.json. It never writes the bearer token to a log, notification,
-- or buffer. Requests to authenticated endpoints resolve the token per call
-- and drop the reference immediately after the process starts.
--
-- The API is callback-based: request(...) invokes cb(err, data). On Neovim
-- 0.10+ the call is asynchronous via vim.system; on older versions it falls
-- back to a synchronous vim.fn.system call but keeps the same callback shape.

local M = {}

local STATUS_MARKER = "__SOTERAI_STATUS__"

local function config()
  return require("soterai").get()
end

-- JSON helpers that work across Neovim versions.
local function json_encode(value)
  if vim.json and vim.json.encode then
    return vim.json.encode(value)
  end
  return vim.fn.json_encode(value)
end

local function json_decode(text)
  if vim.json and vim.json.decode then
    return vim.json.decode(text)
  end
  return vim.fn.json_decode(text)
end

local function default_token_path()
  local home = (vim.loop and vim.loop.os_homedir and vim.loop.os_homedir())
    or vim.fn.expand("~")
  return home .. "/.soterai/broker/auth-token"
end

--- Resolve the bearer token from config or the token file. Returns token or
--- nil plus an error message. The token value is never logged.
---@return string|nil token
---@return string|nil err
local function resolve_token()
  local opts = config()
  if opts.token and opts.token ~= "" then
    return opts.token
  end
  local path = opts.token_path or default_token_path()
  local fd = io.open(path, "r")
  if not fd then
    return nil, "No broker token configured and token file is not readable: " .. path
  end
  local content = fd:read("*a")
  fd:close()
  local token = vim.trim(content or "")
  if token == "" then
    return nil, "Broker token file is empty: " .. path
  end
  return token
end

--- Split a curl response body from the trailing status marker.
local function split_status(raw)
  raw = raw or ""
  local idx = raw:find(STATUS_MARKER, 1, true)
  if not idx then
    return raw, nil
  end
  local body = raw:sub(1, idx - 1):gsub("\n$", "")
  local status = tonumber((raw:sub(idx + #STATUS_MARKER):gsub("%s+", "")))
  return body, status
end

--- Build the curl argument list. The bearer token is placed into the argument
--- vector (not a shell string) and this vector is not returned to callers.
local function build_args(method, url, token, has_body, timeout)
  local args = {
    "curl",
    "-sS",
    "--max-time",
    tostring(timeout or 20),
    "-X",
    method,
    "-H",
    "Accept: application/json",
    "-w",
    "\n" .. STATUS_MARKER .. "%{http_code}",
  }
  if token then
    table.insert(args, "-H")
    table.insert(args, "Authorization: Bearer " .. token)
  end
  if has_body then
    table.insert(args, "-H")
    table.insert(args, "Content-Type: application/json")
    -- Read the request body from stdin so content never lands on the command
    -- line (avoids process-listing exposure and argument length limits).
    table.insert(args, "--data-binary")
    table.insert(args, "@-")
  end
  table.insert(args, url)
  return args
end

local function finish(raw_stdout, code, stderr, cb)
  if code ~= 0 and (raw_stdout == nil or raw_stdout == "") then
    local detail = (stderr and stderr ~= "" and vim.trim(stderr)) or ("curl exited with " .. tostring(code))
    return cb("Could not reach the Local AI Broker: " .. detail)
  end
  local body, status = split_status(raw_stdout)
  if not status then
    return cb("Unexpected broker response (no status). Is the broker running?")
  end
  if status < 200 or status > 299 then
    return cb("Local broker returned HTTP " .. tostring(status))
  end
  if body == nil or body == "" then
    return cb(nil, {})
  end
  local ok, decoded = pcall(json_decode, body)
  if not ok then
    return cb("Could not parse broker JSON response")
  end
  return cb(nil, decoded)
end

--- Perform a broker request.
---@param method string HTTP method
---@param path string path beginning with "/"
---@param body table|nil request body encoded as JSON
---@param need_auth boolean whether to attach the bearer token
---@param cb fun(err:string|nil, data:table|nil)
function M.request(method, path, body, need_auth, cb)
  if vim.fn.executable("curl") ~= 1 then
    return cb("curl was not found on PATH; the SoterAI Neovim adapter requires curl")
  end

  local opts = config()
  local url = opts.broker_url .. path

  local token = nil
  if need_auth then
    local resolved, err = resolve_token()
    if not resolved then
      return cb(err)
    end
    token = resolved
  end

  local has_body = body ~= nil
  local payload = has_body and json_encode(body) or nil
  local args = build_args(method, url, token, has_body, opts.timeout)
  token = nil -- drop the reference; it now lives only in the argument vector

  -- Async path (Neovim 0.10+).
  if vim.system then
    local sys_opts = { text = true }
    if payload then
      sys_opts.stdin = payload
    end
    vim.system(args, sys_opts, function(obj)
      vim.schedule(function()
        finish(obj.stdout, obj.code, obj.stderr, cb)
      end)
    end)
    return
  end

  -- Synchronous fallback (older Neovim). vim.fn.system feeds `payload` to stdin.
  local raw
  if payload then
    raw = vim.fn.system(args, payload)
  else
    raw = vim.fn.system(args)
  end
  local code = vim.v.shell_error
  vim.schedule(function()
    finish(raw, code, nil, cb)
  end)
end

-- Convenience wrappers matching the broker HTTP contract. -------------------

function M.health(cb)
  M.request("GET", "/health", nil, false, cb)
end

function M.version(cb)
  M.request("GET", "/version", nil, true, cb)
end

function M.scan(content, cb)
  M.request("POST", "/v1/scan", { content = content }, true, cb)
end

function M.scan_messages(messages, cb)
  M.request("POST", "/v1/scan", { messages = messages }, true, cb)
end

function M.redact(content, cb)
  M.request("POST", "/v1/redact", { content = content }, true, cb)
end

function M.safe_mode_status(cb)
  M.request("GET", "/v1/safe-mode/status", nil, true, cb)
end

function M.safe_mode_enable(level, cb)
  M.request("POST", "/v1/safe-mode/enable", { level = level }, true, cb)
end

function M.safe_mode_disable(cb)
  M.request("POST", "/v1/safe-mode/disable", nil, true, cb)
end

function M.events_recent(cb)
  M.request("GET", "/v1/events/recent", nil, true, cb)
end

function M.memory_session(session_id, cb)
  M.request("GET", "/v1/memory/session/" .. tostring(session_id), nil, true, cb)
end

--- Pre-send egress check: may this text go to this destination at all?
--- `payload` is the text about to be transmitted, not a path to it.
function M.check_egress(url, payload, cb)
  M.request("POST", "/v1/preflight/network-egress", {
    url = url,
    method = "POST",
    payloadPreview = payload,
  }, true, cb)
end

--- Actions that clear a send. ASK is excluded on purpose: it means the user
--- has not answered, and reading it as clearance turns a prompt into a silent
--- send. Mirrors egressAllowsSend() in @soterai/ide-protocol.
local EGRESS_SEND_OK = {
  ALLOW = true,
  ALLOW_ONCE = true,
  ALLOW_WITH_TRANSFORMATION = true,
}

function M.egress_allows_send(action)
  return EGRESS_SEND_OK[action or ""] == true
end

return M
