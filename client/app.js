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
    if (errorCount === 0) {
        uploadStatus.innerHTML = `Successfully uploaded ${successCount} file(s)`;
        uploadStatus.className = 'success';
    } else {
        uploadStatus.innerHTML = `Uploaded ${successCount}, Failed ${errorCount}`;
        uploadStatus.className = 'error';
    }
    
    uploadBtn.disabled = false;
    fileInput.value = '';

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
        
        filesList.innerHTML = '';
        
        data.files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            fileInfo.innerHTML = `
                <span class="file-name">${escapeHtml(file.name)}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
                ${file.processed ? '<span class="processed-badge">Processed</span>' : '<span class="unprocessed-badge">Not Processed</span>'}
            `;
            fileInfo.addEventListener('click', () => viewDocument(file.name));
            
            const fileActions = document.createElement('div');
            fileActions.className = 'file-actions';
            
            const processBtn = document.createElement('button');
            processBtn.className = 'process-btn';
            processBtn.textContent = file.processed ? 'Reprocess' : 'Process';
            processBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                processDocument(file.name);
            });
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteDocument(file.name);
            });
            
            fileActions.appendChild(processBtn);
            fileActions.appendChild(deleteBtn);
            fileItem.appendChild(fileInfo);
            fileItem.appendChild(fileActions);
            filesList.appendChild(fileItem);
        });
        
    } catch (error) {
        filesList.innerHTML = '<div class="error">Failed to load files</div>';
        console.error('Error loading files:', error);
    }
}

// Process document for RAG
async function processDocument(filename) {
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.innerHTML = `Processing ${escapeHtml(filename)}...`;
    statusDiv.className = '';
    
    try {
        const response = await fetch(`${API_URL}/api/process/${encodeURIComponent(filename)}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            statusDiv.innerHTML = `Successfully processed ${escapeHtml(filename)}`;
            statusDiv.className = 'success';
            loadFiles();
        } else {
            statusDiv.innerHTML = `Error: ${escapeHtml(data.error)}`;
            statusDiv.className = 'error';
        }
        
    } catch (error) {
        statusDiv.innerHTML = 'Failed to process document';
        statusDiv.className = 'error';
        console.error('Error processing document:', error);
    }
}

// Delete document
async function deleteDocument(filename) {
    if (!confirm(`Are you sure you want to delete "${filename}"? This will remove the file and all its processed chunks.`)) {
        return;
    }
    
    const statusDiv = document.getElementById('uploadStatus');
    statusDiv.innerHTML = `Deleting ${escapeHtml(filename)}...`;
    statusDiv.className = '';
    
    try {
        const response = await fetch(`${API_URL}/api/files/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            statusDiv.innerHTML = `Successfully deleted ${escapeHtml(filename)} (${data.chunks_deleted} chunks removed)`;
            statusDiv.className = 'success';
            loadFiles();
            
            // Clear document viewer if the deleted file was being viewed
            const viewer = document.getElementById('documentViewer');
            if (viewer.innerHTML.includes(escapeHtml(filename))) {
                viewer.innerHTML = '<div class="empty-state">Select a document to view its content</div>';
            }
        } else {
            statusDiv.innerHTML = `Error: ${escapeHtml(data.error)}`;
            statusDiv.className = 'error';
        }
        
    } catch (error) {
        statusDiv.innerHTML = 'Failed to delete document';
        statusDiv.className = 'error';
        console.error('Error deleting document:', error);
    }
}

// Search documents
async function searchDocuments() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const searchResults = document.getElementById('searchResults');
    
    const query = searchInput.value.trim();
    
    if (!query) {
        searchResults.innerHTML = '<div class="error">Please enter a search query</div>';
        return;
    }
    
    searchBtn.disabled = true;
    searchResults.innerHTML = '<div class="loading">Searching...</div>';
    
    try {
        const response = await fetch(`${API_URL}/api/search`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query: query, n_results: 3 })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            if (data.results.length === 0) {
                searchResults.innerHTML = '<div class="empty-state">No results found. Make sure documents are processed.</div>';
            } else {
                searchResults.innerHTML = `
                    <div class="results-header">Found ${data.count} relevant chunk(s)</div>
                    ${data.results.map((result, index) => `
                        <div class="result-item">
                            <div class="result-header">
                                <span class="result-number">#${index + 1}</span>
                                <span class="result-source">${escapeHtml(result.filename)}</span>
                            </div>
                            <div class="result-text">${escapeHtml(result.text)}</div>
                        </div>
                    `).join('')}
                `;
            }
        } else {
            searchResults.innerHTML = `<div class="error">Error: ${escapeHtml(data.error)}</div>`;
        }
        
    } catch (error) {
        searchResults.innerHTML = '<div class="error">Search failed</div>';
        console.error('Error searching:', error);
    } finally {
        searchBtn.disabled = false;
    }
}

// Ask question with LLM
async function askQuestion() {
    const askInput = document.getElementById('askInput');
    const askBtn = document.getElementById('askBtn');
    const askResults = document.getElementById('askResults');
    
    const question = askInput.value.trim();
    
    if (!question) {
        askResults.innerHTML = '<div class="error">Please enter a question</div>';
        return;
    }
    
    askBtn.disabled = true;
    askResults.innerHTML = '<div class="loading">Thinking...</div>';
    
    try {
        const response = await fetch(`${API_URL}/api/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question: question, n_results: 3 })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            askResults.innerHTML = `
                <div class="answer-container">
                    <div class="answer-header">
                        <span class="answer-icon">🤖</span>
                        <span class="answer-label">AI Answer</span>
                    </div>
                    <div class="answer-text">${escapeHtml(data.answer).replace(/\n/g, '<br>')}</div>
                </div>
                ${data.sources.length > 0 ? `
                    <div class="sources-container">
                        <div class="sources-header">📚 Sources Used:</div>
                        ${data.sources.map((source, index) => `
                            <div class="source-item">
                                <div class="source-header">
                                    <span class="source-number">#${index + 1}</span>
                                    <span class="source-filename">${escapeHtml(source.filename)}</span>
                                </div>
                                <div class="source-text">${escapeHtml(source.text)}</div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `;
        } else {
            askResults.innerHTML = `<div class="error">Error: ${escapeHtml(data.error)}</div>`;
        }
        
    } catch (error) {
        askResults.innerHTML = '<div class="error">Failed to get answer</div>';
        console.error('Error asking question:', error);
    } finally {
        askBtn.disabled = false;
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
                    <h3>${escapeHtml(data.filename)}</h3>
                    <span class="document-length">${data.length} characters</span>
                </div>
                <div class="document-content">${escapeHtml(data.content).replace(/\n/g, '<br>')}</div>
            `;
        } else {
            viewer.innerHTML = `<div class="error">Error: ${escapeHtml(data.error)}</div>`;
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
    return div.innerHTML;
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
    document.getElementById('searchBtn').addEventListener('click', searchDocuments);
    document.getElementById('askBtn').addEventListener('click', askQuestion);
    
    // Allow Enter key to search
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchDocuments();
        }
    });
    
    // Allow Enter key to ask
    document.getElementById('askInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            askQuestion();
        }
    });
    
    loadFiles();
});