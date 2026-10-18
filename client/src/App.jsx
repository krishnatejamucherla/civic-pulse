import DepartmentDashboard from './DepartmentDashboard';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import L from 'leaflet';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import {
  ShieldCheck,
  PlusCircle,
  MapPin,
  TrendingUp,
  Camera,
  Crosshair,
  UploadCloud,
} from 'lucide-react';
import './App.css';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
// Fix standard Leaflet marker display
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Fallback map location only.
// It is NOT automatically submitted as the issue location.
const defaultCoords = [17.3850, 78.4867];

/* -------------------------------------------------
   Recenter map whenever selected location changes
-------------------------------------------------- */
function RecenterMap({ position }) {
  const map = useMap();

  useEffect(() => {
    if (position) {
      map.flyTo(position, 16, {
        duration: 1,
      });
    }
  }, [position, map]);

  return null;
}

/* -------------------------------------------------
   Allow user to click anywhere on the map
-------------------------------------------------- */
function MapClickHandler({ onLocationSelect }) {
  useMapEvents({
    click(e) {
      onLocationSelect([
        e.latlng.lat,
        e.latlng.lng,
      ]);
    },
  });

  return null;
}


const createStatusMarker = (color) =>
  L.divIcon({
    className: 'status-marker',
    html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 1px 5px rgba(0,0,0,0.4);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const statusMarkerIcons = {
  Reported: createStatusMarker('#dc2626'),
  'In Progress': createStatusMarker('#f59e0b'),
  Resolved: createStatusMarker('#16a34a'),
};

const getStatusMarker = (status) =>
  statusMarkerIcons[status] || statusMarkerIcons.Reported;

function App() {
  const [issues, setIssues] = useState([]);
  const [myReports, setMyReports] = useState([]);
const [myReportsLoading, setMyReportsLoading] = useState(false);
const [myReportsError, setMyReportsError] = useState('');
const [showMyReports, setShowMyReports] = useState(false);
  const [verificationIssueId, setVerificationIssueId] = useState(null);
  // Authentication
  const [token, setToken] = useState(
    localStorage.getItem('civicpulse_token')
  );

  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('civicpulse_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [authMode, setAuthMode] = useState('login');

  const [authData, setAuthData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const [authLoading, setAuthLoading] = useState(false);

  const [formData, setFormData] = useState({
  title: '',
  category: 'Road Damage / Potholes',
  severity: 'Medium',
  description: '',
  address: '',
});
  // The location selected for the incident.
  // Format for Leaflet: [latitude, longitude]
  const [selectedLocation, setSelectedLocation] = useState(null);

  const [locationStatus, setLocationStatus] =
    useState('Location not selected');

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [filePreview, setFilePreview] =
    useState(null);

  const [loading, setLoading] =
    useState(false);

  const fileInputRef = useRef(null);

  /* -------------------------------------------------
     Fetch issues from MongoDB
  -------------------------------------------------- */
  const fetchIssues = async () => {
    try {
      const res = await axios.get(
        `${API_BASE}/api/issues`
      );

      setIssues(res.data);
    } catch (err) {
      console.error(
        'Failed to load issues:',
        err
      );
    }
  };

  const fetchMyReports = async () => {
  if (!token) {
    setMyReports([]);
    setMyReportsError('Please log in to view your reports.');
    return;
  }

  setMyReportsLoading(true);
  setMyReportsError('');

  try {
    const response = await axios.get(
      `${API_BASE}/api/issues/my-reports`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setMyReports(response.data);
  } catch (error) {
    setMyReportsError(
      error.response?.data?.error ||
      'Unable to load your reports. Please try again.'
    );
  } finally {
    setMyReportsLoading(false);
  }
};

  /* -------------------------------------------------
     Initial loading
  -------------------------------------------------- */
  useEffect(() => {
    fetchIssues();

    // Automatically request browser location
    getCurrentLocation();
  }, []);

  useEffect(() => {
  if (!verificationIssueId) return;

  const issue = issues.find(
    (item) => item._id === verificationIssueId
  );

  if (
    issue &&
    issue.imageVerificationStatus !== 'Pending Verification'
  ) {
    return;
  }

  const timer = setInterval(() => {
    fetchIssues();
  }, 3000);

  return () => clearInterval(timer);
}, [verificationIssueId, issues]);

  /* -------------------------------------------------
     Form input
  -------------------------------------------------- */
  // Authentication functions
const handleAuthChange = (e) => {
  setAuthData({
    ...authData,
    [e.target.name]: e.target.value,
  });
};

const handleAuthSubmit = async (e) => {
  e.preventDefault();
  setAuthLoading(true);

  try {
    const endpoint =
  authMode === 'login'
    ? `${API_BASE}/api/auth/login`
    : `${API_BASE}/api/auth/register`;

    const payload =
      authMode === 'login'
        ? {
            email: authData.email,
            password: authData.password,
          }
        : {
            name: authData.name,
            email: authData.email,
            password: authData.password,
          };

    const res = await axios.post(endpoint, payload);

    if (authMode === 'register') {
      alert('Registration successful. Please login.');

      setAuthMode('login');

      setAuthData({
        name: '',
        email: authData.email,
        password: '',
      });

      return;
    }

    const { token, user } = res.data;

    localStorage.setItem('civicpulse_token', token);
    localStorage.setItem('civicpulse_user', JSON.stringify(user));

    setToken(token);
    setUser(user);

    setAuthData({
      name: '',
      email: '',
      password: '',
    });

    alert('Login successful!');
  } catch (err) {
    console.error('Authentication error:', err);

    alert(
      err.response?.data?.error ||
        'Authentication failed.'
    );
  } finally {
    setAuthLoading(false);
  }
};

const handleLogout = () => {
  localStorage.removeItem('civicpulse_token');
  localStorage.removeItem('civicpulse_user');

  setToken(null);
  setUser(null);

  alert('Logged out successfully.');
};


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  /* -------------------------------------------------
     Browser GPS
  -------------------------------------------------- */
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus(
        'GPS is not supported by this browser'
      );
      return;
    }

    setLocationLoading(true);
    setLocationStatus(
      'Detecting your location...'
    );

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude =
          position.coords.latitude;

        const longitude =
          position.coords.longitude;

        const location = [
          latitude,
          longitude,
        ];

        // Set selected incident location
        setSelectedLocation(location);

        // Display coordinates in form
        setFormData((previous) => ({
          ...previous,
          address:
            `GPS Location: ${latitude.toFixed(
              6
            )}, ${longitude.toFixed(6)}`,
        }));

        setLocationStatus(
          'GPS location detected'
        );

        setLocationLoading(false);
      },

      (error) => {
        console.error(
          'Geolocation error:',
          error
        );

        let message =
          'Could not detect location';

        if (error.code === 1) {
          message =
            'Location permission denied';
        } else if (error.code === 2) {
          message =
            'Location unavailable';
        } else if (error.code === 3) {
          message =
            'Location request timed out';
        }

        setLocationStatus(message);
        setLocationLoading(false);
      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  /* -------------------------------------------------
     Select location from map
  -------------------------------------------------- */
  const handleLocationSelect = (
    location
  ) => {
    const [latitude, longitude] =
      location;

    setSelectedLocation(location);

    setFormData((previous) => ({
      ...previous,
      address:
        `Selected Location: ${latitude.toFixed(
          6
        )}, ${longitude.toFixed(6)}`,
    }));

    setLocationStatus(
      'Incident location selected'
    );
  };

  /* -------------------------------------------------
     Drag marker
  -------------------------------------------------- */
  const handleMarkerDragEnd = (e) => {
    const marker = e.target;

    const position =
      marker.getLatLng();

    handleLocationSelect([
      position.lat,
      position.lng,
    ]);
  };

  /* -------------------------------------------------
     Image upload
  -------------------------------------------------- */
  const handleFileChange = (e) => {
    const file =
      e.target.files[0];

    if (!file) return;

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      alert(
        'Image must be smaller than 10MB.'
      );

      return;
    }

    setSelectedFile(file);

    setFilePreview(
      URL.createObjectURL(file)
    );
  };

  /* -------------------------------------------------
     Submit issue
  -------------------------------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token || !user) {
  alert('Please login before reporting an issue.');
  return;
  }
    if (!selectedLocation) {
      alert(
        'Please select the incident location on the map.'
      );

      return;
    }

    setLoading(true);

    try {
      const [
        latitude,
        longitude,
      ] = selectedLocation;

      /*
       * IMPORTANT:
       *
       * Leaflet uses:
       * [latitude, longitude]
       *
       * MongoDB GeoJSON uses:
       * [longitude, latitude]
       */

      const data = new FormData();

      data.append(
        'title',
        formData.title
      );

      data.append(
        'category',
        formData.category
      );

      data.append(
      'severity',
      formData.severity
    );

      data.append(
        'description',
        formData.description
      );

      data.append(
        'address',
        formData.address
      );

      // Send coordinates to backend
      data.append(
        'latitude',
        latitude
      );

      data.append(
        'longitude',
        longitude
      );

      if (selectedFile) {
        data.append(
          'image',
          selectedFile
        );
      }

     const response = await axios.post(
  `${API_BASE}/api/issues`,
  data,
  {
    headers: {
      'Content-Type': 'multipart/form-data',
      Authorization: `Bearer ${token}`,
    },
  }
);

setVerificationIssueId(response.data._id);

      // Reset form
     setFormData({
      title: '',
      category: 'Road Damage / Potholes',
      severity: 'Medium',
      description: '',
      address: '',
    });

      setSelectedFile(null);
      setFilePreview(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Reload MongoDB issues
      fetchIssues();

    } catch (err) {
      console.error(
        'Submission error:',
        err
      );

      alert(
        'Could not submit report. Check backend server.'
      );
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------
     Upvote
  -------------------------------------------------- */
 
const handleUpvote = async (id) => {
  try {
    const res = await axios.patch(
      `${API_BASE}/api/issues/${id}/upvote`,
      {},
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    setIssues((previous) =>
      previous.map((item) =>
        item._id === id ? res.data : item
      )
    );
  } catch (err) {
    const message =
      err.response?.data?.error || 'Upvote failed';

    alert(message);
  }
};

  /* -------------------------------------------------
     Statistics
  -------------------------------------------------- */

  const totalIssues =
    issues.length;

  const criticalIssues =
    issues.filter(
      (issue) =>
        issue.status?.toLowerCase() ===
        'critical'
    ).length;

  const inProgressIssues =
    issues.filter(
      (issue) =>
        issue.status?.toLowerCase() ===
        'in progress'
    ).length;

  const resolvedIssues =
    issues.filter(
      (issue) =>
        issue.status?.toLowerCase() ===
        'resolved'
    ).length;

      if (user && ['department', 'admin'].includes(user.role)) {
  return (
    <DepartmentDashboard
      token={token}
      user={user}
      onLogout={handleLogout}
    />
  );
}

  return (
    <div className="civic-app">

      {/* =========================================
          NAVBAR
      ========================================== */}

      <header className="civic-navbar">

        <div className="nav-left-group">

          <div className="brand-badge-wrapper">

            <div className="brand-shield">
              <ShieldCheck
                size={20}
                strokeWidth={2.5}
              />
            </div>

            <span className="brand-title-text">
              CivicPulse
            </span>

            <span className="portal-tag">
              Public Portal
            </span>

          </div>

          <nav className="nav-links-menu">

            <button className="nav-item-btn active">
              <PlusCircle size={16} />
              Report Issue
            </button>

            <button className="nav-item-btn">
              <MapPin size={16} />
              Live Map
            </button>

            <button className="nav-item-btn">
              <button
                type="button"
                className={`nav-item-btn ${showMyReports ? 'active' : ''}`}
                onClick={() => {
                  setShowMyReports(true);

                  if (token) {
                    fetchMyReports();
                  } else {
                    setMyReportsError('Please log in to view your reports.');
                  }

                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              >
                <TrendingUp size={16} />
                Track Reports
              </button>
            </button>

          </nav>

        </div>

        {user ? (
  <div className="user-status-card">

    <div className="user-avatar-badge">
      {user.name?.charAt(0).toUpperCase()}
    </div>

    <div className="user-details">

      <div className="user-name">
        {user.name}
      </div>

      <div className="user-indicator">
        ● Logged In
      </div>

    </div>

    <button
      type="button"
      className="refresh-map-button"
      onClick={handleLogout}
    >
      Logout
    </button>

  </div>
) : (
  <button
    type="button"
    className="gps-button"
    onClick={() => {
      setAuthMode('login');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }}
  >
    Login
  </button>
)}

      </header>

      {/* =========================================
          PAGE HEADER
      ========================================== */}

      {!user && (
  <section
    className="grid-panel"
    style={{ margin: '25px 5% 0' }}
  >
    <div className="panel-header">
      <div>
        <h2 className="panel-heading">
          {authMode === 'login'
            ? 'Citizen Login'
            : 'Citizen Registration'}
        </h2>

        <p className="panel-subheading">
          {authMode === 'login'
            ? 'Login to report and track civic issues.'
            : 'Create your citizen account to report issues.'}
        </p>
      </div>
    </div>

    <form
      onSubmit={handleAuthSubmit}
      className="incident-form"
    >
      {authMode === 'register' && (
        <div className="form-field-group">
          <label className="field-label">
            Name <span>*</span>
          </label>

          <input
            className="text-control"
            type="text"
            name="name"
            placeholder="Enter your name"
            value={authData.name}
            onChange={handleAuthChange}
            required
          />
        </div>
      )}

      <div className="form-field-group">
        <label className="field-label">
          Email <span>*</span>
        </label>

        <input
          className="text-control"
          type="email"
          name="email"
          placeholder="Enter your email"
          value={authData.email}
          onChange={handleAuthChange}
          required
        />
      </div>

      <div className="form-field-group">
        <label className="field-label">
          Password <span>*</span>
        </label>

        <input
          className="text-control"
          type="password"
          name="password"
          placeholder="Enter your password"
          value={authData.password}
          onChange={handleAuthChange}
          required
        />
      </div>

      <button
        type="submit"
        className="btn-report-submit"
        disabled={authLoading}
      >
        {authLoading
          ? 'Please wait...'
          : authMode === 'login'
            ? 'Login'
            : 'Create Account'}
      </button>

      <p
        className="submit-note"
        style={{ cursor: 'pointer' }}
        onClick={() =>
          setAuthMode(
            authMode === 'login'
              ? 'register'
              : 'login'
          )
        }
      >
        {authMode === 'login'
          ? 'New citizen? Create an account'
          : 'Already registered? Login'}
      </p>
    </form>
  </section>
)}

      <section className="page-intro">

        <div>

          <div className="intro-label">
            CIVIC ISSUE MANAGEMENT
          </div>

          <h1>
            Make your city better,
            <span> one report at a time.</span>
          </h1>

          <p>
            Report infrastructure problems,
            select the exact location and help
            resolve civic issues faster.
          </p>

        </div>

        <div className="location-status-card">

          <div className="location-status-icon">
            <MapPin size={20} />
          </div>

          <div>

            <strong>
              {locationStatus}
            </strong>

            <span>
              {selectedLocation
                ? `${selectedLocation[0].toFixed(
                    6
                  )}° N, ${selectedLocation[1].toFixed(
                    6
                  )}° E`
                : 'Select a location on the map'}
            </span>

          </div>

        </div>

      </section>

      {/* =========================================
          STATISTICS
      ========================================== */}

      <section className="stats-container">

        <div className="stat-card">

          <div className="stat-icon stat-blue">
            📋
          </div>

          <div>
            <span>Total Reports</span>
            <strong>{totalIssues}</strong>
          </div>

        </div>

        <div className="stat-card">

          <div className="stat-icon stat-red">
            ⚠
          </div>

          <div>
            <span>Critical</span>
            <strong>{criticalIssues}</strong>
          </div>

        </div>

        <div className="stat-card">

          <div className="stat-icon stat-orange">
            🔄
          </div>

          <div>
            <span>In Progress</span>
            <strong>{inProgressIssues}</strong>
          </div>

        </div>

        <div className="stat-card">

          <div className="stat-icon stat-green">
            ✓
          </div>

          <div>
            <span>Resolved</span>
            <strong>{resolvedIssues}</strong>
          </div>

        </div>

      </section>

      {/* =========================================
          MAIN DASHBOARD
      ========================================== */}

      {showMyReports && (
        <section
          className="grid-panel"
          style={{ margin: '25px 5%', padding: '24px' }}
        >
          <div className="panel-header">
            <div>
              <h2 className="panel-heading">My Reports</h2>
              <p className="panel-subheading">
                Track the progress and resolution of your civic complaints.
              </p>
            </div>

            <button
              type="button"
              className="refresh-map-button"
              onClick={fetchMyReports}
              disabled={myReportsLoading || !token}
            >
              {myReportsLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {!token ? (
            <p>Please log in to view your reports.</p>
          ) : myReportsLoading && myReports.length === 0 ? (
            <p>Loading your reports...</p>
          ) : myReportsError ? (
            <div>
              <p role="alert">{myReportsError}</p>
              <button
                type="button"
                className="refresh-map-button"
                onClick={fetchMyReports}
              >
                Try Again
              </button>
            </div>
          ) : (
            <>
              <div className="stats-container">
                <div className="stat-card">
                  <div className="stat-icon stat-blue">📋</div>
                  <div>
                    <span>Total Reports</span>
                    <strong>{myReports.length}</strong>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon stat-orange">🔄</div>
                  <div>
                    <span>In Progress</span>
                    <strong>
                      {myReports.filter(
                        (issue) => issue.status === 'In Progress'
                      ).length}
                    </strong>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon stat-green">✓</div>
                  <div>
                    <span>Resolved</span>
                    <strong>
                      {myReports.filter(
                        (issue) => issue.status === 'Resolved'
                      ).length}
                    </strong>
                  </div>
                </div>
              </div>

              {myReports.length === 0 ? (
                <p>You haven't submitted any reports yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: '20px' }}>
                  {myReports.map((issue) => (
                    <article
                      key={issue._id}
                      style={{
                        border: '1px solid #dbe2ea',
                        borderRadius: '12px',
                        padding: '18px',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <h3 style={{ margin: 0 }}>
                          {issue.title || issue.category || 'Civic Report'}
                        </h3>

                        <span>
                          <strong>Status:</strong> {issue.status || 'Reported'}
                        </span>
                      </div>

                      <p>
                        <strong>Report ID:</strong> {issue._id}
                      </p>
                      <p>
                        <strong>Submitted:</strong>{' '}
                        {issue.createdAt
                          ? new Date(issue.createdAt).toLocaleString()
                          : 'Date unavailable'}
                      </p>
                      <p>
                        <strong>Category:</strong> {issue.category || 'N/A'}
                      </p>
                      <p>
                        <strong>Severity:</strong> {issue.severity || 'N/A'}
                      </p>
                      <p>
                        <strong>Department:</strong> {issue.department || 'N/A'}
                      </p>
                      <p>
                        <strong>Location:</strong>{' '}
                        {issue.location?.address || 'Location unavailable'}
                      </p>
                      <p>
                        <strong>Description:</strong>{' '}
                        {issue.description || 'No description provided.'}
                      </p>

                      {issue.imageUrl && (
                        <div style={{ margin: '14px 0' }}>
                          <p><strong>Original complaint photo</strong></p>
                          <img
                            src={
                              issue.imageUrl.startsWith('http')
                                ? issue.imageUrl
                                : `${API_BASE}${issue.imageUrl.startsWith('/') ? '' : '/'}${issue.imageUrl}`
                            }
                            alt="Original complaint"
                            loading="lazy"
                            style={{
                              width: '100%',
                              maxWidth: '420px',
                              maxHeight: '280px',
                              objectFit: 'contain',
                              borderRadius: '8px',
                            }}
                          />
                        </div>
                      )}

                      {issue.imageVerificationStatus && (
                        <p>
                          <strong>Image verification:</strong>{' '}
                          {issue.imageVerificationStatus}
                          {issue.imageVerificationReason
                            ? ` — ${issue.imageVerificationReason}`
                            : ''}
                        </p>
                      )}

                      <div style={{ marginTop: '18px' }}>
                        <h4>Status history</h4>

                        {issue.statusHistory?.length ? (
                          <ol style={{ paddingLeft: '22px' }}>
                            {issue.statusHistory.map((entry, index) => (
                              <li key={`${issue._id}-history-${index}`} style={{ marginBottom: '12px' }}>
                                <strong>{entry.status}</strong>
                                <div>
                                  {entry.changedAt
                                    ? new Date(entry.changedAt).toLocaleString()
                                    : 'Date unavailable'}
                                </div>
                                {entry.note && <p>{entry.note}</p>}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p>No status history is available yet.</p>
                        )}
                      </div>

                      {issue.status === 'Resolved' && (
                        <div
                          style={{
                            marginTop: '16px',
                            padding: '14px',
                            background: '#f0fdf4',
                            borderRadius: '8px',
                          }}
                        >
                          <h4>Resolution details</h4>
                          <p>
                            <strong>Resolution note:</strong>{' '}
                            {issue.resolutionNote || 'No resolution note provided.'}
                          </p>
                          <p>
                            <strong>Resolved on:</strong>{' '}
                            {issue.resolvedAt
                              ? new Date(issue.resolvedAt).toLocaleString()
                              : 'Date unavailable'}
                          </p>
                          {issue.resolvedBy?.name && (
                            <p>
                              <strong>Resolved by:</strong> {issue.resolvedBy.name}
                            </p>
                          )}

                          {issue.repairImageUrl ? (
                            <div>
                              <p><strong>Repair photo</strong></p>
                              <img
                                src={
                                  issue.repairImageUrl.startsWith('http')
                                    ? issue.repairImageUrl
                                    : `${API_BASE}${issue.repairImageUrl.startsWith('/') ? '' : '/'}${issue.repairImageUrl}`
                                }
                                alt="Completed repair"
                                loading="lazy"
                                style={{
                                  width: '100%',
                                  maxWidth: '420px',
                                  maxHeight: '280px',
                                  objectFit: 'contain',
                                  borderRadius: '8px',
                                }}
                              />
                            </div>
                          ) : (
                            <p>Repair photo has not been provided.</p>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      <main className="app-viewport">

        {verificationIssueId && (() => {
          const verifiedIssue = issues.find(
            (item) => item._id === verificationIssueId
          );

          if (!verifiedIssue) {
            return (
              <div className="verification-card">
                <h3>AI Image Verification</h3>
                <p>Loading complaint details...</p>
              </div>
            );
          }

          const status = verifiedIssue.imageVerificationStatus;
          const isPending = status === 'Pending Verification';

          return (
            <div className="verification-card">
              <h3>AI Image Verification</h3>

              <p>
                <strong>Status:</strong>{' '}
                {isPending ? 'Verification in progress...' : status}
              </p>

              <p>
                <strong>Reason:</strong>{' '}
                {verifiedIssue.imageVerificationReason ||
                  'No explanation available.'}
              </p>

              {isPending && (
                <p>
                  Please wait. This result updates automatically.
                </p>
              )}
            </div>
          );
        })()}


        {/* =====================================
            LEFT: REPORT FORM
        ====================================== */}

        <section className="grid-panel">

          <div className="panel-header">

            <div>

              <h2 className="panel-heading">
                <Camera
                  size={19}
                  color="#2563eb"
                />

                Report New Incident
              </h2>

              <p className="panel-subheading">
                Submit geotagged infrastructure
                and civic issues directly.
              </p>

            </div>

            <span className="required-badge">
              Required
            </span>

          </div>

          <form
            onSubmit={handleSubmit}
            className="incident-form"
          >

            {/* TITLE */}

            <div className="form-field-group">

              <label className="field-label">
                Issue Title
                <span>*</span>
              </label>

              <input
                className="text-control"
                type="text"
                name="title"
                placeholder="e.g., Damaged manhole cover near market"
                value={formData.title}
                onChange={handleChange}
                required
              />

            </div>

            {/* CATEGORY */}

            <div className="form-field-group">

              <label className="field-label">
                Category
                <span>*</span>
              </label>

              <select
                className="select-control"
                name="category"
                value={formData.category}
                onChange={handleChange}
              >

                <option value="Road Damage / Potholes">
                  Road Damage / Potholes
                </option>

                <option value="Streetlight Fault">
                  Streetlight Fault
                </option>

                <option value="Garbage Overflow">
                  Garbage Overflow
                </option>

                <option value="Water Supply Issue">
                  Water Supply Issue
                </option>

              </select>

            </div>


{/* SEVERITY */}

<div className="form-field-group">
  <label className="field-label">
    Issue Severity
    <span>*</span>
  </label>

  <select
    className="select-control"
    name="severity"
    value={formData.severity}
    onChange={handleChange}
    required
  >
    <option value="Low">Low</option>
    <option value="Medium">Medium</option>
    <option value="High">High</option>
    <option value="Critical">Critical</option>
  </select>
</div>

            {/* DESCRIPTION */}

            <div className="form-field-group">

              <label className="field-label">
                Problem Description
                <span>*</span>
              </label>

              <textarea
                className="textarea-control"
                rows="3"
                name="description"
                placeholder="Describe the severity and landmarks..."
                value={formData.description}
                onChange={handleChange}
                required
              />

            </div>

            {/* LOCATION */}

            <div className="location-selection-card">

              <div className="location-card-left">

                <div className="location-card-icon">
                  <Crosshair size={17} />
                </div>

                <div>

                  <strong>
                    Incident Location
                  </strong>

                  <span>
                    {selectedLocation
                      ? `${selectedLocation[0].toFixed(
                          6
                        )}° N, ${selectedLocation[1].toFixed(
                          6
                        )}° E`
                      : 'No location selected'}
                  </span>

                </div>

              </div>

              <button
                type="button"
                className="gps-button"
                onClick={getCurrentLocation}
                disabled={locationLoading}
              >
                <Crosshair size={14} />

                {locationLoading
                  ? 'Detecting...'
                  : 'Use My Location'}
              </button>

            </div>

            <div className="location-help">

              <MapPin size={14} />

              <span>
                You can use your GPS location,
                click anywhere on the map, or
                drag the blue marker to the exact
                incident location.
              </span>

            </div>

            {/* ADDRESS */}

            <div className="form-field-group">

              <label className="field-label">
                Location Details
              </label>

              <input
                className="text-control"
                type="text"
                name="address"
                placeholder="Nearby landmark or address"
                value={formData.address}
                onChange={handleChange}
              />

            </div>

            {/* IMAGE */}

            <div className="form-field-group">

              <label className="field-label">
                Photographic Evidence
              </label>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden-file-input"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
              />

              <div
                className="dropzone-container"
                onClick={() =>
                  fileInputRef.current?.click()
                }
              >

                {filePreview ? (

                  <div className="image-preview-wrapper">

                    <img
                      src={filePreview}
                      alt="Selected incident"
                      className="image-preview"
                    />

                    <p className="dropzone-text">
                      Click to change selected photo
                    </p>

                  </div>

                ) : (

                  <div className="upload-content">

                    <UploadCloud
                      size={28}
                      color="#94a3b8"
                    />

                    <p className="dropzone-text">
                      Upload geotagged photographic proof
                    </p>

                    <span className="dropzone-sub">
                      JPEG, PNG or WebP up to 10MB
                    </span>

                  </div>

                )}

              </div>

            </div>

            {/* AI */}

            <div className="ai-status">

              <div className="ai-icon">
                ✦
              </div>

              <div className="ai-text">

                <strong>
                  AI Image Authenticity Check
                </strong>

                <span>
                  Image verification can be
                  performed before final validation.
                </span>

              </div>

              <span className="ai-valid-tag">
                Active
              </span>

            </div>

            {/* SUBMIT */}

            <button
              type="submit"
              className="btn-report-submit"
              disabled={loading}
            >
              {loading
                ? 'Submitting...'
                : 'Submit Incident Report →'}
            </button>

            <p className="submit-note">
              The selected map coordinates will
              be attached to this report.
            </p>

          </form>

        </section>

        {/* =====================================
            RIGHT: MAP
        ====================================== */}

        <section className="grid-panel map-panel">

          <div className="panel-header">

            <div>

              <h2 className="panel-heading">

                <MapPin
                  size={19}
                  color="#2563eb"
                />

                Real-Time Geospatial Grid

              </h2>

              <p className="panel-subheading">
                Live geotagged issue incidents
                across assigned sectors.
              </p>

            </div>

            <div className="stream-live-pill">

              <span className="pulse-circle"></span>

              Live Stream

            </div>

          </div>

          <div className="map-instruction">

            <MapPin size={14} />

            <span>
              Click the map to select a location.
              Drag the blue marker to fine-tune it.
            </span>

          </div>

          <div className="leaflet-frame">

            <MapContainer
              center={
                selectedLocation ||
                defaultCoords
              }
              zoom={13}
              scrollWheelZoom={true}
              style={{
                height: '100%',
                width: '100%',
              }}
            >

              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Recenter when GPS/location changes */}

              <RecenterMap
                position={selectedLocation}
              />

              {/* Map click */}

              <MapClickHandler
                onLocationSelect={
                  handleLocationSelect
                }
              />

              {/* =================================
                  SELECTED INCIDENT MARKER
              ================================== */}

              {selectedLocation && (

                <Marker
                  position={selectedLocation}
                  draggable={true}
                  eventHandlers={{
                    dragend:
                      handleMarkerDragEnd,
                  }}
                >

                  <Popup>

                    <div className="selected-popup">

                      <strong>
                        Selected Incident Location
                      </strong>

                      <p>
                        Drag this marker to the
                        exact location of the issue.
                      </p>

                      <small>
                        Latitude:{' '}
                        {selectedLocation[0].toFixed(
                          6
                        )}
                        <br />
                        Longitude:{' '}
                        {selectedLocation[1].toFixed(
                          6
                        )}
                      </small>

                    </div>

                  </Popup>

                </Marker>

              )}

              {/* =================================
                  MONGODB ISSUE MARKERS
              ================================== */}

              {issues.map((issue) => {

                /*
                 * Backend should store:
                 *
                 * coordinates: [
                 *   longitude,
                 *   latitude
                 * ]
                 */

                const coordinates =
                  issue.location?.coordinates;

                if (
                  !coordinates ||
                  coordinates.length < 2
                ) {
                  return null;
                }

                const latitude =
                  Number(coordinates[0]);

                const longitude =
                  Number(coordinates[1]);

                if (
                  Number.isNaN(latitude) ||
                  Number.isNaN(longitude)
                ) {
                  return null;
                }

                return (

                  <Marker
                    key={issue._id}
                    position={[
                      latitude,
                      longitude,
                    ]}
                    icon={getStatusMarker(issue.status)}                  >

                    <Popup>

                      <div className="custom-popup">

                        {issue.imageUrl && (

                          <img
                            src={issue.imageUrl}
                            alt={issue.title}
                            className="popup-image"
                          />

                        )}

                        <h4>
                          {issue.title}
                        </h4>

                        <p>
                          {issue.description}
                        </p>
                        <div className="popup-lifecycle">
                          <p>
                            <strong>Current status:</strong>{' '}
                            {issue.status || 'Reported'}
                          </p>

                          {issue.resolutionNote && (
                            <div>
                              <strong>Resolution details:</strong>
                              <p>{issue.resolutionNote}</p>
                            </div>
                          )}

                          {issue.repairImageUrl && (
                            <div>
                              <strong>After-repair photo:</strong>
                              <a
                                href={issue.repairImageUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={issue.repairImageUrl}
                                  alt={`${issue.title} after repair`}
                                  className="popup-image"
                                />
                                View repair evidence
                              </a>
                            </div>
                          )}

                          {issue.statusHistory?.length > 0 && (
                            <div>
                              <strong>Complaint history:</strong>
                              <ul>
                                {issue.statusHistory.map((entry, index) => (
                                  <li key={`${entry.changedAt}-${index}`}>
                                    <strong>{entry.status}</strong>
                                    {entry.changedAt && (
                                      <small>
                                        {' '}
                                        — {new Date(entry.changedAt).toLocaleString()}
                                      </small>
                                    )}
                                    {entry.note && <p>{entry.note}</p>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        <div className="popup-bottom">

                          <span className="popup-tag">
                            {issue.category}
                          </span>
                          <span className="popup-tag">
                      Severity: {issue.severity || 'Medium'}
                        </span>

                          <span className="popup-tag">
                      Department: {issue.department || 'General Department'}
                          </span>

                          <span className="popup-tag">
                            Priority: {issue.priority || 'Low'}
                          </span>
                          <button
                            className="upvote-button"
                            onClick={() =>
                              handleUpvote(
                                issue._id
                              )
                            }
                          >
                            ▲ {issue.upvotes || 0}
                          </button>

                        </div>

                        {issue.location
                          ?.address && (

                          <small className="popup-address">
                            📍{' '}
                            {issue.location.address}
                          </small>

                        )}

                      </div>

                    </Popup>

                  </Marker>

                );
              })}

            </MapContainer>

            <div className="map-count-badge">

              <span></span>

              {issues.length} reports

            </div>

          </div>

          <div className="map-status-bar">

            <div className="legend-items-list">

              <span className="legend-chip">
                <span className="circle-critical"></span>
                Critical
              </span>

              <span className="legend-chip">
                <span className="circle-progress"></span>
                In Progress
              </span>

              <span className="legend-chip">
                <span className="circle-resolved"></span>
                Resolved
              </span>

            </div>

            <button
              className="refresh-map-button"
              onClick={fetchIssues}
            >
              ↻ Refresh
            </button>

          </div>

        </section>

      </main>

      {/* =========================================
          FOOTER
      ========================================== */}

      <footer className="civic-footer">

        <div>

          <strong>
            CivicPulse
          </strong>

          <span>
            Community-powered civic issue reporting
          </span>

        </div>

        <span>
          Secure · Transparent · Community Driven
        </span>

      </footer>

    </div>
  );
}

export default App;
