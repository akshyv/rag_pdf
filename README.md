## To run the application you need 4 terminals
0. Ensure in environment: venv\Scripts\activate
1. ./client: `python -m http.server 3000`
2. ./server: `python app.py`
3. ngrok http 5000 --config ngrok_server.yml
4. ngrok http 3000 --config ngrok_client.yml



NGROK: C:\Users\AkNa\AppData\Local\Packages\ngrok.ngrok_1g87z0zv29zzc\LocalCache\Local\ngrok

# RAG Document Q&A System

A Retrieval-Augmented Generation (RAG) system for document question answering using semantic search and LLM integration.

## Features

- 📄 Upload PDF and TXT documents
- 🔍 Semantic search using sentence transformers
- 🤖 AI-powered question answering with Groq LLM
- 💾 Persistent vector storage with ChromaDB
- 🎯 Document chunking with embeddings

## Tech Stack

**Backend:** Python, Flask, ChromaDB, sentence-transformers, Groq API  
**Frontend:** Vanilla JavaScript, HTML, CSS

## Prerequisites

- Python 3.10+
- ngrok account (free tier works fine)

## Local Setup

### 1. Clone and Setup Virtual Environment
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
venv\Scripts\activate  # Windows
# source venv/bin/activate  # macOS/Linux
```

### 2. Install Dependencies
```bash
cd server
pip install -r requirements.txt
```

### 3. Create .env File

Create a `.env` file in the `server/` directory:
```env
# Flask Configuration
FLASK_DEBUG=True
FLASK_PORT=5000

# File Upload
UPLOAD_FOLDER=documents
MAX_FILE_SIZE_MB=16

# ChromaDB
DB_PERSIST_MODE=auto_cleanup
CHROMA_DB_PATH=./chroma_db

# Embeddings
EMBEDDING_MODEL=all-MiniLM-L6-v2
CHUNK_SIZE=500
CHUNK_OVERLAP=50

# Search
DEFAULT_SEARCH_RESULTS=3

# Groq LLM (Optional - for AI answers)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant
GROQ_TEMPERATURE=0.3
GROQ_MAX_TOKENS=500
```

**Note:** Get free Groq API key at https://console.groq.com

### 4. Run the Application
```bash
# Terminal 1: Start backend
cd server
python app.py

# Terminal 2: Start frontend
cd client
python -m http.server 3000
```

Access at: http://localhost:3000

---

## 🌐 Ngrok Setup (Share Your App)

Use ngrok to create a public URL for your local app - great for demos, testing on mobile, or sharing with friends!

### 1. Install Ngrok

**Option A: Download**
- Go to https://ngrok.com/download
- Download and extract ngrok

**Option B: Package Manager**
```bash
# Windows (Chocolatey)
choco install ngrok

# macOS (Homebrew)
brew install ngrok/ngrok/ngrok

# Linux (Snap)
snap install ngrok
```

### 2. Setup Ngrok Account
```bash
# Sign up at https://dashboard.ngrok.com/signup
# Get your authtoken from https://dashboard.ngrok.com/get-started/your-authtoken

# Add your authtoken
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### 3. Start Backend with Ngrok
```bash
# Terminal 1: Start Flask backend
cd server
python app.py
# Backend runs on http://localhost:5000

# Terminal 2: Expose backend with ngrok
ngrok http 5000
```

You'll see output like:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:5000
```

**Copy the https URL** (e.g., `https://abc123.ngrok-free.app`)

### 4. Start Frontend with Ngrok
```bash
# Terminal 3: Start frontend server
cd client
python -m http.server 3000

# Terminal 4: Expose frontend with ngrok
ngrok http 3000
```

You'll see:
```
Forwarding  https://xyz789.ngrok-free.app -> http://localhost:3000
```

### 5. Update Frontend Config

Open `client/app.js` and update the API URL:
```javascript
// Change this line:
const API_BASE_URL = 'http://localhost:5000';

// To your ngrok backend URL:
const API_BASE_URL = 'https://abc123.ngrok-free.app';
```

### 6. Share Your App! 🎉

Share the **frontend ngrok URL** (e.g., `https://xyz789.ngrok-free.app`) with anyone!

### Ngrok Tips

✅ **Free tier includes:**
- 1 online ngrok process
- 4 tunnels/process
- 40 connections/minute

⚠️ **Limitations:**
- URLs change each time you restart ngrok (upgrade for static URLs)
- Connection expires after 2 hours on free tier

🔒 **Security:**
- Never commit ngrok URLs to git
- Ngrok URLs are temporary and safe to share
- Your .env API keys stay on your server (never exposed)

### Keeping Ngrok Running
```bash
# Keep ngrok alive (prevents timeout)
ngrok http 5000 --log=stdout

# Use custom subdomain (paid feature)
ngrok http 5000 --subdomain=my-rag-app
```

---

## Project Structure
```
rag-app/
├── .venv/                    # Virtual environment
├── .gitignore
├── README.md
├── server/
│   ├── app.py               # Flask backend
│   ├── requirements.txt     # Dependencies
│   ├── .env                 # Configuration (not in git)
│   ├── documents/           # Uploaded files (not in git)
│   └── chroma_db/           # Vector database (not in git)
└── client/
    ├── index.html           # UI
    ├── style.css            # Styling
    └── app.js               # Frontend logic
```

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/upload` - Upload documents
- `GET /api/files` - List uploaded files
- `GET /api/files/<filename>` - Get file content
- `DELETE /api/files/<filename>` - Delete file
- `POST /api/process/<filename>` - Process document
- `POST /api/search` - Search documents
- `POST /api/ask` - Ask AI question

## Environment Variables

See `.env` file for all configuration options.

## License

MIT