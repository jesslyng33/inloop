# IMPORTS

import streamlit as st
from openai import OpenAI
from dotenv import load_dotenv
import json
import os
import requests
from tools import fetch_news

# API KEYS

load_dotenv()
openai_api_key = os.getenv("OPENAI_API_KEY")

# BASIC STREAMLIT UI

st.title("In Loop: Your Voice News Companion")

st.write("Ask me anything about today’s news:")

user_input = st.text_input("Your question:")

# VARIABLES

system_prompt = """
You are an intelligent voice-powered news assistant. Do not speak with images.
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
    st.session_state.history.append({"role": "assistant", "content": reply})

    if "TOOL_CALL:" in reply:
        try:
            payload = json.loads(reply.split("TOOL_CALL:")[1].strip())
            if payload["tool"] == "fetch_news":
                articles = fetch_news(payload["topic"])
                articles_text = "\n".join([f"{a['title']}: {a['description']}" for a in articles])
                tool_result = json.dumps({"articles": articles})
                return run_agent(f"Here is the tool result: {tool_result}")
        except Exception as e:
            print("Tool call failed:", e)
    else:
        st.write("\nIn Loop:", reply)
            
if user_input:
    run_agent(user_input)