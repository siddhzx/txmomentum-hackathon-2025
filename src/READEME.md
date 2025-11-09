# Tacite - Local Multimodal Inference Server

A real-time local inference server that processes live audio and video streams to generate intelligent summaries and insights using multimodal AI models.

## 🚀 Features

- **Real-time Audio Processing**: Live speech recognition using Wav2Vec2
- **Video Analysis**: Real-time image captioning with BLIP
- **Intelligent Summarization**: LLM-powered analysis combining audio transcripts and video descriptions
- **WebSocket Streaming**: Low-latency bidirectional communication
- **REST API**: File upload endpoint for batch processing
- **Local Processing**: No data sent to external services - complete privacy

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Live Client   │───▶│  FastAPI Server │───▶│   ML Models     │
│ (Mic + Webcam)  │    │   WebSocket     │    │                 │
└─────────────────┘    └─────────────────┘    │ • Wav2Vec2 ASR  │
                                              │ • BLIP Captioning│
┌─────────────────┐    ┌─────────────────┐    │ • Flan-T5 LLM   │
│   REST Client   │───▶│   REST API      │    └─────────────────┘
│   (File Upload) │    │                 │
└─────────────────┘    └─────────────────┘
```

## 📋 Prerequisites

- **Python 3.10+** (3.11 recommended for best compatibility)
- **FFmpeg** (for audio processing)
- **Microphone and Webcam** (for live streaming)
- **GPU** (optional, but recommended for faster inference)

### OS-Specific Setup

**Windows:**
```bash
# FFmpeg installation
choco install ffmpeg
# or download from https://ffmpeg.org/download.html
```

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install -y ffmpeg
```

## 🛠️ Installation

1. **Clone the repository:**
```bash
git clone https://github.com/siddhzx/txmomentum-hackathon-2025.git
cd txmomentum-hackathon-2025
```

2. **Create virtual environment:**
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate
```

3. **Install dependencies:**
```bash
cd src
pip install -r requirements.txt
```

## 🚀 Usage

### Start the Server

```bash
cd src
export PYTHONPATH=.
# Windows
$env:PYTHONPATH = "."
# Then run:
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The server will be available at:
- **API**: http://127.0.0.1:8000
- **WebSocket**: ws://127.0.0.1:8000/ws
- **Health Check**: http://127.0.0.1:8000/health

### Live Streaming Mode

1. **Start the client:**
```bash
cd src
python live_client.py
```

2. **What happens:**
   - Client captures microphone audio and webcam video
   - Streams data to server via WebSocket
   - Server processes audio in real-time (speech recognition)
   - Server analyzes video frames (image captioning)
   - Server sends partial results back to client

3. **Finalize inference:**
   - Press `Ctrl+C` in the client terminal
   - Server combines all accumulated data
   - LLM generates comprehensive summary
   - Final result sent back to client

### File Upload Mode

Upload audio/video files for batch processing:

```bash
curl -F "file=@/path/to/media.mp4" -F "task=summarize" http://127.0.0.1:8000/v1/infer
```

## 📁 Project Structure

```
src/
├── server.py              # Main FastAPI server
├── preprocess_audio.py    # Audio processing & ASR
├── preprocess_video.py    # Video processing & captioning
├── model_interface.py     # LLM interface
├── live_client.py         # WebSocket streaming client
└── requirements.txt       # Python dependencies
```

## 🔧 Configuration

### Audio Settings
- **Sample Rate**: 16kHz
- **Channels**: Mono
- **Chunk Size**: 0.5 seconds
- **Model**: Wav2Vec2-base-960h

### Video Settings
- **Frame Rate**: 1 FPS
- **Resolution**: 224x224
- **Model**: BLIP-image-captioning-base

### LLM Settings
- **Model**: Google Flan-T5-base
- **Max Tokens**: 256
- **Temperature**: 0.0 (deterministic)

## 🎯 API Endpoints

### REST API
- `POST /v1/infer` - File upload inference
- `GET /health` - Health check

### WebSocket
- `ws://host:port/ws` - Live streaming endpoint

#### WebSocket Message Types
- `session` - Session initialization
- `audio_chunk` - Audio data (base64 WAV)
- `frame` - Video frame (base64 JPEG)
- `finalize` - Request final inference
- `partial_transcript` - Real-time speech recognition
- `partial_caption` - Real-time image descriptions
- `final_result` - Complete analysis

## 🧠 Models Used

1. **Wav2Vec2** (`facebook/wav2vec2-base-960h`)
   - Automatic Speech Recognition
   - ~360MB, works on CPU/GPU

2. **BLIP** (`Salesforce/blip-image-captioning-base`)
   - Image Captioning
   - Generates natural language descriptions

3. **Flan-T5** (`google/flan-t5-base`)
   - Text generation and reasoning
   - Combines inputs for intelligent summaries

## 🔍 Troubleshooting

### Common Issues

**"Module not found" errors:**
- Ensure virtual environment is activated
- Run `pip install -r requirements.txt` in `src/` directory

**Audio transcription not working:**
- Check microphone permissions
- Ensure FFmpeg is installed
- Verify audio device is not muted

**Video streaming issues:**
- Check webcam permissions
- Ensure OpenCV can access camera
- Try different camera index in client

**Model download failures:**
- Check internet connection
- Models cache in `~/.cache/huggingface/`
- May take several minutes on first run

### Performance Tips

- **GPU Acceleration**: Install PyTorch with CUDA for faster inference
- **Model Optimization**: Use smaller models for resource-constrained systems
- **Batch Processing**: REST API handles multiple requests efficiently

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is part of the TxMomentum Hackathon 2025.

## 🙏 Acknowledgments

- Hugging Face for transformers library
- OpenAI for original Whisper inspiration
- Salesforce for BLIP model
- Google for Flan-T5 model
