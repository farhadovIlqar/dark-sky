import os
import re
import json
import hashlib
import requests
from flask import Flask, render_template, request, jsonify
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

# Use /tmp for cache on Vercel (serverless environments)
if os.environ.get('VERCEL'):
    CACHE_DIR = '/tmp/cache'
else:
    CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')

if not os.path.exists(CACHE_DIR):
    os.makedirs(CACHE_DIR, exist_ok=True)
CACHE_TTL_MINUTES = 5


VALID_UNITS = {'metric', 'imperial', 'standard'}
CITY_NAME_RE = re.compile(r"^[a-zA-Z\u00C0-\u024F\s'\-,.]{1,100}$")
MIN_HISTORICAL_TS = int(datetime(1979, 1, 1).timestamp())


def validate_coordinates(lat, lon):
    try:
        lat_f, lon_f = float(lat), float(lon)
    except (TypeError, ValueError):
        return "Coordinates must be numeric values.", 400
    if not (-90 <= lat_f <= 90):
        return f"Latitude must be between -90 and 90 (got {lat_f}).", 400
    if not (-180 <= lon_f <= 180):
        return f"Longitude must be between -180 and 180 (got {lon_f}).", 400
    return None, None


def validate_city(city):
    if not city or not city.strip():
        return "City name cannot be empty.", 400
    if len(city) > 100:
        return "City name is too long (max 100 characters).", 400
    if not CITY_NAME_RE.match(city.strip()):
        return "City name contains invalid characters.", 400
    return None, None


def validate_units(units):
    if units not in VALID_UNITS:
        return f"Units must be one of: {', '.join(sorted(VALID_UNITS))}.", 400
    return None, None


def validate_timestamp(dt):
    try:
        ts = int(dt)
    except (TypeError, ValueError):
        return "'dt' must be a Unix timestamp (integer).", 400
    now_ts = int(datetime.now().timestamp())
    if ts >= now_ts:
        return "Historical timestamp must be in the past.", 400
    if ts < MIN_HISTORICAL_TS:
        return "Historical data is only available from 1979-01-01 onwards.", 400
    return None, None

def get_cache(key: str):
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    if os.path.exists(cache_file):
        mtime = datetime.fromtimestamp(os.path.getmtime(cache_file))
        if datetime.now() - mtime < timedelta(minutes=CACHE_TTL_MINUTES):
            with open(cache_file, 'r') as f:
                return json.load(f)
    return None

def set_cache(key: str, data: dict):
    cache_file = os.path.join(CACHE_DIR, f"{key}.json")
    with open(cache_file, 'w') as f:
        json.dump(data, f)

def make_cache_key(prefix: str, **kwargs) -> str:
    key_str = prefix + "_" + "_".join(f"{k}={v}" for k, v in sorted(kwargs.items()) if v)
    return hashlib.md5(key_str.encode()).hexdigest()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev_key')

BASE_URL = "http://api.openweathermap.org/data/2.5"

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/location')
def get_client_location():
    try:
        client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
        url = "http://ip-api.com/json/"
        if client_ip and not client_ip.startswith("127.") and not client_ip.startswith("192.168."):
            url += client_ip

        response = requests.get(url, timeout=5)
        data = response.json()
        if data.get('status') == 'success':
            return jsonify({
                "city": data['city'],
                "lat": data['lat'],
                "lon": data['lon'],
                "country": data.get('country')
            })
    except Exception as e:
        print(f"Location error: {e}")

    return jsonify({"city": "London", "lat": 51.5074, "lon": -0.1278, "country": "United Kingdom"})


