from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
from pypdf import PdfReader

app = Flask(__name__)
CORS(app)

# Configuration
UPLOAD_FOLDER = 'documents'
ALLOWED_EXTENSIONS = {'pdf', 'txt'}
MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

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

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'message': 'Server is running!'
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    # Check if file is in request
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    
    # Check if filename is empty
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Validate file type
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed. Use PDF or TXT'}), 400
    
    # Save file
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
            files.append({
                'name': filename,
                'size': os.path.getsize(filepath)
            })
    
    return jsonify({'files': files}), 200

@app.route('/api/files/<filename>', methods=['GET'])
def get_file_content(filename):
    """Get extracted text content from a file"""
    # Validate filename
    if not allowed_file(filename):
        return jsonify({'error': 'Invalid file type'}), 400
    
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], secure_filename(filename))
    
    # Check if file exists
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    try:
        # Extract text based on file type
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)