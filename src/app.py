# IMPORTS

import streamlit as st
from openai import OpenAI
from dotenv import load_dotenv
import json
import os
import requests
from tools import fetch_news
from tools import transcribe_audio

# API KEYS

load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")

# BASIC STREAMLIT UI

st.title("In Loop: Your Voice News Companion")

st.write("Ask me anything about today's news:")

# VARIABLES

system_prompt = """
You are an intelligent voice-powered news assistant. Do not speak with images.
You are a witty, funny, and friendly assistant who sometimes adds a touch of humor and charm to your answers.
Your goal is to help users stay informed on current news by fetching and summarizing real news.
If the user asks for news on a topic, return TOOL_CALL in the following format: 'TOOL_CALL: {"tool": "fetch_news", "topic": "TOPIC"}'.
It is your job to determine the best topic to search for based on the user's question.
Here are some examples of user questions and the tool calls you would make:
"What is the latest news on AI regulation?" -> 'TOOL_CALL: {"tool": "fetch_news", "topic": "AI Regulation"}'
"Anything interesting in the Technology world today?" -> 'TOOL_CALL: {"tool": "fetch_news", "topic": "Technology"}'
""Hey, what's going on with TikTok and the US government?"" -> 'TOOL_CALL: {"tool": "fetch_news", "topic": "Tiktok US Government"}'
"Give me the latest news on the stock market" -> 'TOOL_CALL: {"tool": "fetch_news", "topic": "Stock Market"}'
Once you receive TOOL_RESULT, read the articles given and provide a helpful summary."
"""

if "history" not in st.session_state:
    st.session_state.history = [{"role": "system", "content": system_prompt}]

for message in st.session_state.history:
    if message["role"] == "assistant":
        st.markdown(f"**In Loop:** {message['content']}")
    elif message["role"] == "user":
        st.markdown(f"**You:** {message['content']}")

# User input at the bottom, always visible
# user_input = st.text_input("Your question:", key="user_input")
audio_bytes = st.audio_input("Record your question")

# OPENAI CLIENT

client = OpenAI(api_key=openai_api_key)

def run_agent(user_input):
    st.session_state.history.append({"role": "user", "content": user_input})
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=st.session_state.history,
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
                st.write("\nIn Loop:", summary)
                
        except Exception as e:
            print("Tool call failed:", e)
    else:
        st.session_state.history.append({"role": "assistant", "content": reply})
        st.write("\nIn Loop:", reply)
        
# if user_input:
#    run_agent(user_input)

if audio_bytes:
    user_input = transcribe_audio(audio_bytes)
    if user_input:
        st.write(f"Transcribed question: {user_input}")
        run_agent(user_input)