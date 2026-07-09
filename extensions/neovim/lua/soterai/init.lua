-- SoterAI IDE Guard — Neovim adapter (thin client)
--
-- This module holds configuration only. All detector, redaction, and policy
-- logic lives in the shared Local AI Broker. Nothing here reimplements a
-- detector, and no raw source/secret/prompt is sent to any cloud by this
-- plugin — it talks to the authenticated loopback broker exclusively.

local M = {}

-- Default configuration. `token` and `token_path` are resolved lazily by the
-- broker client so that a token is never held in this table longer than needed.
M.defaults = {
  -- Base URL of the Local AI Broker. Loopback only by default.
  broker_url = "http://127.0.0.1:47321",

  -- Optional explicit bearer token. Prefer leaving this nil and letting the
  -- client read the token file so the token stays out of your config/dotfiles.
  token = nil,

  -- Path to the broker auth token file. When nil, the client uses
  -- ~/.soterai/broker/auth-token.
  token_path = nil,

  -- Register used by :SoterSafePrompt. "+" is the system clipboard on builds
  -- with clipboard support; fall back to a named register (e.g. '"') otherwise.
  safe_prompt_register = "+",

  -- curl request timeout in seconds.
  timeout = 20,

  -- Default Safe Mode level applied by :SoterSafeModeOn when none is given.
  default_safe_mode_level = "developer",

  -- When true, notifications use vim.log levels; set false to silence info.
  notify = true,
}

M.options = vim.deepcopy(M.defaults)

--- Merge user options over the defaults and register the user commands.
--- Calling setup() is optional; the commands are also registered from
--- plugin/soterai.lua on load. Call setup() to override the broker URL,
--- token path, or clipboard register.
---@param opts table|nil
---@return table options the effective configuration
function M.setup(opts)
  M.options = vim.tbl_deep_extend("force", vim.deepcopy(M.defaults), opts or {})
  require("soterai.commands").register()
  return M.options
end

--- Return the effective configuration table.
---@return table
function M.get()
  return M.options
end

return M
