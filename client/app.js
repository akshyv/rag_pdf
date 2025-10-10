const API_URL = 'http://localhost:5000';

async function checkServer() {
    const statusDiv = document.getElementById('status');
    
    try {
        const response = await fetch(`${API_URL}/api/health`);
        const data = await response.json();

        statusDiv.innerHTML = `✅ ${data.message}`;
        statusDiv.className = 'success';
    } catch (error) {
        statusDiv.innerHTML = `❌ Server not responding`;
        statusDiv.className = 'error';
    }
}

document.getElementById('testBtn').addEventListener('click', checkServer);

// Check on page load
checkServer();