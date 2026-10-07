const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const crypto = require('crypto');

const dbPath = '/home/node/.n8n/database.sqlite';
const db = new DatabaseSync(dbPath);

const wfJson = JSON.parse(fs.readFileSync('/tmp/ultra-cs-workflow.json', 'utf8'));

const existing = db.prepare("SELECT id FROM workflow_entity WHERE id = ?").get(wfJson.id);
const now = new Date().toISOString();
const versionId = crypto.randomUUID();

if (existing) {
  console.log("Updating existing workflow:", wfJson.id);
  db.prepare(`
    UPDATE workflow_entity
    SET name = ?, nodes = ?, connections = ?, settings = ?, staticData = ?, meta = ?, updatedAt = ?, versionId = ?
    WHERE id = ?
  `).run(
    wfJson.name,
    JSON.stringify(wfJson.nodes),
    JSON.stringify(wfJson.connections),
    JSON.stringify(wfJson.settings),
    JSON.stringify(wfJson.staticData),
    JSON.stringify(wfJson.meta),
    now,
    versionId,
    wfJson.id
  );
} else {
  console.log("Inserting brand new workflow:", wfJson.id);
  let projectId = null;
  try {
    const project = db.prepare("SELECT id FROM project LIMIT 1").get();
    if (project) projectId = project.id;
  } catch (e) {
    console.log("No project table:", e.message);
  }

  db.prepare(`
    INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, staticData, meta, versionId, createdAt, updatedAt)
    VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    wfJson.id,
    wfJson.name,
    JSON.stringify(wfJson.nodes),
    JSON.stringify(wfJson.connections),
    JSON.stringify(wfJson.settings),
    JSON.stringify(wfJson.staticData),
    JSON.stringify(wfJson.meta),
    versionId,
    now,
    now
  );

  try {
    const hasShared = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shared_workflow'").get();
    if (hasShared && projectId) {
      db.prepare(`
        INSERT OR REPLACE INTO shared_workflow (workflowId, projectId, role, createdAt, updatedAt)
        VALUES (?, ?, 'workflow:owner', ?, ?)
      `).run(wfJson.id, projectId, now, now);
      console.log("Linked to project:", projectId);
    }
  } catch (err) {
    console.log("Shared workflow mapping note:", err.message);
  }
}

console.log("Workflow successfully installed in database!");
