import React, { useState, useEffect } from 'react';
import { Link, Copy, BarChart3, ExternalLink, Scissors, TrendingUp, Clock, MousePointer } from 'lucide-react';

const API_BASE = import.meta.env.PROD 
  ? window.location.origin 
  : 'http://localhost:8080';

function App() {
  const [longUrl, setLongUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('shorten');
  const [urlInfo, setUrlInfo] = useState(null);
  const [searchSlug, setSearchSlug] = useState('');
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);

  const shortenUrl = async () => {
    if (!longUrl) return;
    
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/api/shorten`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          long_url: longUrl,
          custom_slug: customSlug || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to shorten URL');
      }

      setShortUrl(data.short_url);
      setSuccess('URL shortened successfully!');
      setLongUrl('');
      setCustomSlug('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getUrlInfo = async () => {
    if (!searchSlug) return;
    
    setLoading(true);
    setError('');
    setUrlInfo(null);

    try {
      const response = await fetch(`${API_BASE}/api/info/${searchSlug}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get URL info');
      }

      setUrlInfo(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getStats = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/admin/stats`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get stats');
      }

      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  useEffect(() => {
    if (activeTab === 'stats') {
      getStats();
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-2 rounded-lg">
              <Scissors className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              URL Shortener
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Navigation */}
        <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm mb-8 max-w-md mx-auto">
          {[
            { id: 'shorten', label: 'Shorten', icon: Link },
            { id: 'info', label: 'Info', icon: ExternalLink },
            { id: 'stats', label: 'Stats', icon: BarChart3 },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}
        {success && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
            {success}
          </div>
        )}

        {/* Shorten URL Tab */}
        {activeTab === 'shorten' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Shorten Your URL</h2>
                <p className="text-gray-600">Transform long URLs into short, shareable links</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Long URL *
                  </label>
                  <input
                    type="url"
                    value={longUrl}
                    onChange={(e) => setLongUrl(e.target.value)}
                    placeholder="https://example.com/very-long-url"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Slug (Optional)
                  </label>
                  <input
                    type="text"
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="my-custom-link"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">Only letters and numbers allowed</p>
                </div>

                <button
                  onClick={shortenUrl}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Shortening...' : 'Shorten URL'}
                </button>
              </div>

              {shortUrl && (
                <div className="mt-8 p-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl border border-green-200">
                  <h3 className="font-medium text-gray-800 mb-3">Your shortened URL:</h3>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 p-3 bg-white rounded-lg border">
                      <a
                        href={shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 break-all"
                      >
                        {shortUrl}
                      </a>
                    </div>
                    <button
                      onClick={() => copyToClipboard(shortUrl)}
                      className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                  {copied && (
                    <p className="text-green-600 text-sm mt-2">Copied to clipboard!</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* URL Info Tab */}
        {activeTab === 'info' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">URL Information</h2>
                <p className="text-gray-600">Get detailed information about a shortened URL</p>
              </div>

              <div className="mb-8">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={searchSlug}
                    onChange={(e) => setSearchSlug(e.target.value)}
                    placeholder="Enter short code (e.g., abc123)"
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    onClick={getUrlInfo}
                    disabled={loading || !searchSlug}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Searching...' : 'Get Info'}
                  </button>
                </div>
              </div>

              {urlInfo && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                    <ExternalLink className="w-5 h-5 mr-2" />
                    URL Details
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Short URL</label>
                      <div className="flex items-center space-x-2">
                        <p className="flex-1 p-2 bg-white rounded border text-blue-600">
                          {urlInfo.short_url}
                        </p>
                        <button
                          onClick={() => copyToClipboard(urlInfo.short_url)}
                          className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200 transition-colors"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Original URL</label>
                      <p className="p-2 bg-white rounded border break-all">{urlInfo.long_url}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          Created
                        </label>
                        <p className="p-2 bg-white rounded border text-sm">
                          {formatDate(urlInfo.created_at)}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                          <MousePointer className="w-4 h-4 mr-1" />
                          Clicks
                        </label>
                        <p className="p-2 bg-white rounded border text-lg font-bold text-blue-600">
                          {urlInfo.access_count}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">Analytics Dashboard</h2>
                <p className="text-gray-600">Overview of your URL shortening service</p>
              </div>

              {stats && (
                <div className="space-y-8">
                  {/* Overview Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-blue-100 text-sm">Total URLs</p>
                          <p className="text-3xl font-bold">{stats.total_urls}</p>
                        </div>
                        <Link className="w-12 h-12 text-blue-200" />
                      </div>
                    </div>
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-purple-100 text-sm">Total Clicks</p>
                          <p className="text-3xl font-bold">{stats.total_clicks}</p>
                        </div>
                        <TrendingUp className="w-12 h-12 text-purple-200" />
                      </div>
                    </div>
                  </div>

                  {/* Top URLs */}
                  {stats.top_urls && stats.top_urls.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        Top Performing URLs
                      </h3>
                      <div className="space-y-3">
                        {stats.top_urls.map((url, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                                  #{index + 1}
                                </span>
                                <a
                                  href={url.short_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 font-medium"
                                >
                                  {url.short_url.split('/').pop()}
                                </a>
                              </div>
                              <p className="text-sm text-gray-600 truncate">{url.long_url}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Created: {formatDate(url.created_at)}
                              </p>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-2xl font-bold text-blue-600">{url.access_count}</p>
                              <p className="text-xs text-gray-500">clicks</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={getStats}
                    disabled={loading}
                    className="w-full py-3 px-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Refreshing...' : 'Refresh Stats'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center text-gray-600">
          <p>Built with React, Tailwind CSS, and Go</p>
        </div>
      </footer>
    </div>
  );
}

export default App;