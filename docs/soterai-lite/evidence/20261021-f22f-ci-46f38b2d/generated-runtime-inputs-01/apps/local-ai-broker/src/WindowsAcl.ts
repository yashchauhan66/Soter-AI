import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

export interface AclMetadata {
    owner: string;
    currentUser: string;
    protected: boolean;
    rules: { sid: string; type: string; rights: number; inherited: boolean }[];
}
const SYSTEM = "S-1-5-18", ADMINISTRATORS = "S-1-5-32-544";
const WRITE_AUTHORITY = 0x000d0156;

/** Metadata validation only; same-user authority and replacement races remain outside coverage. */
export function assertWindowsAcl(acl: AclMetadata, parent = false, allowInheritance = false): void {
    if (!acl || typeof acl.currentUser !== "string" || !/^S-1-5-21-/.test(acl.currentUser)
        || acl.owner !== acl.currentUser || !Array.isArray(acl.rules) || !acl.rules.length
        || (!parent && !allowInheritance && !acl.protected)) throw new Error("Broker Windows ACL is not private and current-user owned");
    const allowed = new Set([acl.currentUser, SYSTEM, ADMINISTRATORS]);
    let ownerFullControl = false;
    for (const rule of acl.rules) {
        if (!Number.isInteger(rule.rights) || rule.rights < 0 || !["Allow", "Deny"].includes(rule.type)) throw new Error("Invalid Windows ACL metadata");
        if (parent) {
            if (rule.type === "Allow" && !allowed.has(rule.sid) && (rule.rights & WRITE_AUTHORITY)) throw new Error("Broker parent grants foreign write authority");
        } else if (!allowed.has(rule.sid) || rule.type !== "Allow" || (!allowInheritance && rule.inherited)) {
            throw new Error("Broker Windows ACL grants access outside owner, SYSTEM and Administrators");
        }
        if (rule.sid === acl.currentUser && rule.type === "Allow" && (rule.rights & 0x1f01ff) === 0x1f01ff) ownerFullControl = true;
    }
    if (!ownerFullControl) throw new Error("Broker Windows ACL must preserve owner full control");
}

const INSPECT = String.raw`
$ErrorActionPreference='Stop'
$p=[Environment]::GetEnvironmentVariable('SOTERAI_ACL_PATH')
$a=Get-Acl -LiteralPath $p
$u=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$r=@($a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]) | ForEach-Object {
 @{sid=$_.IdentityReference.Value;type=$_.AccessControlType.ToString();rights=[int]$_.FileSystemRights;inherited=$_.IsInherited}
})
@{owner=$a.GetOwner([Security.Principal.SecurityIdentifier]).Value;currentUser=$u;protected=$a.AreAccessRulesProtected;rules=$r} | ConvertTo-Json -Depth 5 -Compress
`;
const PROTECT_NEW = String.raw`
$ErrorActionPreference='Stop'
$p=[Environment]::GetEnvironmentVariable('SOTERAI_ACL_PATH')
$a=Get-Acl -LiteralPath $p
$a.SetAccessRuleProtection($true,$true)
Set-Acl -LiteralPath $p -AclObject $a
`;

async function powershell(script: string, target: string): Promise<string> {
    const systemRoot = process.env.SystemRoot;
    if (!systemRoot || !path.win32.isAbsolute(systemRoot)) throw new Error("Windows ACL inspector unavailable; broker file authentication disabled");
    const executable = path.win32.join(systemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    try {
        const result = await promisify(execFile)(executable, ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")], {
            windowsHide: true, timeout: 10000, maxBuffer: 128 * 1024,
            env: { SystemRoot: systemRoot, WINDIR: systemRoot, SOTERAI_ACL_PATH: path.resolve(target) },
        });
        return result.stdout.trim().replace(/^\uFEFF/, "");
    } catch { throw new Error("Windows ACL inspection failed; broker file authentication disabled. No token was read."); }
}
export async function inspectWindowsAcl(target: string): Promise<AclMetadata> {
    return JSON.parse(await powershell(INSPECT, target)) as AclMetadata;
}
export async function validateWindowsPrivatePath(target: string, parent = false): Promise<void> {
    if (process.env.SOTERAI_BROKER_WIN32_ACL_VALIDATE === "0") throw new Error("Windows ACL validation disabled; broker file authentication unavailable");
    assertWindowsAcl(await inspectWindowsAcl(target), parent);
}
/** Only called for a newly exclusively created, still-empty token file. */
export async function protectNewWindowsToken(target: string): Promise<void> {
    assertWindowsAcl(await inspectWindowsAcl(target), false, true);
    await powershell(PROTECT_NEW, target);
    await validateWindowsPrivatePath(target);
}
