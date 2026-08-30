document.addEventListener('DOMContentLoaded', () => {
  const scanBtn = document.getElementById('scan-btn');
  const resultsDiv = document.getElementById('results');
  const jsonOutput = document.getElementById('json-output');

  scanBtn.addEventListener('click', async () => {
    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }, (injectionResults) => {
      if (injectionResults && injectionResults[0]) {
        const data = injectionResults[0].result;

        if (data) {
          // Format the JSON data so it looks nice, with 2 spaces for indentation
          jsonOutput.textContent = JSON.stringify(data, null, 2);
          
          resultsDiv.classList.remove('hidden');
        }
      }
    });
  });
});
