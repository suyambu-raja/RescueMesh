# RapidRescue Backend

## Setup

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or simply run:
```bash
run_server.bat
```

## API Documentation

Once running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | ❌ |
| POST | `/api/auth/login` | Login & get JWT | ❌ |
| GET | `/api/auth/me` | Get current user | ✅ |
| GET | `/api/shelters/` | List shelters | ❌ |
| GET | `/api/shelters/{id}` | Get shelter | ❌ |
| POST | `/api/shelters/` | Create shelter | ✅ |
| PATCH | `/api/shelters/{id}` | Update shelter | ✅ |
| GET | `/api/zones/` | List danger zones | ❌ |
| GET | `/api/zones/{id}` | Get danger zone | ❌ |
| POST | `/api/zones/` | Report danger zone | ✅ |
| DELETE | `/api/zones/{id}` | Deactivate zone | ✅ |
| GET | `/api/messages/` | List messages | ✅ |
| POST | `/api/messages/` | Send message | ✅ |
| PATCH | `/api/messages/{id}/read` | Mark as read | ✅ |
| GET | `/api/sos/` | List active SOS | ❌ |
| POST | `/api/sos/` | Trigger SOS | ✅ |
| PATCH | `/api/sos/{id}/status` | Update SOS status | ✅ |
| POST | `/api/location/` | Update location | ✅ |
| GET | `/api/location/history` | Location history | ✅ |
