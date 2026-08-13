" autoload/soterai.vim - helper functions for the SoterAI IDE Guard Vim adapter.
"
" This is a THIN adapter. All detection, redaction, and policy logic lives in
" the SoterAI Local AI Broker (loopback HTTP service). This file only builds
" authenticated curl calls and renders the broker's already-redacted results.
"
" It never echoes, logs, or writes the broker auth token anywhere.

let s:default_url = 'http://127.0.0.1:47321'

" --- Configuration -----------------------------------------------------------

function! soterai#BrokerUrl() abort
  let l:url = get(g:, 'soterai_broker_url', s:default_url)
  " Strip a trailing slash so path concatenation stays predictable.
  return substitute(l:url, '/\+$', '', '')
endfunction

" Resolve the broker token from g:soterai_token, then from the token file.
" Returns an empty string when no token is available; callers decide whether
" a given endpoint requires one.
function! soterai#Token() abort
  let l:token = get(g:, 'soterai_token', '')
  if !empty(l:token)
    return l:token
  endif
  let l:path = expand(get(g:, 'soterai_token_file', '~/.soterai/broker/auth-token'))
  if filereadable(l:path)
    " First non-empty line only; ignore trailing newlines/whitespace.
    for l:line in readfile(l:path)
      let l:trimmed = substitute(l:line, '^\s*\|\s*$', '', 'g')
      if !empty(l:trimmed)
        return l:trimmed
      endif
    endfor
  endif
  return ''
endfunction

" --- Low-level request -------------------------------------------------------

