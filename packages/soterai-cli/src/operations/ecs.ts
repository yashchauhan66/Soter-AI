import * as fs from "node:fs/promises";
import path from "node:path";
import { verify } from "node:crypto";
import { SecretContentScanner } from "@soterai/guard-core";
import { boundedProcess, digest, durableCreate, exactObject, readStable, type ProcessRunner } from "../security/bounded";

export function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonicalJson((value as Record<string, unknown>)[key])).join(",") + "}";
    return JSON.stringify(value);
}
export interface OwnerPolicy {
    schemaVersion: 1; projectId: string; accountId: string; region: string; clusterArn: string; serviceArn: string; repository: string;
    family: string; containerName: string; taskRoleArn: string; executionRoleArn: string; principalPrefix: string; approvalPublicKey: string; runtimeSecretArns: string[];
}
const POLICY_FIELDS = ["schemaVersion", "projectId", "accountId", "region", "clusterArn", "serviceArn", "repository", "family", "containerName", "taskRoleArn", "executionRoleArn", "principalPrefix", "approvalPublicKey", "runtimeSecretArns"];
export function validateOwnerPolicy(input: unknown): OwnerPolicy {
    exactObject(input, POLICY_FIELDS);
    const p = input as unknown as OwnerPolicy;
    if (POLICY_FIELDS.filter(key=>!["schemaVersion","runtimeSecretArns"].includes(key)).some(key=>typeof input[key]!=="string") || p.schemaVersion !== 1 || !/^[a-zA-Z0-9_-]{1,64}$/.test(p.projectId) || !/^\d{12}$/.test(p.accountId) || !/^[a-z]{2}-[a-z]+-\d$/.test(p.region)
        || !/^[a-zA-Z0-9_-]{1,255}$/.test(p.family) || !/^[a-zA-Z0-9_-]{1,64}$/.test(p.containerName)) throw Error();
    const prefix = `arn:aws:ecs:${p.region}:${p.accountId}:`, cluster = p.clusterArn.slice(prefix.length + "cluster/".length);
    if (!p.clusterArn.startsWith(prefix + "cluster/") || !/^[a-zA-Z0-9_-]{1,255}$/.test(cluster)
        || !p.serviceArn.startsWith(prefix + "service/" + cluster + "/") || !/^[a-zA-Z0-9_-]{1,255}$/.test(p.serviceArn.slice((prefix + "service/" + cluster + "/").length))
        || !p.repository.startsWith(`${p.accountId}.dkr.ecr.${p.region}.amazonaws.com/`) || !/^[a-z0-9][a-z0-9/_-]{0,255}$/.test(p.repository.split("amazonaws.com/")[1])) throw Error();
    for (const arn of [p.taskRoleArn, p.executionRoleArn]) if (!arn.startsWith(`arn:aws:iam::${p.accountId}:role/`) || !/^[a-zA-Z0-9+=,.@_/-]{1,128}$/.test(arn.split(":role/")[1])) throw Error();
    if (!p.principalPrefix.startsWith(`arn:aws:sts::${p.accountId}:assumed-role/`) || !/^[a-zA-Z0-9+=,.@_-]{1,64}\/$/.test(p.principalPrefix.split(":assumed-role/")[1])
        || typeof p.approvalPublicKey !== "string" || p.approvalPublicKey.length > 2048 || !p.approvalPublicKey.startsWith("-----BEGIN PUBLIC KEY-----")
        || !Array.isArray(p.runtimeSecretArns) || p.runtimeSecretArns.length > 32 || new Set(p.runtimeSecretArns).size !== p.runtimeSecretArns.length
        || p.runtimeSecretArns.some(arn => typeof arn !== "string" || !new RegExp(`^arn:aws:(?:secretsmanager:${p.region}:${p.accountId}:secret:[A-Za-z0-9/_+=.@-]{1,256}|ssm:${p.region}:${p.accountId}:parameter/[A-Za-z0-9/_.-]{1,256})$`).test(arn))) throw Error();
    return JSON.parse(canonicalJson(p));
}
export interface ApprovedOperation {
    schemaVersion: 1; operation: "ecs.deploy"; approvalId: string; projectId: string; accountId: string; region: string; clusterArn: string; serviceArn: string;
    repository: string; imageDigest: string; taskTemplateDigest: string; policyDigest: string; issuedAt: number; expiresAt: number;
}
const APPROVAL_FIELDS = ["schemaVersion", "operation", "approvalId", "projectId", "accountId", "region", "clusterArn", "serviceArn", "repository", "imageDigest", "taskTemplateDigest", "policyDigest", "issuedAt", "expiresAt"];
export function validateApprovedOperation(envelope: unknown, policy: OwnerPolicy, template: Buffer, now: number): ApprovedOperation {
    exactObject(envelope, ["payload", "signature"]); exactObject(envelope.payload, APPROVAL_FIELDS);
    const p = envelope.payload as unknown as ApprovedOperation;
    if (typeof envelope.signature !== "string" || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature)
        || !verify(null, Buffer.from(canonicalJson(p)), policy.approvalPublicKey, Buffer.from(envelope.signature, "base64"))) throw Error();
    if (p.schemaVersion !== 1 || p.operation !== "ecs.deploy" || !/^[a-f0-9]{32}$/.test(p.approvalId)
        || ["projectId", "accountId", "region", "clusterArn", "serviceArn", "repository"].some(key => p[key as keyof ApprovedOperation] !== policy[key as keyof OwnerPolicy])
        || !/^[a-f0-9]{64}$/.test(p.imageDigest) || p.taskTemplateDigest !== digest(template) || p.policyDigest !== digest(canonicalJson(policy))
        || !Number.isSafeInteger(p.issuedAt) || !Number.isSafeInteger(p.expiresAt) || p.issuedAt > now || p.expiresAt <= now || p.expiresAt - p.issuedAt > 900000 || p.expiresAt <= p.issuedAt) throw Error();
    return JSON.parse(canonicalJson(p));
}
export function renderTaskTemplate(bytes: Buffer, policy: OwnerPolicy, approved: ApprovedOperation): Buffer {
    if (digest(bytes) !== approved.taskTemplateDigest) throw Error();
    const task = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    exactObject(task, ["family", "networkMode", "requiresCompatibilities", "cpu", "memory", "taskRoleArn", "executionRoleArn", "containerDefinitions"]);
    if (task.family !== policy.family || task.networkMode !== "awsvpc" || canonicalJson(task.requiresCompatibilities) !== '["FARGATE"]'
        || task.cpu !== "256" || task.memory !== "512" || task.taskRoleArn !== policy.taskRoleArn || task.executionRoleArn !== policy.executionRoleArn
        || !Array.isArray(task.containerDefinitions) || task.containerDefinitions.length !== 1) throw Error();
    const c = task.containerDefinitions[0];
    exactObject(c, ["name", "image", "essential", "secrets"], ["portMappings", "logConfiguration", "readonlyRootFilesystem", "user"]);
    if (c.name !== policy.containerName || c.image !== "SOTERAI_APPROVED_IMAGE" || c.essential !== true || !Array.isArray(c.secrets) || c.secrets.length > 32) throw Error();
    const names = new Set<string>();
    for (const secret of c.secrets) { exactObject(secret, ["name", "valueFrom"]); if (typeof secret.name !== "string" || !/^[A-Z_][A-Z0-9_]{0,63}$/.test(secret.name)
        || names.has(secret.name) || !policy.runtimeSecretArns.includes(secret.valueFrom as string)) throw Error(); names.add(secret.name); }
    const scan = new SecretContentScanner().scan(bytes.toString("utf8")); if (!scan.complete || scan.findings.length) throw Error();
    c.image = policy.repository + "@sha256:" + approved.imageDigest;
    return Buffer.from(canonicalJson(task));
}
export interface OperationResult { status: "SUBMITTED" | "DENIED" | "UNKNOWN"; code: string; approvalId?: string; taskDefinitionArn?: string; counts?: { desired: number; pending: number; running: number } }
export interface TrustedOperationRuntime {
    policy: unknown; template: Buffer; approval: unknown; stateDirectory: string; awsExecutable: string;
    assertTrusted(): Promise<void>; runner: ProcessRunner; claim(file: string, bytes: Buffer): Promise<void>;
    credentialEnvironment?: NodeJS.ProcessEnv;
}
/** Called only by the trusted owner service. Agent input has two finite fields. */
export async function executeApprovedOperation(request: unknown, runtime: TrustedOperationRuntime): Promise<OperationResult> {
    let claimed = false, id: string | undefined;
    try {
        exactObject(request, ["operation", "approvalId"]);
        if (request.operation !== "ecs.deploy" || typeof request.approvalId !== "string" || !/^[a-f0-9]{32}$/.test(request.approvalId)) throw Error();
        id = request.approvalId; await runtime.assertTrusted();
        const policy = validateOwnerPolicy(runtime.policy), template = Buffer.from(runtime.template);
        const approved = validateApprovedOperation(runtime.approval, policy, template, Date.now()); if (approved.approvalId !== id) throw Error();
        const rendered = renderTaskTemplate(template, policy, approved);
        const taskFile = path.join(runtime.stateDirectory, id + ".task.json");
        // Revocation and execution compete for this same exclusive decision.
        await runtime.claim(path.join(runtime.stateDirectory, id + ".decision.json"), Buffer.from(canonicalJson({ status: "claimed", approvalId: id, approvalDigest: digest(canonicalJson(approved)) })));
        claimed = true;
        await runtime.claim(taskFile, rendered);
        if (Date.now() >= approved.expiresAt) throw Error();
        const env: NodeJS.ProcessEnv = { PATH: "/usr/bin:/bin", LANG: "C.UTF-8", AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null", AWS_EC2_METADATA_DISABLED: "true", AWS_MAX_ATTEMPTS: "1", AWS_PAGER: "", AWS_REGION: policy.region, AWS_DEFAULT_REGION: policy.region };
        for (const key of ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_SESSION_TOKEN"]) if (runtime.credentialEnvironment?.[key]) env[key] = runtime.credentialEnvironment[key];
        const call = async (service: "sts" | "ecs", args: string[]) => {
            if (Date.now() >= approved.expiresAt) throw Error();
            const output = await runtime.runner({ executable: runtime.awsExecutable, args: [service, ...args, "--region", policy.region,
                "--endpoint-url", `https://${service}.${policy.region}.amazonaws.com`, "--output", "json", "--no-cli-pager", "--cli-connect-timeout", "5", "--cli-read-timeout", "15"], env, timeoutMs: 25000, maxOutputBytes: 262144 });
            return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(output));
        };
        const identity = await call("sts", ["get-caller-identity"]);
        if (identity.Account !== policy.accountId || typeof identity.Arn !== "string" || !identity.Arn.startsWith(policy.principalPrefix)
            || !/^[a-zA-Z0-9+=,.@_-]{2,64}$/.test(identity.Arn.slice(policy.principalPrefix.length))) throw Error();
        const registered = await call("ecs", ["register-task-definition", "--cli-input-json", "file://" + taskFile]);
        const taskArn = registered.taskDefinition?.taskDefinitionArn, taskPrefix = `arn:aws:ecs:${policy.region}:${policy.accountId}:task-definition/${policy.family}:`;
        if (typeof taskArn !== "string" || !taskArn.startsWith(taskPrefix) || !/^[1-9]\d{0,9}$/.test(taskArn.slice(taskPrefix.length))) throw Error();
        const update = await call("ecs", ["update-service", "--cluster", policy.clusterArn, "--service", policy.serviceArn, "--task-definition", taskArn]);
        if (update.service?.serviceArn !== policy.serviceArn || update.service.taskDefinition !== taskArn) throw Error();
        const described = await call("ecs", ["describe-services", "--cluster", policy.clusterArn, "--services", policy.serviceArn]);
        if (!Array.isArray(described.services) || described.services.length !== 1 || !Array.isArray(described.failures) || described.failures.length) throw Error();
        const s = described.services[0]; if (s.serviceArn !== policy.serviceArn || s.taskDefinition !== taskArn || s.status !== "ACTIVE" || [s.desiredCount,s.pendingCount,s.runningCount].some(n => !Number.isSafeInteger(n) || n < 0 || n > 1000000)) throw Error();
        const result: OperationResult = { status: "SUBMITTED", code: "ECS_UPDATE_SUBMITTED_RUNTIME_PENDING", approvalId: id, taskDefinitionArn: taskArn, counts: {desired:s.desiredCount,pending:s.pendingCount,running:s.runningCount} };
        await runtime.claim(path.join(runtime.stateDirectory, id + ".result.json"), Buffer.from(canonicalJson(result)));
        return result;
    } catch { return { status: claimed ? "UNKNOWN" : "DENIED", code: claimed ? "OWNER_RECONCILIATION_REQUIRED" : "TRUST_APPROVAL_OR_SINGLE_USE_REFUSED", ...(id ? {approvalId:id} : {}) }; }
}

/** Linux owner installation only. Windows mode bits cannot establish this trust. */
export async function assertRootOwned(file: string, directory = false): Promise<void> {
    if (process.platform !== "linux" || process.getuid?.() !== 0 || !path.isAbsolute(file)) throw Error();
    let current = path.resolve(file);
    for (;;) {
        const st = await fs.lstat(current);
        if (st.uid !== 0 || st.isSymbolicLink() || st.mode & 0o022 || current === path.resolve(file) && (directory ? !st.isDirectory() : !st.isFile() || st.nlink !== 1)) throw Error();
        const parent = path.dirname(current); if (parent === current) break; current = parent;
    }
}
export async function runOwnerOperation(id: string, revoke = false): Promise<OperationResult> {
    try {
        if (__filename !== "/opt/soterai-owner/owner-broker.cjs") throw Error();
        await assertRootOwned(__filename);
        if (!/^[a-f0-9]{32}$/.test(id)) throw Error();
        const configFile = "/etc/soterai/ecs-broker.json";
        await assertRootOwned(configFile); const config = JSON.parse((await readStable(configFile)).toString());
        exactObject(config, ["policyFile", "templateFile", "approvalsDirectory", "stateDirectory", "awsExecutable"]);
        for (const key of ["policyFile","templateFile","awsExecutable"]) { if (typeof config[key] !== "string") throw Error(); await assertRootOwned(config[key] as string); }
        for (const key of ["approvalsDirectory","stateDirectory"]) { if (typeof config[key] !== "string") throw Error(); await assertRootOwned(config[key] as string,true); }
        const approvalFile = path.join(config.approvalsDirectory as string,id+".json"); await assertRootOwned(approvalFile);
        if (revoke) { await durableCreate(path.join(config.stateDirectory as string,id+".decision.json"),Buffer.from('{"status":"revoked"}')); return {status:"DENIED",code:"APPROVAL_REVOKED",approvalId:id}; }
        return await executeApprovedOperation({operation:"ecs.deploy",approvalId:id},{ policy:JSON.parse((await readStable(config.policyFile as string)).toString()),
            template:await readStable(config.templateFile as string), approval:JSON.parse((await readStable(approvalFile)).toString()), stateDirectory:config.stateDirectory as string,
            awsExecutable:config.awsExecutable as string, assertTrusted:async()=>{await assertRootOwned(configFile);await assertRootOwned(config.stateDirectory as string,true);},
            runner:boundedProcess,claim:durableCreate,credentialEnvironment:process.env });
    } catch { return {status:"DENIED",code:"TRUSTED_LINUX_OWNER_INSTALLATION_REQUIRED"}; }
}
