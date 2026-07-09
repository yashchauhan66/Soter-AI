-- Entry point for the SoterAI IDE Guard Neovim adapter.
--
-- Registers the :Soter* user commands on load so they are available without
-- calling require("soterai").setup(). setup() remains optional and is only
-- needed to override configuration (broker URL, token path, clipboard
-- register). Registration is idempotent.

if vim.g.loaded_soterai then
  return
end
vim.g.loaded_soterai = true

if vim.fn.has("nvim-0.7") ~= 1 then
  vim.schedule(function()
    vim.notify("[SoterAI] requires Neovim 0.7 or newer", vim.log.levels.WARN)
  end)
  return
end

-- Defer requiring the implementation until the scheduler is free so that a
-- syntax/runtime error here cannot break startup for unrelated plugins.
local ok, err = pcall(function()
  require("soterai.commands").register()
end)

if not ok then
  vim.schedule(function()
    vim.notify("[SoterAI] failed to register commands: " .. tostring(err), vim.log.levels.ERROR)
  end)
end
