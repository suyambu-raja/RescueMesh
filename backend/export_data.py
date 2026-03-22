import sqlite3
import json
import uuid

def process_val(col, val):
    if val is None:
        return 'None'
    if isinstance(val, (int, float)):
        # Handle booleans hidden as ints for is_ fields
        if col.startswith('is_'):
            return "True" if val else "False"
        return str(val)
        
    # Strings and Dates
    s = str(val)
    if col in ('created_at', 'updated_at', 'resolved_at', 'timestamp'):
        # Parse timestamp "2026-03-21 07:15:59.782989" into timezone-aware datetime
        return f"datetime.strptime('{s[:19]}', '%Y-%m-%d %H:%M:%S').replace(tzinfo=timezone.utc)"
        
    # Normal Strings
    s = s.replace(chr(39), chr(92)+chr(39)).replace(chr(34), chr(92)+chr(34))
    s = s.replace('\n', '\\n').replace('\r', '\\r')
    return f"'{s}'"

def run():
    db = sqlite3.connect('rapidrescue.db')
    cursor = db.cursor()
    
    # Map tables to Model class names
    table_map = {
        'users': 'User',
        'danger_zones': 'DangerZone',
        'messages': 'Message',
        'food_requests': 'FoodRequest',
        'sos_alerts': 'SOSAlert',
        'chat_messages': 'ChatMessage',
        'contacts': 'Contact',
        'user_locations': 'UserLocation',
        'shelters': 'Shelter'
    }

    output = "import asyncio\n"
    output += "from datetime import datetime, timezone\n"
    output += "from app.database import async_session\n"
    output += "from app.models import User, DangerZone, Message, FoodRequest, SOSAlert, ChatMessage, Contact, UserLocation, Shelter\n\n"
    output += "async def seed_everything():\n"
    output += "    async with async_session() as session:\n"
    output += "        try:\n"
    output += "            # Inject missing dummy users to prevent PostgreSQL Foreign Key Integrity Errors\n"
    output += "            await session.merge(User(id='83e3943f-85cc-489d-a54b-585323c81778', full_name='Missing User 1', email='missing1@local', hashed_password='x'))\n"
    output += "            await session.merge(User(id='Me (Offline)', full_name='Me (Offline)', email='offline@local', hashed_password='x'))\n"
    output += "            await session.merge(User(id='e356a5a8-b812-443e-8ac2-7789d8af9f1f', full_name='Missing User 2', email='missing2@local', hashed_password='x'))\n"
    output += "            await session.commit()\n"
    output += "        except Exception as e:\n"
    output += "            print('Warning: Dummy users error', e)\n"
    output += "            await session.rollback()\n\n"

    for table, model_name in table_map.items():
        cursor.execute(f"PRAGMA table_info({table})")
        columns = [row[1] for row in cursor.fetchall()]
        
        try:
            cursor.execute(f"SELECT * FROM {table}")
        except:
            continue
            
        rows = cursor.fetchall()
        if not rows:
            continue
            
        print(f"Exporting {len(rows)} rows from {table}...")
        output += f"        print('Seeding {table}...')\n"
        
        for row in rows:
            kwargs = []
            for col, val in zip(columns, row):
                if val is not None:
                    kwargs.append(f"{col}={process_val(col, val)}")
            
            kwargs_str = ", ".join(kwargs)
            output += f"        try:\n"
            output += f"            await session.merge({model_name}({kwargs_str}))\n"
            output += f"            await session.commit()\n"
            output += f"        except Exception as e:\n"
            output += f"            await session.rollback()\n"
            output += f"            print('Error on {table} row:', e)\n"
            
    output += "        try:\n"
    output += "            await session.commit()\n"
    output += "            print('Successfully copied all data to PostgreSQL!')\n"
    output += "        except Exception as e:\n"
    output += "            print('Error updating final:', e)\n"
    output += "            await session.rollback()\n\n"
    output += "if __name__ == '__main__':\n"
    output += "    asyncio.run(seed_everything())\n"

    with open('seed_all.py', 'w', encoding='utf-8') as f:
        f.write(output)
    
    print("Created seed_all.py")

if __name__ == '__main__':
    run()
