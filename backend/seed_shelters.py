import asyncio
from app.database import async_session
from app.models import Shelter

chennai_shelters = [
  {"name": "Loyola Shelter Home", "latitude": 13.0604, "longitude": 80.2337, 'total_beds': 500, 'occupied_beds': 120},
  {"name": "Kasturba Gandhi Hospital Shelter", "latitude": 13.0586, "longitude": 80.2805, 'total_beds': 200, 'occupied_beds': 180},
  {"name": "Chepauk Relief Center", "latitude": 13.0630, "longitude": 80.2793, 'total_beds': 800, 'occupied_beds': 20},
  {"name": "Velachery Community Hall Shelter", "latitude": 12.9750, "longitude": 80.2210, 'total_beds': 300, 'occupied_beds': 250},
  {"name": "Tambaram Government School Shelter", "latitude": 12.9249, "longitude": 80.1275, 'total_beds': 1000, 'occupied_beds': 800},
  {"name": "Anna Nagar Relief Camp", "latitude": 13.0878, "longitude": 80.2102, 'total_beds': 400, 'occupied_beds': 100},
  {"name": "Adyar Shelter Center", "latitude": 13.0067, "longitude": 80.2570, 'total_beds': 250, 'occupied_beds': 240},
  {"name": "T. Nagar Community Shelter", "latitude": 13.0418, "longitude": 80.2341, 'total_beds': 350, 'occupied_beds': 180}
]

async def seed():
    async with async_session() as db:
        for s in chennai_shelters:
            db.add(Shelter(**s))
        await db.commit()
    print("Successfully injected all 8 Chennai Shelters into the database!")

asyncio.run(seed())
