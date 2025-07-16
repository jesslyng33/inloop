# IMPORTS

# import streamlit as st
from openai import OpenAI
from dotenv import load_dotenv
import json
import os
import openai
from elevenlabs.client import ElevenLabs
import requests

# set up openai client

load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=openai_api_key)
history = []


# FUNCTION: takes in user_input in text and returns chat output in audio
def run_agent(user_input):
    if "history" not in st.session_state:
        st.session_state.history = []
    history.append({"role": "user", "content": user_input})
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=history,
        temperature=0.7,
    )
    reply = response.choices[0].message.content.strip()

    if "TOOL_CALL:" in reply:
        try:
            payload = json.loads(reply.split("TOOL_CALL:")[1].strip())
            if payload["tool"] == "fetch_news":
                articles = fetch_news(payload["topic"])
                articles_text = "\n".join([f"{a['title']}: {a['description']}" for a in articles])
                summary_prompt = (
                    f"Based on the following news articles, answer the user's question in exactly two clear sentences:\n\n"
                    f"User's question: {user_input}\n\n"
                    f"Articles:\n{articles_text}"
                )
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant that summarizes news in two clear sentences."},
                        {"role": "user", "content": summary_prompt}
                    ],
                    temperature=0.7,
                )
                summary = response.choices[0].message.content.strip()
                st.session_state.history.append({"role": "assistant", "content": summary})
                
                # display text and generate speech
                st.write("**In Loop:**", summary)
                audio_data = text_to_speech(summary)
                if audio_data:
                    st.audio(audio_data, format="audio/mp3")
                    return audio_data
                else:
                    st.write("Failed to generate audio")
                
        except Exception as e:
            print("Tool call failed:", e)
            st.write(f"Error: {e}")
    else:
        st.session_state.history.append({"role": "assistant", "content": reply})
        
        # Display text and generate speech
        st.write("**In Loop:**", reply)
        audio_data = text_to_speech(reply)
        if audio_data:
            st.audio(audio_data, format="audio/mp3")
            return audio_data
        else:
            st.write("Failed to generate audio")

# FUNCTION: takes in audio and returns text
def transcribe_audio(audio_bytes):
    client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    if audio_bytes is not None:
        audio_file = open("temp_audio.m4a", "wb")
        audio_file.write(audio_bytes.read())
        audio_file.close()
        with open("temp_audio.m4a", "rb") as f:
            transcript = client.audio.translations.create(model="whisper-1", file=f)
        return transcript.text
    return None

# FUNCTION: takes in text and returns audio
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
        print("length", len(audio_bytes))
        
        return audio_bytes
        
    except Exception as e:
        print(f"Text-to-speech error: {e}")
        return None

# FUNCTION: fetches news
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







