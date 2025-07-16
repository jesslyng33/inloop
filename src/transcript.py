from openai import OpenAI
from dotenv import load_dotenv
import json
import os
import requests

def transcribe_podcast(file_path):
    # Load environment variables
    load_dotenv()
    
    # Initialize OpenAI client
    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    with open(file_path, "rb") as audio_file:
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text"  # or "json" if you want metadata
        )
    return transcript

transcription = transcribe_podcast("test.flac")
print(transcription)