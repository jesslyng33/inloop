# IMPORTS

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from funcs import run_agent, transcribe_audio
import io

# API

app = FastAPI()

# ROUTES

# POST - when user speaks on front end and sends audio to backend
@app.post("/run")
async def run_voice_pipeline(audio: UploadFile = File(...)):
    
    # transcribe audio (audio to text)
    audio_bytes = await audio.read()
    transcript = transcribe_audio(io.BytesIO(audio_bytes))

    if not transcript:
        return JSONResponse(status_code=400, content={"error": "Transcription failed"})

    # send text to run_agent which will return chat audio response
    reply_audio = run_agent(transcript)

    # return audio response to front end
    return StreamingResponse(
        io.BytesIO(reply_audio),
        media_type="audio/mp3",
        headers={"transcript": transcript}
    )