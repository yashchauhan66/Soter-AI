'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),{own}=require('./native09-current-admission-01.cjs');
let source=fs.readFileSync(own('prepare-native12-drive-case-text-01.cjs'),'utf8');const before='candidate=candidate.replace(marker,added+marker);';assert(source.includes(before));source=source.replace(before,'candidate=candidate.replace(marker,()=>added+marker);');
const oldLine=source.split('\n').find(x=>x.startsWith('const added='));assert(oldLine);const separator=String.fromCharCode(92).repeat(2);
const added="   $taskPrimaryState=Get-Content -LiteralPath $taskState -Raw -Encoding UTF8|ConvertFrom-Json\n   $taskOfflineRoot=[string]$taskPrimaryState.root\n   if($taskOfflineRoot -notmatch '^D:"+separator+'SoterAI-Lite-test-profiles'+separator+'f26a-precommit-native-[0-9TZ]+-[a-f0-9]{8}'+separator+"workspace$' -or $taskOfflineRoot.Substring(2) -cne $taskWorkspace.Substring(2)){throw 'Only exact primary workspace and initial drive-letter case equivalence are admitted.'}\n";
source=source.replace(oldLine,()=> 'const added='+JSON.stringify(added)+';');
fs.writeFileSync(own('prepare-native12-drive-case-text-02.cjs'),source,{flag:'wx'});console.log('GENERATOR02_CORRECTS_LITERAL_REPLACEMENT_AND_EXPLICIT_REGEX_ENCODING; NO_NATIVE_ACTION');
