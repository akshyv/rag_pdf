from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
from pypdf import PdfReader
import chromadb
from sentence_transformers import SentenceTransformer
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "ngrok-skip-browser-warning"],
        "expose_headers": ["Content-Type"],
        "supports_credentials": False
    }
})
# Configuration from environment variables
UPLOAD_FOLDER = os.getenv('UPLOAD_FOLDER', 'documents')
ALLOWED_EXTENSIONS = {'pdf', 'txt'}
MAX_FILE_SIZE = int(os.getenv('MAX_FILE_SIZE_MB', '16')) * 1024 * 1024

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# Ngrok compatibility: Allow requests from any origin when using ngrok
app.config['SERVER_NAME'] = None  # Allow any host
app.config['APPLICATION_ROOT'] = '/'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# Initialize ChromaDB with persistent storage
DB_PERSIST_MODE = os.getenv('DB_PERSIST_MODE', 'auto_cleanup')


# Initialize ChromaDB based on persistence mode
if DB_PERSIST_MODE == 'memory':
    chroma_client = chromadb.Client()  # In-memory, clears on restart
    print("⚠️  ChromaDB running in MEMORY mode - data will be lost on restart")
else:
    CHROMA_DB_PATH = os.getenv('CHROMA_DB_PATH', './chroma_db')
    os.makedirs(CHROMA_DB_PATH, exist_ok=True)
    chroma_client = chromadb.PersistentClient(path=CHROMA_DB_PATH)
    print(f"✅ ChromaDB running in PERSISTENT mode - data stored in {CHROMA_DB_PATH}")

collection = chroma_client.get_or_create_collection(name="documents")

# Auto-cleanup orphaned chunks if enabled
if DB_PERSIST_MODE == 'auto_cleanup':
    try:
        all_chunks = collection.get()
        if all_chunks['ids']:
            uploaded_files = set(os.listdir(UPLOAD_FOLDER))
            orphaned_ids = []
            
            for i, metadata in enumerate(all_chunks['metadatas']):
                if metadata['filename'] not in uploaded_files:
                    orphaned_ids.append(all_chunks['ids'][i])
            
            if orphaned_ids:
                collection.delete(ids=orphaned_ids)
                print(f"🧹 Cleaned up {len(orphaned_ids)} orphaned chunks")
    except Exception as e:
        print(f"⚠️  Cleanup failed: {e}")

# Initialize embedding model
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
embedding_model = SentenceTransformer(EMBEDDING_MODEL)

# Text chunking configuration
CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', '500'))
CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', '50'))

# Search configuration
DEFAULT_SEARCH_RESULTS = int(os.getenv('DEFAULT_SEARCH_RESULTS', '1'))

# Initialize Groq client
groq_api_key = os.getenv('GROQ_API_KEY')
print(f"\n Groq API Key loaded: {groq_api_key[:10]}..." if groq_api_key else "No API key found\n")
GROQ_MODEL = os.getenv('GROQ_MODEL', 'llama-3.1-8b-instant')
GROQ_TEMPERATURE = float(os.getenv('GROQ_TEMPERATURE', '0.3'))
GROQ_MAX_TOKENS = int(os.getenv('GROQ_MAX_TOKENS', '500'))

if not groq_api_key:
    print("WARNING: GROQ_API_KEY not set. LLM features will be disabled.")
    groq_client = None
else:
    groq_client = Groq(api_key=groq_api_key)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(filepath):
    """Extract text from PDF file"""
    try:
        reader = PdfReader(filepath)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise Exception(f"Error extracting PDF: {str(e)}")

