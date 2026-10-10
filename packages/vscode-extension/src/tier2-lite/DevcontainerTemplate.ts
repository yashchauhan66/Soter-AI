export const TIER2_LITE_COVERAGE = "hygiene, not a boundary against same-user native processes; WSL is not a security boundary against the Windows user";

/** Declared hygiene policy, not evidence that an editor's attach helpers obey it. */
export function tier2LiteTemplates(runId: string, baseImage: string) {
    if (!/^[0-9a-f-]{36}$/.test(runId)) throw new Error("Invalid snapshot identity.");
    if (!/^[a-z0-9][a-z0-9./:_-]*@sha256:[0-9a-f]{64}$/.test(baseImage)) {
        throw new Error("A reviewed base image pinned by SHA-256 is required.");
    }
    const hostProfileSettings = {
        "dev.containers.copyGitConfig": false,
        "dev.containers.gitCredentialHelperConfigLocation": "none",
        "dev.containers.dockerCredentialHelper": false,
        "dev.containers.forwardWSLServices": false,
        "dev.containers.mountWaylandSocket": false,
        "dev.containers.defaultExtensions": [],
        "dev.containers.defaultFeatures": {},
        "dotfiles.repository": "",
        "dotfiles.installCommand": "",
        "remote.autoForwardPorts": false,
        "remote.restoreForwardedPorts": false,
        "terminal.integrated.allowLocalTerminal": false,
        "security.workspace.trust.enabled": true,
    };
    const devcontainer = {
        name: `SoterAI public snapshot ${runId}`,
        build: { dockerfile: "Dockerfile", context: "..", options: ["--network=none"] },
        containerUser: "65532:65532",
        remoteUser: "65532",
        updateRemoteUserUID: false,
        userEnvProbe: "none",
        privileged: false,
        capAdd: [],
        mounts: [],
        // A fresh named volume overrides the default host-workspace bind mount.
        workspaceMount: `source=soterai-public-${runId},target=/workspace,type=volume`,
        workspaceFolder: "/workspace/public",
        forwardPorts: [],
        otherPortsAttributes: { onAutoForward: "ignore" },
        runArgs: ["--network=none", "--cap-drop=ALL", "--security-opt=no-new-privileges:true",
            "--pids-limit=128", "--read-only", "--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=64m",
            "--tmpfs=/home/agent:rw,nosuid,nodev,uid=65532,gid=65532,size=512m"],
        containerEnv: {
            HOME: "/home/agent", XDG_CONFIG_HOME: "/home/agent/.config",
            SSH_AUTH_SOCK: "", GPG_AGENT_INFO: "", GIT_ASKPASS: "", SSH_ASKPASS: "",
            GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0",
            GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "credential.helper", GIT_CONFIG_VALUE_0: "",
        },
        remoteEnv: {},
        features: {},
        customizations: { vscode: { extensions: [], settings: hostProfileSettings } },
        shutdownAction: "stopContainer",
    };
    // No downloaded tools, lifecycle scripts, privileged runtime or secret inputs.
    const dockerfile = [`FROM ${baseImage}`, "COPY --chown=65532:65532 public/ /workspace/public/",
        "USER 65532:65532", "WORKDIR /workspace/public", 'CMD ["sleep", "infinity"]', ""].join("\n");
    return {
        devcontainer, dockerfile, hostProfileSettings,
        forwardingPolicy: { gitConfigCopy: false, credentialHelperReuse: false, sshAgentForwarding: false,
            gpgAgentForwarding: false, dockerSocket: false, hostHome: false, hostHistory: false },
        deployment: {
            status: "GENERATED_ONLY" as const,
            imageAndNumericUserCompatibility: "UNTESTED" as const,
            credentialForwardingAtAttach: "INCOMPLETE" as const,
            liveNetworkEnforcement: "UNTESTED" as const,
            onlineMode: "INCOMPLETE_NOT_AVAILABLE" as const,
            prerequisites: ["New isolated host editor profile with these host settings and an empty synthetic home.",
                "No inherited host credentials or active SSH/GPG agents; no credential-service delegation.",
                "Reviewed image supports UID/GID 65532, the editor server and the required offline tools.",
                "Inspect effective attach mounts, environment and credential helpers before any runtime coverage claim.",
                "Future online mode requires a reviewed allowlist enforced outside container writable authority."],
        },
    };
}
