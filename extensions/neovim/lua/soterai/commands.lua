-- User command implementations for the SoterAI IDE Guard Neovim adapter.
--
-- These are thin wrappers: they collect text from the buffer/range, hand it to
-- the loopback broker, and render the broker's decision. No detection logic is
-- performed here.

local M = {}

local broker = require("soterai.broker")

local function options()
  return require("soterai").get()
end

-- Notification helpers ------------------------------------------------------

local function notify(message, level)
  local opts = options()
  if not opts.notify and level == vim.log.levels.INFO then
    return
  end
  vim.notify("[SoterAI] " .. message, level or vim.log.levels.INFO)
end

local function notify_error(message)
  notify(message, vim.log.levels.ERROR)
end

-- Render an arbitrary list of lines in a read-only scratch float.
local function show_float(title, lines)
  local buf = vim.api.nvim_create_buf(false, true)
  vim.api.nvim_buf_set_lines(buf, 0, -1, false, lines)
  vim.bo[buf].modifiable = false
  vim.bo[buf].bufhidden = "wipe"
  vim.bo[buf].filetype = "soterai"

  local width = 0
  for _, line in ipairs(lines) do
    width = math.max(width, #line)
  end
  width = math.min(math.max(width + 2, 30), math.floor(vim.o.columns * 0.8))
  local height = math.min(#lines, math.floor(vim.o.lines * 0.8))

  local win = vim.api.nvim_open_win(buf, true, {
    relative = "editor",
    row = math.floor((vim.o.lines - height) / 2),
    col = math.floor((vim.o.columns - width) / 2),
    width = width,
    height = math.max(height, 1),
    style = "minimal",
    border = "rounded",
    title = " " .. title .. " ",
    title_pos = "center",
  })
  vim.keymap.set("n", "q", function()
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end, { buffer = buf, nowait = true, silent = true })
  vim.keymap.set("n", "<Esc>", function()
    if vim.api.nvim_win_is_valid(win) then
      vim.api.nvim_win_close(win, true)
    end
  end, { buffer = buf, nowait = true, silent = true })
end

-- Text collection -----------------------------------------------------------

-- Return the whole buffer as a single string.
local function buffer_text(bufnr)
  local lines = vim.api.nvim_buf_get_lines(bufnr or 0, 0, -1, false)
  return table.concat(lines, "\n")
end

-- Resolve a line range from a user-command invocation. When the command was
-- given a range, use it; otherwise fall back to the whole buffer. Range is
-- line-wise, which is honest about what we operate on.
local function range_lines(cmd_opts)
  if cmd_opts.range and cmd_opts.range > 0 then
    return cmd_opts.line1, cmd_opts.line2
  end
  return 1, vim.api.nvim_buf_line_count(0)
end

local function range_text(cmd_opts)
  local first, last = range_lines(cmd_opts)
  local lines = vim.api.nvim_buf_get_lines(0, first - 1, last, false)
  return table.concat(lines, "\n"), first, last
end

-- Scan result formatting ----------------------------------------------------

local function categories_string(categories)
  if type(categories) ~= "table" or #categories == 0 then
    return ""
  end
  return table.concat(categories, ", ")
end

local function format_scan(result)
  local lines = {}
  table.insert(lines, "Decision : " .. tostring(result.decision or "unknown"))
  table.insert(lines, "Risk     : " .. tostring(result.riskScore or 0))
  local cats = categories_string(result.categories)
  if cats ~= "" then
    table.insert(lines, "Categories: " .. cats)
  end
  if result.canaryInRequest then
    table.insert(lines, "Canary   : detected in request content")
  end
  if type(result.evidencePreview) == "string" and result.evidencePreview ~= "" then
    table.insert(lines, "")
    table.insert(lines, "Redacted evidence:")
    for _, l in ipairs(vim.split(result.evidencePreview, "\n", { plain = true })) do
      table.insert(lines, "  " .. l)
    end
  end
  return lines
end

-- Report a scan result: short summary via notify, full detail via float when
-- the decision is anything other than a clean allow.
local function report_scan(result)
  local decision = tostring(result.decision or "unknown")
  local summary = string.format(
    "%s | risk %s%s",
    decision,
    tostring(result.riskScore or 0),
    (categories_string(result.categories) ~= "" and (" | " .. categories_string(result.categories)) or "")
  )
  if decision == "block" or decision == "approval_required" then
    notify_error(summary)
  elseif decision == "warn" or decision == "redact" then
    notify(summary, vim.log.levels.WARN)
  else
    notify(summary, vim.log.levels.INFO)
  end
  if decision ~= "allow" then
    show_float("SoterAI scan", format_scan(result))
  end
end

-- Command handlers ----------------------------------------------------------

--- Pre-send egress check for the current selection (or buffer) against a
--- destination URL. This is the choke point that decides whether the text may
--- leave the machine at all, so a non-clearing action is reported as a refusal
--- rather than a note — ASK included, since an unanswered prompt is not consent.
function M.check_egress(cmd_opts)
  local url = cmd_opts and cmd_opts.args
  if not url or vim.trim(url) == "" then
    return notify_error("Usage: :SoterCheckEgress <destination-url>  (checks the current selection or buffer)")
  end
  local content = (cmd_opts and cmd_opts.range and cmd_opts.range > 0)
    and range_text(cmd_opts)
    or buffer_text(0)
  if vim.trim(content) == "" then
    return notify("Nothing to check; the selection/buffer is empty.")
  end

  broker.check_egress(url, content, function(err, decision)
    if err then
      -- Fail closed in the message: an unreachable broker is not clearance.
      return notify_error(err .. " — treat this as NOT cleared to send.")
    end
    local action = decision and decision.action or "UNKNOWN"
    local reasons = categories_string(decision and decision.reasonCodes)
    local host = (decision and decision.host) or url
    if broker.egress_allows_send(action) then
      notify(string.format("Egress %s to %s (risk %s).", action, host, tostring(decision.riskScore or 0)))
    else
      notify_error(string.format(
        "Egress %s to %s (risk %s). %s%s",
        action, host, tostring(decision and decision.riskScore or 0),
        (decision and decision.explanation) or "Not cleared to send.",
        reasons ~= "" and (" [" .. reasons .. "]") or ""
      ))
    end
  end)
end

function M.scan_buffer()
  local content = buffer_text(0)
  if vim.trim(content) == "" then
    return notify("Buffer is empty; nothing to scan.")
  end
  broker.scan(content, function(err, result)
    if err then
      return notify_error(err)
    end
    report_scan(result)
  end)
end

function M.scan_selection(cmd_opts)
  local content = range_text(cmd_opts)
  if vim.trim(content) == "" then
    return notify("Selected range is empty; nothing to scan.")
  end
  broker.scan(content, function(err, result)
    if err then
      return notify_error(err)
    end
    report_scan(result)
  end)
end

function M.redact_selection(cmd_opts)
  local content, first, last = range_text(cmd_opts)
  if vim.trim(content) == "" then
    return notify("Selected range is empty; nothing to redact.")
  end
  local bufnr = vim.api.nvim_get_current_buf()
  broker.redact(content, function(err, result)
    if err then
      return notify_error(err)
    end
    local redacted = type(result) == "table" and result.redacted or nil
    if type(redacted) ~= "string" then
      return notify_error("Broker did not return redacted text.")
    end
    if not vim.api.nvim_buf_is_valid(bufnr) then
      return notify_error("Buffer is no longer valid.")
    end
    local new_lines = vim.split(redacted, "\n", { plain = true })
    vim.api.nvim_buf_set_lines(bufnr, first - 1, last, false, new_lines)
    notify("Range redacted locally by the broker.")
  end)
end

-- Copy a redacted version of the range/buffer to a register (default: system
-- clipboard). The plaintext is never modified in the buffer.
function M.safe_prompt(cmd_opts)
  local content = range_text(cmd_opts)
  if vim.trim(content) == "" then
    return notify("Nothing to prepare for a safe prompt.")
  end
  local reg = options().safe_prompt_register or "+"
  broker.redact(content, function(err, result)
    if err then
      return notify_error(err)
    end
    local redacted = type(result) == "table" and result.redacted or nil
    if type(redacted) ~= "string" then
      return notify_error("Broker did not return redacted text.")
    end
    vim.fn.setreg(reg, redacted)
    notify(string.format("Redacted prompt copied to register '%s'.", reg))
  end)
end

function M.broker_status()
  broker.health(function(err, health)
    if err then
      return notify_error(err)
    end
    local lines = {}
    table.insert(lines, "Broker URL : " .. options().broker_url)
    table.insert(lines, "Status     : " .. tostring(health.status or "unknown"))
    table.insert(lines, "Local only : " .. tostring(health.localOnly))
    if health.host then
      table.insert(lines, "Host       : " .. tostring(health.host))
    end
    if health.startedAt then
      table.insert(lines, "Started at : " .. tostring(health.startedAt))
    end
    -- Follow up with an authenticated safe-mode status query.
    broker.safe_mode_status(function(sm_err, sm)
      if sm_err then
        table.insert(lines, "")
        table.insert(lines, "Safe Mode  : (unavailable — " .. sm_err .. ")")
      else
        table.insert(lines, "")
        table.insert(lines, "Safe Mode  : " .. (sm.enabled and ("enabled (" .. tostring(sm.level) .. ")") or "disabled"))
      end
      show_float("SoterAI broker status", lines)
    end)
  end)
end

function M.safe_mode_on(cmd_opts)
  local level = (cmd_opts and cmd_opts.args and cmd_opts.args ~= "" and cmd_opts.args)
    or options().default_safe_mode_level
  broker.safe_mode_enable(level, function(err, result)
    if err then
      return notify_error(err)
    end
    notify(string.format("Safe Mode enabled (%s).", tostring(result.level or level)))
  end)
end

function M.safe_mode_off()
  broker.safe_mode_disable(function(err)
    if err then
      return notify_error(err)
    end
    notify("Safe Mode disabled.")
  end)
end

function M.memory()
  broker.events_recent(function(err, result)
    if err then
      return notify_error(err)
    end
    local events = (type(result) == "table" and result.events) or {}
    local lines = {}
    if #events == 0 then
      lines = { "No recent events recorded by the broker." }
    else
      table.insert(lines, string.format("Recent broker events (%d):", #events))
      table.insert(lines, "")
      for i, ev in ipairs(events) do
        if type(ev) == "table" then
          local parts = {}
          if ev.decision then
            table.insert(parts, "decision=" .. tostring(ev.decision))
          end
          if ev.riskScore ~= nil then
            table.insert(parts, "risk=" .. tostring(ev.riskScore))
          end
          local cats = categories_string(ev.categories)
          if cats ~= "" then
            table.insert(parts, "categories=" .. cats)
          end
          if ev.contentHash then
            table.insert(parts, "hash=" .. tostring(ev.contentHash))
          end
          if ev.at or ev.timestamp then
            table.insert(parts, "at=" .. tostring(ev.at or ev.timestamp))
          end
          table.insert(lines, string.format("%d. %s", i, table.concat(parts, "  ")))
        else
          table.insert(lines, string.format("%d. %s", i, tostring(ev)))
        end
      end
    end
    show_float("SoterAI recent events (redacted)", lines)
  end)
end

function M.scan_git()
  if vim.fn.executable("git") ~= 1 then
    return notify_error("git was not found on PATH.")
  end
  local diff = vim.fn.system({ "git", "diff" })
  if vim.v.shell_error ~= 0 then
    return notify_error("git diff failed: " .. vim.trim(diff))
  end
  if vim.trim(diff) == "" then
    return notify("git diff is empty; nothing to scan.")
  end
  broker.scan(diff, function(err, result)
    if err then
      return notify_error(err)
    end
    report_scan(result)
  end)
end

-- Registration --------------------------------------------------------------

local registered = false

function M.register()
  if registered then
    return
  end
  registered = true

  local cmd = vim.api.nvim_create_user_command

  cmd("SoterScanBuffer", function()
    M.scan_buffer()
  end, { desc = "SoterAI: scan the current buffer via the local broker" })

  cmd("SoterScanSelection", function(o)
    M.scan_selection(o)
  end, { range = true, desc = "SoterAI: scan the selected line range" })

  cmd("SoterRedactSelection", function(o)
    M.redact_selection(o)
  end, { range = true, desc = "SoterAI: replace the selected range with broker-redacted text" })

  cmd("SoterSafePrompt", function(o)
    M.safe_prompt(o)
  end, { range = true, desc = "SoterAI: copy a redacted prompt to the clipboard register" })

  cmd("SoterBrokerStatus", function()
    M.broker_status()
  end, { desc = "SoterAI: show broker health and Safe Mode status" })

  cmd("SoterSafeModeOn", function(o)
    M.safe_mode_on(o)
  end, {
    nargs = "?",
    complete = function()
      return { "developer", "strict", "enterprise" }
    end,
    desc = "SoterAI: enable Safe Mode [developer|strict|enterprise]",
  })

  cmd("SoterSafeModeOff", function()
    M.safe_mode_off()
  end, { desc = "SoterAI: disable Safe Mode" })

  cmd("SoterMemory", function()
    M.memory()
  end, { desc = "SoterAI: show recent redacted broker events" })

  cmd("SoterScanGit", function()
    M.scan_git()
  end, { desc = "SoterAI: scan `git diff` output via the local broker" })

  cmd("SoterCheckEgress", function(cmd_opts)
    M.check_egress(cmd_opts)
  end, {
    nargs = 1,
    range = true,
    desc = "SoterAI: check whether the selection/buffer may be sent to a destination URL",
  })
end

return M
