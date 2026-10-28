# Deliberately unconditional. Dot-sourcing or executing this template refuses.
# A later separately reviewed, new-name binding must implement the contract in
# affected-preparation-binding-01.template.json from actual F27 evidence.
throw 'F27 affected binding is PREPARED_UNBOUND_NOT_EXECUTED. No candidate hash, extraction, current driver or native PASS is bound.'

# Compatibility names retained by the accepted helper bodies. These signatures
# describe the later interface and confer no admission in this template.
function Assert-F26AAffectedInputs { throw 'UNBOUND_F27_AFFECTED_INPUTS' }
function Assert-F26AEditorHost { throw 'UNBOUND_F27_REVIEWED_EDITOR_HOST' }
function Assert-F15bRuntimeBinding {
    param([string]$VsixPath,[string]$ExpectedVsixSha256,[string]$ExtensionRoot,[string]$ExpectedBundleSha256)
    throw 'UNBOUND_F27_ALL_15_ARCHIVE_ENTRIES_AND_FOUR_RUNTIMES'
}
function Get-F26ARuntimeBindings {
    param([string]$ExecutionRoot)
    throw 'UNBOUND_F27_EXACT_EXECUTION_RUNTIME_COPIES'
}
