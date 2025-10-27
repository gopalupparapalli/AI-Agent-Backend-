import fs from 'fs';
import axios from 'axios';

const bulkFilePath = 'bulk_logs.json'; // Your bulk file path
const openSearchEndpoint = 'https://search-logs-domain-s5343goneippi3vqjnukskzh7e.aos.us-west-2.on.aws'; // Correct endpoint (no /_dashboards)
const masterUser = 'admin';
const masterPassword = 'jeevi1@2GOPAL';

// Load file and log first 10 lines for debug
function printBulkFilePreview(data) {
  const lines = data.split('\n');
  console.log('Bulk file preview (first 10 lines):');
  lines.slice(0, 10).forEach((line, idx) => {
    console.log(idx + 1, line);
  });
}

// Strict validation for bulk API payload
function validateBulkFile(data) {
  const lines = data.trim().split('\n');
  if (lines.length % 2 !== 0) {
    throw new Error('Bulk file should have an even number of lines (pairs of action and document)');
  }
  for (let i = 0; i < lines.length; i += 2) {
    try {
      const action = JSON.parse(lines[i]);
      const doc = JSON.parse(lines[i + 1]);
      if (!action.index || !action.index._index) {
        throw new Error(`Missing 'index' metadata at line ${i + 1}`);
      }
      if (typeof doc !== 'object') {
        throw new Error(`Invalid JSON document at line ${i + 2}`);
      }
    } catch (err) {
      throw new Error(`JSON parse error: ${err.message} at lines ${i + 1}-${i + 2}`);
    }
  }
}

async function uploadBulkFile() {
  try {
    const data = fs.readFileSync(bulkFilePath, 'utf-8');

    printBulkFilePreview(data);

    validateBulkFile(data);

    const response = await axios.post(`${openSearchEndpoint}/_bulk`, data, {
      headers: {
        'Content-Type': 'application/x-ndjson',
      },
      auth: {
        username: masterUser,
        password: masterPassword,
      },
      maxBodyLength: Infinity,
    });
    console.log('Upload succeeded:', response.data);
  } catch (error) {
    console.error('Upload failed:', error.message);
    if (error.response && error.response.data) {
      console.error('OpenSearch error response:', error.response.data);
    }
  }
}

uploadBulkFile();
