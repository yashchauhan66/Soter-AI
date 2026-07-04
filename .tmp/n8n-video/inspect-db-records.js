const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const dbPath = path.join(process.env.USERPROFILE, ".n8n", "database.sqlite");
const db = new DatabaseSync(dbPath, { readOnly: true });

console.log("credentials");
for (const row of db.prepare("select id, name, type, length(data) as dataLength, createdAt, updatedAt from credentials_entity").all()) {
  console.log(JSON.stringify(row));
}

console.log("workflows");
for (const row of db.prepare("select id, name, active, length(nodes) as nodesLength, length(connections) as connectionsLength from workflow_entity").all()) {
  console.log(JSON.stringify(row));
}

db.close();
