from fastapi import FastAPI, UploadFile, File
from fastapi.responses import StreamingResponse, JSONResponse
from tools import transcribe_audio
from app import run_agent
import io

app = FastAPI()

@app.post("/run")
async def run_voice_pipeline(audio: UploadFile = File(...)):
    print("reached pipeline")
    print(audio.filename)
    print(audio.content_type)
    audio_bytes = await audio.read()
    print(len(audio_bytes))
    transcript = transcribe_audio(io.BytesIO(audio_bytes))

    print(transcript)

    if not transcript:
        return JSONResponse(status_code=400, content={"error": "Transcription failed"})

    reply_audio = run_agent(transcript)

    return StreamingResponse(
        io.BytesIO(reply_audio),
        media_type="audio/mp3",
        headers={"transcript": transcript}
    )