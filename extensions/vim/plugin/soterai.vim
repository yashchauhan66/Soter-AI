" plugin/soterai.vim - SoterAI IDE Guard adapter for Vim.
"
" Thin adapter: it shells out to curl to reach the SoterAI Local AI Broker on
" loopback and renders the broker's already-redacted results. No detector,
" redaction, or policy logic lives here.
"
" Requirements: Vim 8+ (json_encode/json_decode, tempname) and curl on PATH.
" Configuration:
"   let g:soterai_broker_url = 'http://127.0.0.1:47321'   " optional
"   let g:soterai_token      = '<token>'                  " optional; else file
"   let g:soterai_token_file = '~/.soterai/broker/auth-token'  " optional
"
" Honest limitations: calls are synchronous (curl blocks Vim briefly), there
" is no rich UI, and this adapter cannot observe AI extensions, terminals, or
" prompts it does not itself send to the broker.

if exists('g:loaded_soterai')
  finish
endif
let g:loaded_soterai = 1

if v:version < 800 || !exists('*json_encode') || !exists('*json_decode')
  echohl WarningMsg
  echomsg 'SoterAI: requires Vim 8+ with json_encode/json_decode; adapter not loaded.'
  echohl None
  finish
endif

" --- Command handlers --------------------------------------------------------

" Scan the entire current buffer.
function! s:ScanBuffer() abort
  let l:content = join(getline(1, '$'), "\n")
  call s:ScanContent(l:content)
endfunction

" Scan a line range (invoke as :'<,'>SoterScanSelection or with a count range).
function! s:ScanSelection(first, last) abort
  let l:content = join(getline(a:first, a:last), "\n")
  call s:ScanContent(l:content)
endfunction

function! s:ScanContent(content) abort
  if empty(a:content)
    call soterai#Echo('SoterAI: nothing to scan.')
    return
  endif
  try
    let l:result = soterai#Scan(a:content)
    let l:lines = soterai#FormatScan(l:result)
    call soterai#Scratch(l:lines)
    call soterai#Echo('SoterAI: ' . get(l:result, 'decision', 'unknown')
          \ . ' (risk ' . string(get(l:result, 'riskScore', 0)) . ')')
  catch /^soterai:/
    call soterai#ReportError(v:exception)
  endtry
endfunction

" Redact a line range in place, replacing it with the broker's redacted text.
function! s:RedactRange(first, last) abort
  let l:content = join(getline(a:first, a:last), "\n")
  if empty(l:content)
    call soterai#Echo('SoterAI: nothing to redact.')
    return
  endif
  try
    let l:redacted = soterai#Redact(l:content)
    let l:new_lines = split(l:redacted, "\n", 1)
    " Replace the range: delete old lines, then insert redacted lines.
    execute a:first . ',' . a:last . 'delete _'
    call append(a:first - 1, l:new_lines)
    call soterai#Echo('SoterAI: range redacted locally.')
  catch /^soterai:/
    call soterai#ReportError(v:exception)
  endtry
endfunction

" Report broker health/version/safe-mode without leaking the token.
function! s:BrokerStatus() abort
  let l:lines = ['SoterAI broker status', 'Endpoint : ' . soterai#BrokerUrl()]
  try
    let l:health = soterai#Health()
    call add(l:lines, 'Health   : ' . string(get(l:health, 'status', l:health)))
  catch /^soterai:/
    call add(l:lines, 'Health   : UNREACHABLE (' . substitute(v:exception, '^soterai:\s*', '', '') . ')')
    call soterai#Scratch(l:lines)
    return
  endtry
  try
    let l:version = soterai#Version()
    call add(l:lines, 'Version  : ' . string(get(l:version, 'version', l:version)))
  catch /^soterai:/
    call add(l:lines, 'Version  : ' . substitute(v:exception, '^soterai:\s*', '', ''))
  endtry
  try
    let l:safe = soterai#SafeModeStatus()
    call add(l:lines, 'SafeMode : ' . string(get(l:safe, 'enabled', l:safe)))
  catch /^soterai:/
    call add(l:lines, 'SafeMode : ' . substitute(v:exception, '^soterai:\s*', '', ''))
  endtry
  call soterai#Scratch(l:lines)
endfunction

" Build a safe prompt: redact a range and yank it into a register + scratch
" buffer, so the user pastes the redacted text into an AI chat, not the raw
" source. Defaults to the whole buffer when no range is given.
function! s:SafePrompt(first, last) abort
  let l:content = join(getline(a:first, a:last), "\n")
  if empty(l:content)
    call soterai#Echo('SoterAI: nothing to build a safe prompt from.')
    return
  endif
  try
    let l:redacted = soterai#Redact(l:content)
    let l:register = get(g:, 'soterai_prompt_register', '"')
    call setreg(l:register, l:redacted)
    if has('clipboard')
      call setreg('+', l:redacted)
    endif
    call soterai#Scratch(split(l:redacted, "\n", 1))
    call soterai#Echo('SoterAI: redacted safe prompt yanked into register "'
          \ . l:register . '".')
  catch /^soterai:/
    call soterai#ReportError(v:exception)
  endtry
endfunction

" --- Command definitions -----------------------------------------------------

command! -bar SoterScanBuffer call s:ScanBuffer()
command! -bar -range=% SoterScanSelection call s:ScanSelection(<line1>, <line2>)
command! -bar -range=% SoterRedactRange call s:RedactRange(<line1>, <line2>)
command! -bar SoterBrokerStatus call s:BrokerStatus()
command! -bar -range=% SoterSafePrompt call s:SafePrompt(<line1>, <line2>)
