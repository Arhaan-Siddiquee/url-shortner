import { useState } from 'react';

function App() {
  const [longURL, setLongURL] = useState('');
  const [shortURL, setShortURL] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:8080/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ long_url: longURL }),
      });
      const data = await res.json();
      setShortURL(data.short_url);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-4">URL Shortener</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="url"
            value={longURL}
            onChange={(e) => setLongURL(e.target.value)}
            placeholder="Enter URL"
            className="w-full p-2 border rounded"
            required
          />
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            Shorten
          </button>
        </form>
        {shortURL && (
          <div className="mt-4 p-2 bg-gray-50 rounded">
            <p className="text-sm text-gray-700">Short URL:</p>
            <a 
              href={shortURL} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 underline"
            >
              {shortURL}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;