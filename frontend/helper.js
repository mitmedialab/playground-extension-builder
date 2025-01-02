async function fetchFileList() {
    const response = await fetch('/list-directory', { method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }});
    const files = await response.json();
    return files;
  }

  async function fetchCommonList() {
    const response = await fetch('/list-common-directory', { method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }});
    const files = await response.json();
    return files;
  }

async function getFileContent(filePath) {
    const response = await fetch(`/open-file`, { method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: filePath })});
    const content = await response.text();
    return content;
}