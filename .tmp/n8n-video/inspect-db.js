const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const dbPath = path.join(process.env.USERPROFILE, ".n8n", "database.sqlite");
const db = new DatabaseSync(dbPath, { readOnly: true });

const tables = db
  .prepare("select name from sqlite_master where type = 'table' order by name")
  .all()
  .map((row) => row.name);

console.log(tables.join("\n"));
db.close();
