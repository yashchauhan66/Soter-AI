'use strict';
const e=require('./evidence-lib-01.cjs');let text=e.bytes(e.own('prepare-host-tools-02.cjs')).toString('utf8');
const start=text.indexOf('function hostGuard(s){'),end=text.indexOf('\nfunction modern(s)',start);e.assert(start>=0&&end>start);
const replacement=String.raw`function hostGuard(s){const eol=s.includes('\r\n')?'\r\n':'\n',matches=[...s.matchAll(/^\$ErrorActionPreference[ \t]*=[ \t]*'Stop'/gm)];assert.equal(matches.length,1,'One top-level stop preference required');const witness=matches[0][0];return one(s,witness,witness+eol+". (Join-Path $PSScriptRoot 'host-current-binding-01.ps1')"+eol+'Assert-F22hEditorHost');}`;
text=text.slice(0,start)+replacement+text.slice(end);new (require('node:vm').Script)(text,{filename:'prepare-host-tools-03.cjs'});
e.fs.writeFileSync(e.own('prepare-host-tools-03.cjs'),text,{flag:'wx'});
e.write('host-generator-correction-02.json',{status:'PREPARED_NOT_EXECUTED',previous:e.fact(e.own('prepare-host-tools-02.cjs')),current:e.fact(e.own('prepare-host-tools-03.cjs')),reason:'Generator02 anchor refused spaced error-preference assignments in inherited functional/security helpers before any output writes. Correct anchor accepts horizontal spacing while asserting exactly one top-level Stop assignment. Same source pins, guards, payloads, timers, budgets and no-signals rule. No native run or product correction.'});
console.log('Generator03 prepared; spacing-aware asserted guard anchor only.');
