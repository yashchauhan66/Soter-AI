import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import * as os from "node:os";
import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { isPathWithin } from "../security/pathContainment";
import { verifyExistingPath, verifyOutputPath } from "../security/FileSystemPathPolicy";

describe("Workspace path containment policy", () => {
    it("allows a file below the workspace root", () => {
        const root = path.resolve("/workspace/project");
        assert.equal(isPathWithin(root, path.join(root, ".env")), true);
    });

    it("rejects parent traversal outside the workspace", () => {
        const root = path.resolve("/workspace/project");
        assert.equal(isPathWithin(root, path.resolve(root, "..", "secrets.env")), false);
    });

    it("rejects a sibling with a shared textual prefix", () => {
        const root = path.resolve("/workspace/project");
        assert.equal(isPathWithin(root, path.resolve("/workspace/project-copy/.env")), false);
    });

    it("allows separate files within each multi-root workspace independently", () => {
        const first = path.resolve("/workspace/api");
        const second = path.resolve("/workspace/web");
        assert.equal(isPathWithin(first, path.join(first, ".env")), true);
        assert.equal(isPathWithin(second, path.join(second, ".env")), true);
        assert.equal(isPathWithin(first, path.join(second, ".env")), false);
    });
});

describe("Workspace filesystem path policy", () => {
    it("allows a normal existing workspace file and a normal output", async () => {
        const root = await mkdtemp(path.join(os.tmpdir(), "soterai-path-"));
        try {
            const file = path.join(root, ".env");
            await writeFile(file, "TOKEN=test", "utf8");
            assert.equal(await verifyExistingPath(root, file), await realpath(file));
            assert.equal(path.basename(await verifyOutputPath(root, path.join(root, ".env.example"))), ".env.example");
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("rejects a symlink to a file outside the workspace", async (t) => {
        const base = await mkdtemp(path.join(os.tmpdir(), "soterai-link-"));
        const root = path.join(base, "workspace");
        const outside = path.join(base, "outside.env");
        await mkdir(root);
        await writeFile(outside, "TOKEN=outside", "utf8");
        const link = path.join(root, ".env");
        try {
            await symlink(outside, link, "file");
        } catch (error) {
            await rm(base, { recursive: true, force: true });
            t.skip(`symlink unavailable: ${String(error)}`);
            return;
        }
        try {
            await assert.rejects(() => verifyExistingPath(root, link), /symbolic link|resolves outside/);
        } finally {
            await rm(base, { recursive: true, force: true });
        }
    });

    it("rejects an internal symlink and a symlinked output target", async (t) => {
        const root = await mkdtemp(path.join(os.tmpdir(), "soterai-internal-link-"));
        const source = path.join(root, "source.env");
        const link = path.join(root, ".env");
        await writeFile(source, "TOKEN=source", "utf8");
        try {
            await symlink(source, link, "file");
        } catch (error) {
            await rm(root, { recursive: true, force: true });
            t.skip(`symlink unavailable: ${String(error)}`);
            return;
        }
        try {
            await assert.rejects(() => verifyExistingPath(root, link), /symbolic link/);
            await assert.rejects(() => verifyOutputPath(root, link), /symbolic link/);
        } finally {
            await rm(root, { recursive: true, force: true });
        }
    });

    it("rejects a Windows directory junction", { skip: process.platform !== "win32" }, async (t) => {
        const base = await mkdtemp(path.join(os.tmpdir(), "soterai-junction-"));
        const root = path.join(base, "workspace");
        const outside = path.join(base, "outside");
        const junction = path.join(root, "linked");
        await mkdir(root);
        await mkdir(outside);
        await writeFile(path.join(outside, ".env"), "TOKEN=outside", "utf8");
        try {
            await symlink(outside, junction, "junction");
        } catch (error) {
            await rm(base, { recursive: true, force: true });
            t.skip(`junction unavailable: ${String(error)}`);
            return;
        }
        try {
            await assert.rejects(() => verifyExistingPath(root, path.join(junction, ".env")), /symbolic link|resolves outside|junction/);
        } finally {
            await rm(base, { recursive: true, force: true });
        }
    });
});