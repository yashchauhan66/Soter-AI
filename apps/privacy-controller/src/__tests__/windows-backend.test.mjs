import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import childProcess from 'node:child_process';
import { WindowsBackendInspector, parseVmConfiguration, INSTALLED_BACKEND } from '../WindowsBackend.mjs';
const vm = '11111111-1111-4111-8111-111111111111';
const sample = () => `UUID="${vm}"\nVMState="poweroff"\nclipboard="disabled"\nclipboard_file_transfers="off"\n` +
  'draganddrop="disabled"\nvrde="off"\nusb="off"\nehci="off"\nxhci="off"\nnic1="intnet"\nintnet1="soterai-test"\n' +
  Array.from({length:7},(_,i)=>`nic${i+2}="none"`).join('\n');

test('owner configuration parser records bridge-free internal NIC but never promotes artifact or full claims', () => {
  const parsed = parseVmConfiguration(sample(), vm);
  assert.equal(parsed.hostBridgePresent, false); assert.equal(parsed.networkAdapters[0].type, 'intnet');
  assert.equal(parsed.fullClaim, 'BLOCKED'); assert.equal(parsed.artifactBinding, 'UNVERIFIED');
});
test('missing, duplicate, wrong-instance and unknown relevant fields fail closed', () => {
  for (const text of [sample().replace('usb="off"',''), sample()+'\nusb="off"', sample().replace(vm,'22222222-2222-4222-8222-222222222222'),
    sample().replace('VMState="poweroff"','VMState="future-state"'), sample().replace('nic8="none"','nic8="unexpected"'),
    sample().replace('intnet1="soterai-test"',''), sample()+'\nclipboard=garbage'])
    assert.throws(() => parseVmConfiguration(text, vm));
});
test('clipboard/file-transfer/device/share flags are treated conservatively without exposing host paths', () => {
  for (const text of [sample().replace('clipboard="disabled"','clipboard="bidirectional"'),
    sample().replace('clipboard_file_transfers="off"','clipboard_file_transfers="on"'), sample().replace('xhci="off"','xhci="on"'),
    sample()+'\nSharedFolderNameMachineMapping1="SYNTHETIC_HOST_PATH"\nSharedFolderPathMachineMapping1="SYNTHETIC_HOST_PATH"']) {
    const parsed = parseVmConfiguration(text, vm); assert.equal(parsed.hostBridgePresent, true);
    assert.ok(!JSON.stringify(parsed).includes('SYNTHETIC_HOST_PATH'));
  }
});
test('disabled backend adapter runs no executable and reports no enrollment or protection', async () => {
  const inspector = new WindowsBackendInspector({settingsDirectory:'C:\\owner\\settings'});
  assert.deepEqual(await inspector.inspectConfiguration(vm), {status:'UNVERIFIED',reason:'DISABLED',fullClaim:'BLOCKED'});
});
test('malformed machine references never reach the backend even when the feature is enabled', async () => {
  const inspector = new WindowsBackendInspector({enabled:()=>true,settingsDirectory:'C:\\owner\\settings'});
  assert.equal((await inspector.inspectConfiguration('invalid /other')).status, 'UNVERIFIED');
  assert.throws(()=>new WindowsBackendInspector({settingsDirectory:'relative'}), /OWNER_SETTINGS_DIRECTORY/);
});

