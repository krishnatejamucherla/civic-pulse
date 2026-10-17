
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Activity,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import './DepartmentDashboard.css';

const API = 'http://localhost:5000/api/issues';

const STATUSES = ['Reported', 'In Progress', 'Resolved'];

const NAV_ITEMS = [
  { label: 'Overview', filter: 'All', icon: LayoutDashboard },
  { label: 'Reported', filter: 'Reported', icon: AlertCircle },
  { label: 'In Progress', filter: 'In Progress', icon: Clock3 },
  { label: 'Resolved', filter: 'Resolved', icon: CheckCircle2 },
];

function DepartmentDashboard({ token, user, onLogout }) {
  const [issues, setIssues] = useState([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState({});
  const [pendingStatus, setPendingStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const loadIssues = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      setError('');

      const response = await axios.get(`${API}/department`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setIssues(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Unable to load complaints. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  const counts = useMemo(() => ({
    All: issues.length,
    Reported: issues.filter((i) => i.status === 'Reported').length,
    'In Progress': issues.filter((i) => i.status === 'In Progress').length,
    Resolved: issues.filter((i) => i.status === 'Resolved').length,
  }), [issues]);

  const criticalCount = issues.filter(
    (issue) => issue.severity === 'Critical'
  ).length;

  const visibleIssues = useMemo(() => {
    const term = search.trim().toLowerCase();

    return issues.filter((issue) => {
      const matchesStatus =
        filter === 'All' || issue.status === filter;

      const matchesSearch = !term || [
        issue.title,
        issue.description,
        issue.category,
        issue.department,
        issue.location?.address,
        issue.reportedBy?.name,
      ].some((value) => String(value || '').toLowerCase().includes(term));

      return matchesStatus && matchesSearch;
    });
  }, [issues, filter, search]);

  const updateStatus = async (issue) => {
    const status = pendingStatus[issue._id] ?? issue.status;

    if (!STATUSES.includes(status)) return;

    if (status === 'Resolved' && issue.status !== 'Resolved') {
      const confirmed = window.confirm(
        'Mark this complaint as resolved? Make sure the work is complete.'
      );
      if (!confirmed) return;
    }

    setSavingId(issue._id);
    setError('');

    try {
      await axios.patch(
        `${API}/${issue._id}/status`,
        {
          status,
          note: notes[issue._id] || '',
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      await loadIssues(true);

      setNotes((previous) => ({
        ...previous,
        [issue._id]: '',
      }));

      setPendingStatus((previous) => {
        const next = { ...previous };
        delete next[issue._id];
        return next;
      });
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'Unable to update complaint status.'
      );
    } finally {
      setSavingId(null);
    }
  };

  const selectFilter = (nextFilter) => {
    setFilter(nextFilter);
    setSidebarOpen(false);
  };

  const formatDate = (date) => {
    if (!date) return 'Date unavailable';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) return 'Date unavailable';

    return parsed.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getInitials = (name) => {
    return (name || 'Staff')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  };

  return (
    <div className="cp-dashboard">
      {sidebarOpen && (
        <button
          className="cp-sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`cp-sidebar ${sidebarOpen ? 'cp-sidebar-open' : ''}`}>
        <a className="cp-brand" href="#dashboard" onClick={() => selectFilter('All')}>
          <span className="cp-brand-mark">
            <ShieldCheck size={25} strokeWidth={2.3} />
          </span>
          <span className="cp-brand-copy">
            <strong>CivicPulse</strong>
            <small>CIVIC OPERATIONS</small>
          </span>
          <button
            className="cp-mobile-close"
            aria-label="Close sidebar"
            onClick={(event) => {
              event.preventDefault();
              setSidebarOpen(false);
            }}
          >
            <X size={19} />
          </button>
        </a>

        <div className="cp-workspace-label">WORKSPACE</div>

        <nav className="cp-navigation" aria-label="Dashboard navigation">
          {NAV_ITEMS.map(({ label, filter: itemFilter, icon: Icon }) => (
            <button
              key={label}
              className={`cp-nav-item ${filter === itemFilter ? 'active' : ''}`}
              onClick={() => selectFilter(itemFilter)}
            >
              <Icon size={19} />
              <span>{label}</span>
              <span className="cp-nav-count">{counts[itemFilter]}</span>
            </button>
          ))}
        </nav>

        <div className="cp-sidebar-divider" />

        <div className="cp-workspace-label">YOUR ACCESS</div>

        <div className="cp-access-card">
          <span className="cp-access-icon">
            {isAdmin ? <Users size={18} /> : <ShieldCheck size={18} />}
          </span>
          <div>
            <strong>{isAdmin ? 'Administrator' : 'Department staff'}</strong>
            <span>{isAdmin ? 'All departments' : user?.department || 'Department not assigned'}</span>
          </div>
        </div>

        <div className="cp-sidebar-bottom">
          <div className="cp-sidebar-status">
            <span className="cp-live-dot" />
            <span>Dashboard connected</span>
          </div>
          <button className="cp-logout-button" onClick={onLogout}>
            <LogOut size={18} />
            <span>Log out</span>
          </button>
          <div className="cp-sidebar-footer">CivicPulse · Operations Portal</div>
        </div>
      </aside>

      <div className="cp-main">
        <header className="cp-topbar">
          <div className="cp-topbar-left">
            <button
              className="cp-icon-button cp-mobile-menu"
              aria-label="Open navigation"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={21} />
            </button>
            <div className="cp-breadcrumb">
              <span>Workspace</span>
              <span className="cp-breadcrumb-separator">/</span>
              <strong>
                {filter === 'All' ? 'Overview' : filter}
              </strong>
            </div>
          </div>

          <div className="cp-topbar-right">
            <span className="cp-topbar-date">
              <Activity size={16} />
              Live operations
            </span>
            <div className="cp-topbar-divider" />
            <div className="cp-profile">
              <span className="cp-avatar">{getInitials(user?.name)}</span>
              <span className="cp-profile-copy">
                <strong>{user?.name || 'Staff member'}</strong>
                <small>{isAdmin ? 'Administrator' : 'Department staff'}</small>
              </span>
              <ChevronDown size={16} className="cp-profile-chevron" />
            </div>
          </div>
        </header>

        <main className="cp-content" id="dashboard">
          <section className="cp-page-heading">
            <div>
              <div className="cp-eyebrow">CIVIC OPERATIONS CENTER</div>
              <h1>{filter === 'All' ? 'Dashboard overview' : `${filter} complaints`}</h1>
              <p>
                Monitor community issues, coordinate action, and track resolution.
              </p>
            </div>
            <button
              className="cp-button cp-button-secondary"
              onClick={() => loadIssues(true)}
              disabled={refreshing}
            >
              <RefreshCw size={16} className={refreshing ? 'cp-spin' : ''} />
              {refreshing ? 'Refreshing' : 'Refresh data'}
            </button>
          </section>

          {error && (
            <div className="cp-error-banner" role="alert">
              <AlertCircle size={19} />
              <span>{error}</span>
              <button onClick={() => loadIssues(true)}>Try again</button>
            </div>
          )}

          <section className="cp-stat-grid" aria-label="Complaint statistics">
            <button
              className={`cp-stat-card ${filter === 'All' ? 'cp-stat-selected' : ''}`}
              onClick={() => selectFilter('All')}
            >
              <div className="cp-stat-top">
                <span>Total complaints</span>
                <span className="cp-stat-icon cp-icon-blue">
                  <ClipboardList size={20} />
                </span>
              </div>
              <div className="cp-stat-number">{loading ? '—' : counts.All}</div>
              <div className="cp-stat-foot">
                <span className="cp-stat-foot-muted">All recorded issues</span>
              </div>
            </button>

            <button
              className={`cp-stat-card ${filter === 'Reported' ? 'cp-stat-selected' : ''}`}
              onClick={() => selectFilter('Reported')}
            >
              <div className="cp-stat-top">
                <span>Awaiting action</span>
                <span className="cp-stat-icon cp-icon-amber">
                  <AlertCircle size={20} />
                </span>
              </div>
              <div className="cp-stat-number">{loading ? '—' : counts.Reported}</div>
              <div className="cp-stat-foot">
                <span className="cp-stat-foot-muted">Reported complaints</span>
              </div>
            </button>

            <button
              className={`cp-stat-card ${filter === 'In Progress' ? 'cp-stat-selected' : ''}`}
              onClick={() => selectFilter('In Progress')}
            >
              <div className="cp-stat-top">
                <span>In progress</span>
                <span className="cp-stat-icon cp-icon-violet">
                  <Clock3 size={20} />
                </span>
              </div>
              <div className="cp-stat-number">{loading ? '—' : counts['In Progress']}</div>
              <div className="cp-stat-foot">
                <span className="cp-stat-foot-muted">Currently being handled</span>
              </div>
            </button>

            <button
              className={`cp-stat-card ${filter === 'Resolved' ? 'cp-stat-selected' : ''}`}
              onClick={() => selectFilter('Resolved')}
            >
              <div className="cp-stat-top">
                <span>Resolved</span>
                <span className="cp-stat-icon cp-icon-green">
                  <CheckCircle2 size={20} />
                </span>
              </div>
              <div className="cp-stat-number">{loading ? '—' : counts.Resolved}</div>
              <div className="cp-stat-foot">
                <span className="cp-stat-foot-muted">Completed complaints</span>
              </div>
            </button>
          </section>

          {criticalCount > 0 && (
            <div className="cp-priority-banner">
              <span className="cp-priority-icon">
                <AlertCircle size={20} />
              </span>
              <div>
                <strong>{criticalCount} critical {criticalCount === 1 ? 'complaint needs' : 'complaints need'} attention</strong>
                <p>Review critical-severity issues and prioritize appropriate action.</p>
              </div>
              <ArrowUpRight size={19} className="cp-priority-arrow" />
            </div>
          )}

          <section className="cp-complaints-section">
            <div className="cp-section-heading">
              <div>
                <h2>Complaint management</h2>
                <p>Review issue details and update their progress.</p>
              </div>
              <div className="cp-section-total">
                {visibleIssues.length} {visibleIssues.length === 1 ? 'record' : 'records'}
              </div>
            </div>

            <div className="cp-table-toolbar">
              <div className="cp-search-box">
                <Search size={18} />
                <input
                  type="search"
                  placeholder="Search complaints, location..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search complaints"
                />
                {search && (
                  <button aria-label="Clear search" onClick={() => setSearch('')}>
                    <X size={16} />
                  </button>
                )}
              </div>

              <div className="cp-filter-tabs">
                {['All', ...STATUSES].map((status) => (
                  <button
                    key={status}
                    className={filter === status ? 'active' : ''}
                    onClick={() => selectFilter(status)}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="cp-state-panel">
                <span className="cp-loading-spinner" />
                <strong>Loading complaints</strong>
                <p>Retrieving the latest records...</p>
              </div>
            ) : visibleIssues.length === 0 ? (
              <div className="cp-state-panel">
                <span className="cp-empty-icon"><ClipboardList size={25} /></span>
                <strong>{search ? 'No matching complaints' : 'No complaints here yet'}</strong>
                <p>
                  {search
                    ? 'Try another search term or clear your search.'
                    : 'Complaints matching this status will appear here.'}
                </p>
                {search && (
                  <button className="cp-button cp-button-secondary" onClick={() => setSearch('')}>
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="cp-complaint-list">
                {visibleIssues.map((issue) => (
                  <article className="cp-complaint-card" key={issue._id}>
                    <div className="cp-complaint-main">
                      <div className="cp-complaint-heading">
                        <div className="cp-complaint-title-group">
                          <span className="cp-complaint-id">
                            ID · {String(issue._id).slice(-8).toUpperCase()}
                          </span>
                          <h3>{issue.title || issue.category || 'Civic complaint'}</h3>
                        </div>
                        <span className={`cp-status-badge cp-status-${(issue.status || 'Reported').toLowerCase().replace(/\s+/g, '-')}`}>
                          <span />
                          {issue.status || 'Reported'}
                        </span>
                      </div>

                      <p className="cp-complaint-description">
                        {issue.description || 'No description provided.'}
                      </p>

                      <div className="cp-complaint-meta">
                        <span><MapPin size={15} />{issue.location?.address || 'Location not provided'}</span>
                        <span><ClipboardList size={15} />{issue.category || 'Uncategorized'}</span>
                        <span><Clock3 size={15} />{formatDate(issue.createdAt)}</span>
                      </div>

                      <div className="cp-complaint-tags">
                        <span className={`cp-severity cp-severity-${(issue.severity || 'Medium').toLowerCase()}`}>
                          {issue.severity || 'Medium'} severity
                        </span>
                        <span className="cp-department-tag">
                          {issue.department || 'General Department'}
                        </span>
                        {issue.imageVerificationStatus && (
                          <span className="cp-verification-tag">
                            AI · {issue.imageVerificationStatus}
                          </span>
                        )}
                      </div>

                      {issue.imageUrl && (
                        <a
                          className="cp-image-link"
                          href={issue.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View complaint photo <ArrowUpRight size={14} />
                        </a>
                      )}

                      {issue.reportedBy && (
                        <p className="cp-reporter">
                          Reported by <strong>{issue.reportedBy.name || 'Citizen'}</strong>
                        </p>
                      )}
                    </div>

                    <div className="cp-update-panel">
                      <label htmlFor={`status-${issue._id}`}>Update status</label>
                      <select
                        id={`status-${issue._id}`}
                        value={pendingStatus[issue._id] ?? issue.status}
                        onChange={(event) => setPendingStatus((previous) => ({
                          ...previous,
                          [issue._id]: event.target.value,
                        }))}
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>

                      <label htmlFor={`note-${issue._id}`}>Progress note</label>
                      <textarea
                        id={`note-${issue._id}`}
                        rows={2}
                        maxLength={500}
                        placeholder="Add an update (optional)"
                        value={notes[issue._id] || ''}
                        onChange={(event) => setNotes((previous) => ({
                          ...previous,
                          [issue._id]: event.target.value,
                        }))}
                      />

                      <button
                        className="cp-button cp-button-primary cp-update-button"
                        disabled={
                          savingId === issue._id ||
                          (pendingStatus[issue._id] ?? issue.status) === issue.status
                        }
                        onClick={() => updateStatus(issue)}
                      >
                        {savingId === issue._id ? 'Saving...' : 'Save changes'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!loading && visibleIssues.length > 0 && (
              <div className="cp-list-footer">
                Showing {visibleIssues.length} of {issues.length} complaints
                <span>Updated when you refresh</span>
              </div>
            )}
          </section>

          <footer className="cp-page-footer">
            <span>© {new Date().getFullYear()} CivicPulse</span>
            <span>Secure · Transparent · Community-driven</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default DepartmentDashboard;
