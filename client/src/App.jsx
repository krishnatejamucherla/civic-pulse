import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [issues, setIssues] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'Pothole',
    address: ''
  });
  const [loading, setLoading] = useState(false);

  // Fetch all issues from backend API
  const fetchIssues = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/issues');
      setIssues(res.data);
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    }
  };

  useEffect(() => {
    fetchIssues();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Submit new issue
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post('http://localhost:5000/api/issues', {
        title: formData.title,
        description: formData.description,
        category: formData.category,
        location: {
          address: formData.address
        }
      });

      // Clear input fields and refresh the list
      setFormData({
        title: '',
        description: '',
        category: 'Pothole',
        address: ''
      });
      fetchIssues();
    } catch (err) {
      console.error('Submission error:', err);
      alert('Failed to report issue. Ensure backend server is running on port 5000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Civic Pulse</h1>
        <p>Crowdsourced Civic Issue Reporting & Resolution Platform</p>
      </header>

      {/* Form: Report an Issue */}
      <section className="card">
        <h2>Report a New Civic Issue</h2>
        <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
          <div className="form-group">
            <label>Issue Title</label>
            <input
              type="text"
              name="title"
              placeholder="e.g., Deep pothole near library circle"
              value={formData.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Category</label>
            <select name="category" value={formData.category} onChange={handleChange}>
              <option value="Pothole">Pothole</option>
              <option value="Streetlight">Streetlight</option>
              <option value="Garbage">Garbage</option>
              <option value="Water Supply">Water Supply</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Location / Landmark Address</label>
            <input
              type="text"
              name="address"
              placeholder="e.g., Opp. Academic Block 1, Campus Road"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              rows="3"
              placeholder="Describe the issue in detail..."
              value={formData.description}
              onChange={handleChange}
              required
            ></textarea>
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
        </form>
      </section>

      {/* Feed: Recent Reports */}
      <section className="card">
        <h2>Reported Issues Feed ({issues.length})</h2>
        <div style={{ marginTop: '1rem' }}>
          {issues.length === 0 ? (
            <p>No issues reported yet.</p>
          ) : (
            issues.map((issue) => (
              <div key={issue._id} className="issue-item">
                <div className="issue-header">
                  <h3>{issue.title}</h3>
                  <span className="badge">{issue.category}</span>
                </div>
                <p>{issue.description}</p>
                <div className="issue-meta">
                  <strong>Location:</strong> {issue.location?.address} |{' '}
                  <strong>Status:</strong> {issue.status} |{' '}
                  <strong>Reported on:</strong> {new Date(issue.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default App;