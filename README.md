## Task
Build a full-featured Flask weather application that:
- Automatically detects the user's location on first load
- Allows searching any city worldwide
- Shows today's live weather and a 5-day hourly forecast
- Allows navigating to any past or future date to see its weather data
- Caches API responses to avoid redundant network calls

## Description
A Flask backend acts as a secure proxy between the browser and the OpenWeatherMap API, keeping the API key off the client side. On first load, the client's IP is resolved via `ip-api.com` to determine their city. The frontend (pure HTML/CSS/JS) fetches data from three Flask endpoints:
- `/api/weather/current` — real-time weather
- `/api/weather/forecast` — 5-day / 3-hour forecast
- `/api/weather/historical` — past weather via One Call API 3.0

A **5-minute JSON cache** sits in the `/cache` directory. Each request is hashed (MD5 of city + coordinates + units) to a `.json` file. If the file exists and is less than 5 minutes old, the cached response is returned immediately — no API call needed.

A calendar **Date Picker** in the top navigation bar handles time travel:
- **Today** → current weather + full hourly carousel
- **Future (up to +5 days)** → forecast data filtered to that specific date
- **Past** → One Call 3.0 timemachine endpoint *(requires enabling One Call plan in your OW account)*

## Installation
Ensure you have **Python 3.10+** installed.

1. Clone the repository and navigate into the project:
```bash
git clone <repository_url>
cd Dark-Sky
```

2. Create and activate a virtual environment:
```bash
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1

# macOS / Linux:
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up your environment variables:
```bash
# Rename the example file
mv .env.example .env
```
Open `.env` and replace `your_openweather_api_key_here` with your actual API key from [openweathermap.org](https://openweathermap.org/api).

> **Note:** Historical (past-date) lookups require enabling the **One Call API 3.0** plan in your OpenWeatherMap account dashboard (free up to 1,000 calls/day).

## Usage
```bash
# Activate venv first (if not already active)
.\venv\Scripts\Activate.ps1   # Windows
source venv/bin/activate       # macOS/Linux

# Start the development server
flask run
```

Open your browser and go to `http://127.0.0.1:5000`.

| Feature | How to use |
|---|---|
| **Auto location** | Loads automatically on startup |
| **Search city** | Type a city name in the search bar, press `Enter` |
| **Today's weather** | Default view, or pick today in the date picker |
| **Future forecast** | Use the Date Picker or click a Day Tab (up to +5 days) |
| **Historical weather** | Pick any past date in the Date Picker |
| **Switch °C / °F** | Click the toggle in the top-left corner |
| **Cache** | Responses are cached in `/cache` for 5 minutes |
