import sqlite3


DB = ".tmp/n8n-database.sqlite"
OUT = ".tmp/n8n-real-execution-summary.json"
RAW = ".tmp/n8n-execution-raw-flatted.json"
EXECUTION_ID = 17

conn = sqlite3.connect(DB)
cur = conn.cursor()
raw = cur.execute(
    'select data from execution_data where executionId = ?',
    (EXECUTION_ID,),
).fetchone()[0]

with open(RAW, "w", encoding="utf-8") as f:
    f.write(raw)

print(RAW)
