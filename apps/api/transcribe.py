import sys
import warnings
warnings.filterwarnings("ignore")

from faster_whisper import WhisperModel  # type: ignore # pyright: ignore[reportMissingImports]

def main():
    if len(sys.argv) < 2:
        print("Error: No video path provided", file=sys.stderr)
        sys.exit(1)
        
    video_path = sys.argv[1]
    
    # Run on CPU with int8 (since we assume no dedicated GPU setup)
    model_size = "tiny"
    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments, info = model.transcribe(video_path, beam_size=1)
        
        for segment in segments:
            print(segment.text)
            
    except Exception as e:
        print(f"Error during transcription: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
