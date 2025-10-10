const API_URL = 'http://localhost:5000';

// Check server health
async function checkServer() {
    const statusDiv = document.getElementById('status');
    
    try {
        const response = await fetch(`${API_URL}/api/health`);
        const data = await response.json();
        
        statusDiv.innerHTML = `Server: ${data.message}`;
        statusDiv.className = 'success';
    } catch (error) {
        statusDiv.innerHTML = `Server not responding`;
        statusDiv.className = 'error';
    }
}

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
            <div class="file-item">
                <span>${file.name}</span>
                <span>${formatFileSize(file.size)}</span>
            </div>
        `).join('');
        
    } catch (error) {
        filesList.innerHTML = '<div class="error">Failed to load files</div>';
        console.error('Error loading files:', error);
    }
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
    
    checkServer();
    loadFiles();
});