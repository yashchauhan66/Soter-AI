import sqlite3


DB_PATH = ".tmp/n8n-database.sqlite"


def quote(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

print("tables")
for (name,) in cur.execute("select name from sqlite_master where type='table' order by name"):
    lname = name.lower()
    if (
        lname in ("user", "auth_identity", "credentials_entity", "workflow_entity", "project", "project_relation")
        or "user" in lname
        or "credential" in lname
        or "workflow" in lname
        or "project" in lname
    ):
        print(name)

for table in ["user", "auth_identity", "project", "project_relation", "credentials_entity", "workflow_entity"]:
    print(f"\n{table}")
    try:
        cols = [row[1] for row in cur.execute(f"pragma table_info({quote(table)})")]
        print(cols)
        hidden = {"password", "data", "settings", "personalizationanswers"}
        safe_cols = [col for col in cols if col.lower() not in hidden]
        query = "select " + ", ".join(quote(col) for col in safe_cols) + f" from {quote(table)} limit 10"
        print(cur.execute(query).fetchall())
    except Exception as exc:
        print("ERR", exc)
