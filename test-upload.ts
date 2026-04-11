import fs from 'fs';

async function test() {
  const formData = new FormData();
  formData.append('attachment', new Blob(['test']), 'test.txt');
  
  try {
    const res = await fetch('http://localhost:3000/api/upload-chat-attachment', {
      method: 'POST',
      body: formData
    });
    console.log(res.status, await res.text());
  } catch (e) {
    console.error(e);
  }
}

test();
