import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';

function App() {
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    console.log('handleSendMessage called. isSending:', isSending);
    if (isSending) {
      console.log('Returned early!');
      return;
    }
    console.log('Proceeding to send...');
  };

  const handleFileUpload = async () => {
    console.log('handleFileUpload called');
    setIsSending(true);
    await new Promise(r => setTimeout(r, 1000)); // simulate upload
    await handleSendMessage();
  };

  return (
    <div>
      <button id="btn" onClick={handleFileUpload}>Upload</button>
    </div>
  );
}

// We can't easily run this in a browser here, but we know how closures work.