const backendUnavailable = process.platform !== 'win32' || !fs.existsSync(INSTALLED_BACKEND.executable);
test('pinned installed binary uses only version/configuration commands and an environment allowlist', {skip:backendUnavailable}, async () => {
  const calls = [];
  const interception = mock.method(childProcess, 'execFile', (file,args,options,callback) => {
    calls.push(args); assert.equal(file, INSTALLED_BACKEND.executable); assert.equal(options.shell, false);
    assert.equal(options.windowsHide, true); assert.equal(options.timeout, 5000);
    assert.deepEqual(Object.keys(options.env).filter(k=>!['VBOX_USER_HOME','SystemRoot','WINDIR','TEMP','TMP'].includes(k)), []);
    queueMicrotask(()=>callback(null,args[0]==='--version'?'7.2.20r175154\n':sample()));
  });
  try {
    const inspector = new WindowsBackendInspector({enabled:()=>true,settingsDirectory:'C:\\owner\\settings'});
    const observed = await inspector.inspectConfiguration(vm);
    assert.equal(observed.status,'CONFIGURATION_OBSERVED'); assert.equal(observed.fullClaim,'BLOCKED');
    assert.deepEqual(calls,[['--version'],['showvminfo',vm,'--machinereadable']]);
  } finally {interception.mock.restore();}
});
test('backend errors return bounded reasons without leaking command output or trying a native fallback', {skip:backendUnavailable}, async () => {
  let calls=0;
  const interception=mock.method(childProcess,'execFile',(_file,_args,_options,callback)=>{
    calls++; queueMicrotask(()=>callback(Error('SYNTHETIC_PRIVATE_ERROR_OUTPUT')));
  });
  try {
    const inspector=new WindowsBackendInspector({enabled:()=>true,settingsDirectory:'C:\\owner\\settings'});
    const result=await inspector.inspectConfiguration(vm);
    assert.deepEqual(result,{status:'UNVERIFIED',reason:'BACKEND_UNAVAILABLE',fullClaim:'BLOCKED'});
    assert.equal(calls,1); assert.ok(!JSON.stringify(result).includes('SYNTHETIC_PRIVATE_ERROR_OUTPUT'));
  } finally {interception.mock.restore();}
});

test('executable byte mismatch prevents any backend command', {skip:backendUnavailable}, async () => {
  const originalOpen=fsPromises.open.bind(fsPromises); let calls=0;
  const fileInterception=mock.method(fsPromises,'open',async (...args)=>{
    const file=await originalOpen(...args); let read=false;
    return {stat:(...options)=>file.stat(...options),close:()=>file.close(),read:async buffer=>{
      if (read) return {bytesRead:0}; read=true; buffer[0]=0; return {bytesRead:1};
    }};
  });
  const commandInterception=mock.method(childProcess,'execFile',()=>{calls++;});
  try {
    const inspector=new WindowsBackendInspector({enabled:()=>true,settingsDirectory:'C:\\owner\\settings'});
    assert.equal((await inspector.inspectConfiguration(vm)).reason,'BACKEND_BINARY_UNVERIFIED');
    assert.equal(calls,0);
  } finally {fileInterception.mock.restore(); commandInterception.mock.restore();}
});
test('disabling inspection during a response withholds observations', {skip:backendUnavailable}, async () => {
  let enabled=true;
  const interception=mock.method(childProcess,'execFile',(_file,_args,_options,callback)=>{
    enabled=false; queueMicrotask(()=>callback(null,'7.2.20r175154\n'));
  });
  try {
    const inspector=new WindowsBackendInspector({enabled:()=>enabled,settingsDirectory:'C:\\owner\\settings'});
    assert.deepEqual(await inspector.inspectConfiguration(vm),{status:'UNVERIFIED',reason:'DISABLED',fullClaim:'BLOCKED'});
  } finally {interception.mock.restore();}
});
test('unexpected backend version stops before VM inspection', {skip:backendUnavailable}, async () => {
  let calls=0;
  const interception=mock.method(childProcess,'execFile',(_file,_args,_options,callback)=>{
    calls++; queueMicrotask(()=>callback(null,'unreviewed-version\n'));
  });
  try {
    const inspector=new WindowsBackendInspector({enabled:()=>true,settingsDirectory:'C:\\owner\\settings'});
    assert.equal((await inspector.inspectConfiguration(vm)).reason,'BACKEND_VERSION_MISMATCH'); assert.equal(calls,1);
  } finally {interception.mock.restore();}
});
