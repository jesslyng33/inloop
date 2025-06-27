# IMPORTS

import requests
import os

# TOOLS

def fetch_news(topic, max_results=5):
    API_KEY = os.getenv("GNEWS_API_KEY")
    url = "https://gnews.io/api/v4/search"
    params = {
        "q": topic,
        "lang": "en",
        "country": "us",
        "max": max_results,
        "apikey": API_KEY,
    }

    response = requests.get(url, params=params)
    data = response.json()
    return data.get("articles", [])