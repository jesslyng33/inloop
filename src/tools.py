# IMPORTS

import requests
import os
import openai

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

def transcribe_audio(audio_bytes):
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    if audio_bytes is not None:
        audio_file = open("temp_audio.wav", "wb")
        audio_file.write(audio_bytes.read())
        audio_file.close()
        with open("temp_audio.wav", "rb") as f:
            transcript = client.audio.translations.create(model="whisper-1", file=f)
        return transcript.text
    return None