import sqlite3


conn = sqlite3.connect(".tmp/n8n-database.sqlite")
cur = conn.cursor()

tables = [
    row[0]
    for row in cur.execute(
        "select name from sqlite_master where type='table' and name like '%execution%' order by name"
    )
]
print("execution tables", tables)

for table in tables:
    print("\nTABLE", table)
    cols = [row[1] for row in cur.execute(f'pragma table_info("{table}")')]
    print(cols)
    try:
      query_cols = [col for col in cols if col.lower() not in {"data"}]
      query = "select " + ", ".join(f'"{col}"' for col in query_cols) + f' from "{table}" order by 1 desc limit 5'
      for row in cur.execute(query):
          print(row)
    except Exception as exc:
      print("ERR", exc)
