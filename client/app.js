const API_URL = 'http://localhost:5000';

// Upload files
async function uploadFiles() {
    const fileInput = document.getElementById('fileInput');
    const uploadBtn = document.getElementById('uploadBtn');
    const uploadStatus = document.getElementById('uploadStatus');
    
    const files = fileInput.files;
    
    if (files.length === 0) {
        uploadStatus.innerHTML = 'Please select files first';
        uploadStatus.className = 'error';
        return;
    }
    
    uploadBtn.disabled = true;
    uploadStatus.innerHTML = 'Uploading...';
    uploadStatus.className = '';
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let file of files) {
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                successCount++;
            } else {
                errorCount++;
                console.error(`Failed to upload ${file.name}:`, data.error);
            }
        } catch (error) {
            errorCount++;
            console.error(`Error uploading ${file.name}:`, error);
        }
    }
    
    // Show results
    if (errorCount === 0) {
        uploadStatus.innerHTML = `Successfully uploaded ${successCount} file(s)`;
        uploadStatus.className = 'success';
    } else {
        uploadStatus.innerHTML = `Uploaded ${successCount}, Failed ${errorCount}`;
        uploadStatus.className = 'error';
    }
    
    uploadBtn.disabled = false;
    fileInput.value = '';
    
    // Refresh file list
    loadFiles();
}

// Load and display uploaded files
async function loadFiles() {
    const filesList = document.getElementById('filesList');
    
    try {
        const response = await fetch(`${API_URL}/api/files`);
        const data = await response.json();
        
        if (data.files.length === 0) {
            filesList.innerHTML = '<div class="empty-state">No documents uploaded yet</div>';
            return;
        }
        
        filesList.innerHTML = data.files.map(file => `
            <div class="file-item" onclick="viewDocument('${file.name}')">
                <span class="file-name">${file.name}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
            </div>
        `).join('');
        
    } catch (error) {
        filesList.innerHTML = '<div class="error">Failed to load files</div>';
        console.error('Error loading files:', error);
    }
}

// View document content
async function viewDocument(filename) {
    const viewer = document.getElementById('documentViewer');
    
    viewer.innerHTML = '<div class="loading">Loading document...</div>';
    
    try {
        const response = await fetch(`${API_URL}/api/files/${encodeURIComponent(filename)}`);
        const data = await response.json();
        
        if (response.ok) {
            viewer.innerHTML = `
                <div class="document-header">
                    <h3>${data.filename}</h3>
                    <span class="document-length">${data.length} characters</span>
                </div>
                <div class="document-content">${escapeHtml(data.content)}</div>
            `;
        } else {
            viewer.innerHTML = `<div class="error">Error: ${data.error}</div>`;
        }
        
    } catch (error) {
        viewer.innerHTML = '<div class="error">Failed to load document</div>';
        console.error('Error viewing document:', error);
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// Format file size
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('uploadBtn').addEventListener('click', uploadFiles);
    document.getElementById('refreshBtn').addEventListener('click', loadFiles);
    
    loadFiles();
});