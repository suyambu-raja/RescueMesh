import asyncio
import random
import string
from app.database import engine
from sqlalchemy import text

async def migrate():
    async with engine.begin() as conn:
        queries = [
            "ALTER TABLE users ADD COLUMN user_tag VARCHAR(10)",
            "ALTER TABLE contacts ADD COLUMN user_tag VARCHAR(10)",
            "ALTER TABLE messages ADD COLUMN sender_tag VARCHAR(10)",
            "ALTER TABLE messages ADD COLUMN recipient_tag VARCHAR(10)",
        ]
        for q in queries:
            try:
                await conn.execute(text(q))
                print(f"OK: {q}")
            except Exception as e:
                print(f"Skip (already exists): {e}")

        # Generate tags for existing users
        result = await conn.execute(text("SELECT id FROM users WHERE user_tag IS NULL"))
        rows = result.fetchall()
        for row in rows:
            tag = "U_" + "".join(random.choices(string.ascii_uppercase + string.digits, k=7))
            await conn.execute(text("UPDATE users SET user_tag = :t WHERE id = :i"), {"t": tag, "i": row[0]})
        print(f"Generated tags for {len(rows)} users")
    print("Migration complete!")

asyncio.run(migrate())
