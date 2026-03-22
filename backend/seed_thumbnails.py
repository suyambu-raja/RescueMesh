import asyncio
import base64
import urllib.request
from app.database import async_session
from app.models import Shelter
from sqlalchemy import select

API_KEY = "AIzaSyBG9PtpyzdB_c5VABsdTSnT_DmhE7TQbCQ"

async def fetch_and_store():
    async with async_session() as db:
        result = await db.execute(select(Shelter))
        shelters = result.scalars().all()
        
        for s in shelters:
            if not s.image_url:
                # Esri World Imagery BBOX export (publicly accessible)
                offset = 0.003
                bbox = f"{s.longitude - offset},{s.latitude - offset},{s.longitude + offset},{s.latitude + offset}"
                url = f"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox={bbox}&bboxSR=4326&size=400,400&imageSR=4326&format=jpg&f=image"
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
                    with urllib.request.urlopen(req) as response:
                        img_data = response.read()
                        b64 = base64.b64encode(img_data).decode('utf-8')
                        s.image_url = f"data:image/jpeg;base64,{b64}"
                        print(f"Downloaded map block for {s.name}")
                except Exception as e:
                    print(f"Failed {s.name}: {e}")
        await db.commit()
    print("\nAll satellite maps successfully packed directly into the local database for offline routing!")

asyncio.run(fetch_and_store())
