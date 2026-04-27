#!/opt/whisper-env/bin/python3
import sys
import json
from faster_whisper import WhisperModel

def transcribe(audio_path: str):
    model = WhisperModel("small", device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        audio_path,
        language="es",
        beam_size=5
    )
    text = " ".join([segment.text.strip() for segment in segments])
    print(json.dumps({
        "transcript": text,
        "language": info.language,
        "duration": info.duration
    }))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No audio path provided"}))
        sys.exit(1)
    transcribe(sys.argv[1])