def extract_text_from_txt(filepath):
    """Extract text from TXT file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception as e:
        raise Exception(f"Error reading TXT: {str(e)}")

def chunk_text(text, chunk_size=None, overlap=None):
    """Split text into overlapping chunks"""
    if chunk_size is None:
        chunk_size = CHUNK_SIZE
    if overlap is None:
        overlap = CHUNK_OVERLAP
    chunks = []
    start = 0
    text_length = len(text)
    
    while start < text_length:
        end = start + chunk_size
        chunk = text[start:end]
        
        if chunk.strip():  # Only add non-empty chunks
            chunks.append(chunk)
        
        start += chunk_size - overlap
    
    return chunks

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'message': 'Server is running!'
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed. Use PDF or TXT'}), 400
    
    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    return jsonify({
        'message': 'File uploaded successfully',
        'filename': filename
    }), 200

@app.route('/api/files', methods=['GET'])
def list_files():
    files = []
    for filename in os.listdir(app.config['UPLOAD_FOLDER']):
        if allowed_file(filename):
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            # Check if document is processed (exists in ChromaDB)
            try:
                results = collection.get(where={"filename": filename})
                is_processed = len(results['ids']) > 0
            except:
                is_processed = False
            
            files.append({
                'name': filename,
                'size': os.path.getsize(filepath),
                'processed': is_processed
            })
    
    return jsonify({'files': files}), 200

@app.route('/api/files/<filename>', methods=['GET'])
def get_file_content(filename):
    """Get extracted text content from a file"""
    if not allowed_file(filename):
        return jsonify({'error': 'Invalid file type'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        file_extension = filename.rsplit('.', 1)[1].lower()
        
        if file_extension == 'pdf':
            text = extract_text_from_pdf(filepath)
        elif file_extension == 'txt':
            text = extract_text_from_txt(filepath)
        else:
            return jsonify({'error': 'Unsupported file type'}), 400
        
        return jsonify({
            'filename': filename,
            'content': text,
            'length': len(text)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/process/<filename>', methods=['POST'])
def process_document(filename):
    """Process document: extract, chunk, embed, and store in ChromaDB"""
    if not allowed_file(filename):
        return jsonify({'error': 'Invalid file type'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        # Extract text
        file_extension = filename.rsplit('.', 1)[1].lower()
        if file_extension == 'pdf':
            text = extract_text_from_pdf(filepath)
        elif file_extension == 'txt':
            text = extract_text_from_txt(filepath)
        else:
            return jsonify({'error': 'Unsupported file type'}), 400
        
        # Chunk text
        chunks = chunk_text(text)
        
        if not chunks:
            return jsonify({'error': 'No content to process'}), 400
        
        # Generate embeddings
        embeddings = embedding_model.encode(chunks).tolist()
        
        # Prepare data for ChromaDB
        ids = [f"{filename}_chunk_{i}" for i in range(len(chunks))]
        metadatas = [{"filename": filename, "chunk_index": i} for i in range(len(chunks))]
        
        # Delete existing chunks for this file (if re-processing)
        try:
            existing = collection.get(where={"filename": filename})
            if existing['ids']:
                collection.delete(ids=existing['ids'])
        except:
            pass
        
        # Store in ChromaDB
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas
        )
        
        return jsonify({
            'message': 'Document processed successfully',
            'filename': filename,
            'chunks': len(chunks)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/search', methods=['POST'])
def search_documents():
    """Search for relevant document chunks"""
    data = request.get_json()
    
    if not data or 'query' not in data:
        return jsonify({'error': 'No query provided'}), 400
    
    query = data['query']
    n_results = data.get('n_results', DEFAULT_SEARCH_RESULTS)  # Default to top 3 results
    
    try:
        # Generate query embedding
        query_embedding = embedding_model.encode([query]).tolist()
        
        # Search ChromaDB
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=n_results
        )
        
        # Format results
        search_results = []
        if results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                search_results.append({
                    'text': results['documents'][0][i],
                    'filename': results['metadatas'][0][i]['filename'],
                    'chunk_index': results['metadatas'][0][i]['chunk_index'],
                    'distance': results['distances'][0][i] if 'distances' in results else None
                })
        
        return jsonify({
            'query': query,
            'results': search_results,
            'count': len(search_results)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
@app.route('/api/ask', methods=['POST'])
def ask_question():
    """Ask a question and get an AI-generated answer with sources"""
    data = request.get_json()
    
    if not data or 'question' not in data:
        return jsonify({'error': 'No question provided'}), 400
    
    if not groq_client:
        return jsonify({'error': 'LLM API not configured. Please set GROQ_API_KEY'}), 500
    
    question = data['question']
    n_results = data.get('n_results', DEFAULT_SEARCH_RESULTS)
    
    try:
        # Step 1: Retrieve relevant chunks
        query_embedding = embedding_model.encode([question]).tolist()
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=n_results
        )
        
        # Format retrieved chunks
        retrieved_chunks = []
        context_text = ""
        
        if results['ids'] and results['ids'][0]:
            for i in range(len(results['ids'][0])):
                chunk_data = {
                    'text': results['documents'][0][i],
                    'filename': results['metadatas'][0][i]['filename'],
                    'chunk_index': results['metadatas'][0][i]['chunk_index']
                }
                retrieved_chunks.append(chunk_data)
                context_text += f"\n[Source: {chunk_data['filename']}]\n{chunk_data['text']}\n"
        
        if not context_text:
            return jsonify({
                'question': question,
                'answer': 'No relevant documents found. Please process some documents first.',
                'sources': []
            }), 200
        
        # Step 2: Generate answer using Groq
        prompt = f"""You are a helpful assistant. Answer the question based ONLY on the provided context. If the context doesn't contain enough information, say so.

Context:
{context_text}

Question: {question}

Answer:"""
        
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "user", "content": prompt}
            ],
            model=GROQ_MODEL,
            temperature=GROQ_TEMPERATURE,
            max_tokens=GROQ_MAX_TOKENS
        )
        
        answer = chat_completion.choices[0].message.content
        
        return jsonify({
            'question': question,
            'answer': answer,
            'sources': retrieved_chunks,
            'model': 'llama-3.1-8b-instant'
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500



@app.route('/api/files/<filename>', methods=['DELETE'])
def delete_file(filename):
    """Delete file and its chunks from database"""
    if not allowed_file(filename):
        return jsonify({'error': 'Invalid file type'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    
    try:
        # Delete chunks from ChromaDB
        existing = collection.get(where={"filename": filename})
        if existing['ids']:
            collection.delete(ids=existing['ids'])
            chunks_deleted = len(existing['ids'])
        else:
            chunks_deleted = 0
        
        # Delete file from filesystem
        if os.path.exists(filepath):
            os.remove(filepath)
            file_deleted = True
        else:
            file_deleted = False
        
        return jsonify({
            'message': 'File deleted successfully',
            'filename': filename,
            'chunks_deleted': chunks_deleted,
            'file_deleted': file_deleted
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    port = int(os.getenv('FLASK_PORT', '5000'))
    app.run(debug=debug_mode, port=port)