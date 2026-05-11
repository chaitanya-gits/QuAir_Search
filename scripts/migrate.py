import asyncio
import os
from pathlib import Path

import asyncpg


SQL_FILES = [
    "infrastructure/sql/search-schema.sql",
    "infrastructure/sql/analytics-schema.sql",
]


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return

    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


async def main() -> None:
    load_dotenv(Path(".env"))
    dsn = os.environ["DATABASE_URL"]
    ssl_arg = "require" if "neon.tech" in dsn or "sslmode=require" in dsn else None
    conn = await asyncpg.connect(dsn, ssl=ssl_arg)

    try:
        for sql_file in SQL_FILES:
            path = Path(sql_file)
            sql = path.read_text(encoding="utf-8")
            await conn.execute(sql)
            print(f"Applied {sql_file}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
