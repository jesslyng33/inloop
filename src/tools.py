# IMPORTS

import requests
import os
import openai
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

load_dotenv()

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

def text_to_speech(text):
    """
    Convert text to speech using ElevenLabs API
    Returns the audio data as bytes
    """
    try:
        # Set your ElevenLabs API key
        elevenlabs = ElevenLabs(api_key = os.getenv("ELEVENLABS_API_KEY"))
        
        # Generate audio from text
        audio = elevenlabs.text_to_speech.stream(
            text=text,
            voice_id="JBFqnCBsd6RMkjVDRZzb",
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )

        audio_bytes = b"".join(audio)
        return audio_bytes
        
    except Exception as e:
        print(f"Text-to-speech error: {e}")
        return None