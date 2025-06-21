import streamlit as st
from openai import OpenAI
from dotenv import load_dotenv
import os

st.title("In Loop: Your Voice News Companion")

st.write("Ask me anything about today’s news:")

user_input = st.text_input("Your question:")

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

if user_input:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful news assistant."},
            {"role": "user", "content": f"{user_input}"}
        ]
    )

    answer = response.choices[0].message.content.strip()
    st.write("**In Loop says:**")
    st.write(answer)
