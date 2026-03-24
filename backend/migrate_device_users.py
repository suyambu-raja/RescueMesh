"""
Migration script to add device_users table.
Run this once to update an existing database.
Usage: python migrate_device_users.py
"""
import asyncio
from sqlalchemy import text
from app.database import engine


async def migrate():
    async with engine.begin() as conn:
        # Check if table already exists
        result = await conn.execute(
            text("SELECT name FROM sqlite_master WHERE type='table' AND name='device_users'")
        )
        if result.scalar():
            print("✅ device_users table already exists. Skipping.")
            return

        await conn.execute(text("""
            CREATE TABLE device_users (
                user_id VARCHAR(10) PRIMARY KEY,
                display_name VARCHAR(120) DEFAULT 'Rescuer',
                device_info TEXT,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                linked_user_id VARCHAR REFERENCES users(id)
            )
        """))
        print("✅ Created device_users table successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
