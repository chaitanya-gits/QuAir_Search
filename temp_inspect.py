from pathlib import Path
import os
import asyncio
import asyncpg

for line in Path('.env').read_text().splitlines():
    if line and not line.startswith('#') and '=' in line:
        k,v = line.split('=',1)
        os.environ.setdefault(k.strip(), v.strip())

dsn = os.environ.get('DATABASE_URL')
print('DATABASE_URL=', dsn)
ssl_arg = 'require' if 'neon.tech' in dsn or 'sslmode=require' in dsn else None
async def check():
    conn = await asyncpg.connect(dsn, ssl=ssl_arg)
    try:
        rows = await conn.fetch("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY table_schema, table_name")
        print('\n'.join(f'{r[0]}.{r[1]}' for r in rows))
    finally:
        await conn.close()

asyncio.run(check())