@app.route('/api/weather/current')
def get_current_weather():
    city = request.args.get('city', '').strip() or None
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    units = request.args.get('units', 'metric')

    err, code = validate_units(units)
    if err:
        return jsonify({"error": err}), code

    if city:
        err, code = validate_city(city)
        if err:
            return jsonify({"error": err}), code
    elif lat and lon:
        err, code = validate_coordinates(lat, lon)
        if err:
            return jsonify({"error": err}), code
    else:
        return jsonify({"error": "Please provide a city name or coordinates (lat & lon)."}), 400

    cache_key = make_cache_key("current", city=city, lat=lat, lon=lon, units=units)
    cached = get_cache(cache_key)
    if cached:
        cached['_from_cache'] = True
        return jsonify(cached)

    openweather_api_key = os.environ.get('OPENWEATHER_API_KEY')
    if not openweather_api_key:
        return jsonify({"error": "OpenWeather API key not configured"}), 500

    params = {'appid': openweather_api_key, 'units': units}

    if city:
        url = f"{BASE_URL}/weather"
        params['q'] = city
    else:
        url = f"{BASE_URL}/weather"
        params['lat'] = lat
        params['lon'] = lon

    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if response.status_code != 200:
            return jsonify({"error": data.get("message", "Failed to fetch weather data")}), response.status_code

        set_cache(cache_key, data)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/weather/forecast')
def get_forecast_weather():
    city = request.args.get('city', '').strip() or None
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    units = request.args.get('units', 'metric')

    err, code = validate_units(units)
    if err:
        return jsonify({"error": err}), code

    if city:
        err, code = validate_city(city)
        if err:
            return jsonify({"error": err}), code
    elif lat and lon:
        err, code = validate_coordinates(lat, lon)
        if err:
            return jsonify({"error": err}), code
    else:
        return jsonify({"error": "Please provide a city name or coordinates (lat & lon)."}), 400

    cache_key = make_cache_key("forecast", city=city, lat=lat, lon=lon, units=units)
    cached = get_cache(cache_key)
    if cached:
        cached['_from_cache'] = True
        return jsonify(cached)

    openweather_api_key = os.environ.get('OPENWEATHER_API_KEY')
    if not openweather_api_key:
        return jsonify({"error": "OpenWeather API key not configured"}), 500

    params = {'appid': openweather_api_key, 'units': units}

    if city:
        url = f"{BASE_URL}/forecast"
        params['q'] = city
    else:
        url = f"{BASE_URL}/forecast"
        params['lat'] = lat
        params['lon'] = lon

    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if response.status_code != 200:
            return jsonify({"error": data.get("message", "Failed to fetch forecast data")}), response.status_code

        set_cache(cache_key, data)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/weather/historical')
def get_historical_weather():
    lat = request.args.get('lat')
    lon = request.args.get('lon')
    dt = request.args.get('dt')
    units = request.args.get('units', 'metric')

    if not all([lat, lon, dt]):
        return jsonify({"error": "Please provide lat, lon, and dt (Unix timestamp)."}), 400

    err, code = validate_coordinates(lat, lon)
    if err:
        return jsonify({"error": err}), code

    err, code = validate_units(units)
    if err:
        return jsonify({"error": err}), code

    err, code = validate_timestamp(dt)
    if err:
        return jsonify({"error": err}), code

    cache_key = make_cache_key("historical", lat=lat, lon=lon, dt=dt, units=units)
    cached = get_cache(cache_key)
    if cached:
        cached['_from_cache'] = True
        return jsonify(cached)

    openweather_api_key = os.environ.get('OPENWEATHER_API_KEY')
    if not openweather_api_key:
        return jsonify({"error": "OpenWeather API key not configured"}), 500

    url = "https://api.openweathermap.org/data/3.0/onecall/timemachine"
    params = {
        'lat': lat,
        'lon': lon,
        'dt': dt,
        'units': units,
        'appid': openweather_api_key
    }

    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()

        if response.status_code != 200:
            error_msg = data.get("message", "Failed to fetch historical data")
            if response.status_code == 401:
                error_msg += " (Historical data requires One Call API 3.0 subscription)"
            return jsonify({"error": error_msg}), response.status_code

        set_cache(cache_key, data)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true')