" Perform a broker request and return the decoded JSON body (or v:null for an
" empty body). Throws a 'soterai:' prefixed error on transport/HTTP failure.
"
" a:method       - HTTP method string, e.g. 'GET' or 'POST'.
" a:path         - broker path beginning with '/', e.g. '/v1/scan'.
" a:body         - dict to send as a JSON body, or v:null for no body.
" a:authenticated - 0 to omit the Authorization header (only GET /health).
function! soterai#Request(method, path, body, authenticated) abort
  if !executable('curl')
    throw 'soterai: curl was not found on PATH; this adapter requires curl'
  endif

  " Curl reads all options from a config file so the token never appears in
  " the process argument list (which is visible to other local processes).
  let l:config = []
  call add(l:config, 'silent')
  call add(l:config, 'show-error')
  call add(l:config, 'request = ' . s:quote(a:method))
  call add(l:config, 'url = ' . s:quote(soterai#BrokerUrl() . a:path))
  call add(l:config, 'header = ' . s:quote('Accept: application/json'))
  call add(l:config, 'connect-timeout = 3')
  call add(l:config, 'max-time = 20')
  " Surface the HTTP status code on its own trailing line for error handling.
  call add(l:config, 'write-out = ' . s:quote('\n%{http_code}'))

  if a:authenticated
    let l:token = soterai#Token()
    if empty(l:token)
      throw 'soterai: no broker token found. Set g:soterai_token or write '
            \ . '~/.soterai/broker/auth-token'
    endif
    " NOTE: the token lives only inside the temporary, restricted config file.
    call add(l:config, 'header = ' . s:quote('Authorization: Bearer ' . l:token))
  endif

  let l:body_file = ''
  if a:body isnot v:null
    let l:body_file = tempname()
    call writefile([json_encode(a:body)], l:body_file, 'b')
    call add(l:config, 'header = ' . s:quote('Content-Type: application/json'))
    call add(l:config, 'data = ' . s:quote('@' . l:body_file))
  endif

  let l:config_file = tempname()
  call writefile(l:config, l:config_file)

  try
    let l:raw = system('curl --config ' . shellescape(l:config_file))
    let l:exit = v:shell_error
  finally
    " Always shred the temp files; they held the token and/or buffer content.
    call delete(l:config_file)
    if !empty(l:body_file)
      call delete(l:body_file)
    endif
  endtry

  if l:exit != 0
    throw 'soterai: curl failed (exit ' . l:exit . '). Is the Local AI Broker '
          \ . 'running at ' . soterai#BrokerUrl() . '?'
  endif

  " Split the trailing status code we appended via write-out.
  let l:nl = strridx(l:raw, "\n")
  let l:status = str2nr(strpart(l:raw, l:nl + 1))
  let l:body_text = l:nl >= 0 ? strpart(l:raw, 0, l:nl) : l:raw

  if l:status < 200 || l:status >= 300
    throw 'soterai: broker returned HTTP ' . l:status
  endif

  if empty(l:body_text)
    return v:null
  endif
  try
    return json_decode(l:body_text)
  catch
    throw 'soterai: could not parse broker response as JSON'
  endtry
endfunction

" Quote a value for a curl --config file (double-quoted, backslash-escaped).
function! s:quote(value) abort
  let l:escaped = substitute(a:value, '\\', '\\\\', 'g')
  let l:escaped = substitute(l:escaped, '"', '\\"', 'g')
  return '"' . l:escaped . '"'
endfunction

" --- Broker operations -------------------------------------------------------

function! soterai#Scan(content) abort
  return soterai#Request('POST', '/v1/scan', {'content': a:content}, 1)
endfunction

function! soterai#Redact(content) abort
  let l:result = soterai#Request('POST', '/v1/redact', {'content': a:content}, 1)
  return get(l:result, 'redacted', '')
endfunction

function! soterai#Health() abort
  return soterai#Request('GET', '/health', v:null, 0)
endfunction

function! soterai#Version() abort
  return soterai#Request('GET', '/version', v:null, 1)
endfunction

function! soterai#SafeModeStatus() abort
  return soterai#Request('GET', '/v1/safe-mode/status', v:null, 1)
endfunction

" Pre-send egress check. a:payload is the text about to be transmitted, not a
" path to it — the broker scans it for secrets before answering.
function! soterai#CheckEgress(url, payload) abort
  return soterai#Request('POST', '/v1/preflight/network-egress',
        \ {'url': a:url, 'method': 'POST', 'payloadPreview': a:payload}, 1)
endfunction

" Actions that clear a send. ASK is excluded on purpose: it means the user has
" not answered, and reading it as clearance turns a prompt into a silent send.
" Mirrors egressAllowsSend() in @soterai/ide-protocol.
function! soterai#EgressAllowsSend(action) abort
  return index(['ALLOW', 'ALLOW_ONCE', 'ALLOW_WITH_TRANSFORMATION'], a:action) >= 0
endfunction

" Human-readable summary of an egress preflight response.
function! soterai#FormatEgress(result) abort
  let l:action = get(a:result, 'action', 'UNKNOWN')
  let l:lines = []
  call add(l:lines, 'SoterAI egress check')
  call add(l:lines, soterai#EgressAllowsSend(l:action) ? 'Cleared to send' : 'NOT cleared to send')
  call add(l:lines, 'Action   : ' . l:action)
  call add(l:lines, 'Host     : ' . get(a:result, 'host', ''))
  call add(l:lines, 'Risk     : ' . string(get(a:result, 'riskScore', 0)))
  let l:reasons = get(a:result, 'reasonCodes', [])
  if !empty(l:reasons)
    call add(l:lines, 'Reasons  : ' . join(l:reasons, ', '))
  endif
  let l:explanation = get(a:result, 'explanation', '')
  if !empty(l:explanation)
    call add(l:lines, l:explanation)
  endif
  return l:lines
endfunction

" --- Rendering ---------------------------------------------------------------

" Human-readable summary of a /v1/scan response.
function! soterai#FormatScan(result) abort
  let l:lines = []
  call add(l:lines, 'SoterAI scan')
  call add(l:lines, 'Decision : ' . get(a:result, 'decision', 'unknown'))
  call add(l:lines, 'Risk     : ' . string(get(a:result, 'riskScore', 0)))
  let l:cats = get(a:result, 'categories', [])
  if !empty(l:cats)
    call add(l:lines, 'Findings : ' . join(l:cats, ', '))
  endif
  if has_key(a:result, 'contentHash')
    call add(l:lines, 'Hash     : ' . a:result['contentHash'])
  endif
  let l:preview = get(a:result, 'evidencePreview', '')
  if !empty(l:preview)
    call add(l:lines, 'Evidence (redacted): ' . l:preview)
  endif
  return l:lines
endfunction

" Print a short status line in the message area.
function! soterai#Echo(text) abort
  echomsg a:text
endfunction

" Open (or reuse) a read-only scratch buffer and show the given lines.
function! soterai#Scratch(lines) abort
  let l:name = '__SoterAI__'
  let l:winnr = bufwinnr(l:name)
  if l:winnr > 0
    execute l:winnr . 'wincmd w'
  else
    execute 'botright new ' . l:name
  endif
  setlocal buftype=nofile bufhidden=hide noswapfile nowrap
  setlocal modifiable
  silent! %delete _
  call setline(1, a:lines)
  setlocal nomodifiable
  setlocal filetype=soterai
endfunction

" Uniform error surface: strip our prefix and echo as an error.
function! soterai#ReportError(exception) abort
  let l:msg = substitute(a:exception, '^soterai:\s*', '', '')
  echohl ErrorMsg
  echomsg 'SoterAI: ' . l:msg
  echohl None
endfunction
