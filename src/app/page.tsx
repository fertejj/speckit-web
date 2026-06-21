'use client'

import { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  FolderCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Calendar, 
  GitBranch, 
  ArrowRight, 
  History, 
  Sparkles, 
  Clock, 
  CheckSquare, 
  FileText, 
  Layout, 
  ClipboardList, 
  HelpCircle,
  FileCheck,
  ChevronRight,
  Compass,
  Sun,
  Moon
} from 'lucide-react';
import styles from './page.module.css';
import { 
  checkRepository, 
  getFeatures, 
  getFeatureDetails, 
  getHomeDir,
  listDirectory,
  FeatureSummary, 
  FeatureDetails,
  DirectoryContent
} from './actions';

export default function Home() {
  const [repoPath, setRepoPath] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'not_found' | 'invalid_speckit'>('idle');
  const [speckitVersion, setSpeckitVersion] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureSummary[]>([]);
  
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [featureDetail, setFeatureDetail] = useState<FeatureDetails | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'spec' | 'plan' | 'tasks' | 'walkthrough' | 'requirements'>('spec');
  
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Theme & Scanner Collapse State
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showScanner, setShowScanner] = useState(false);

  // File Explorer State
  const [isOpenExplorer, setIsOpenExplorer] = useState(false);
  const [explorerPath, setExplorerPath] = useState('');
  const [explorerContent, setExplorerContent] = useState<DirectoryContent | null>(null);
  const [loadingExplorer, setLoadingExplorer] = useState(false);

  const historyRef = useRef<HTMLDivElement>(null);

  // Load theme and history from localStorage on mount
  useEffect(() => {
    // Theme setup
    const savedTheme = localStorage.getItem('speckit_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // History setup
    const savedHistory = localStorage.getItem('speckit_repo_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch {}
    }

    const lastRepo = localStorage.getItem('speckit_last_repo');
    if (lastRepo) {
      setRepoPath(lastRepo);
      handleScan(lastRepo);
    }
  }, []);

  // Update theme helper
  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('speckit_theme', nextTheme);
  };

  // Close history menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // File Explorer Actions
  const handleOpenExplorer = async () => {
    setIsOpenExplorer(true);
    setLoadingExplorer(true);
    
    let startPath = repoPath.trim();
    if (!startPath) {
      startPath = localStorage.getItem('speckit_last_repo') || '';
    }
    const homeDir = await getHomeDir();
    if (!startPath) {
      startPath = homeDir;
    }
    
    setExplorerPath(startPath);
    const content = await listDirectory(startPath);
    setExplorerContent(content);
    setLoadingExplorer(false);
  };

  const handleNavigateExplorer = async (targetPath: string) => {
    setLoadingExplorer(true);
    setExplorerPath(targetPath);
    const content = await listDirectory(targetPath);
    setExplorerContent(content);
    setLoadingExplorer(false);
  };

  const handleSelectExplorerFolder = () => {
    setRepoPath(explorerPath);
    handleScan(explorerPath);
    setIsOpenExplorer(false);
  };

  // Scan repository path
  const handleScan = async (pathToCheck: string) => {
    const targetPath = pathToCheck.trim();
    if (!targetPath) return;

    setScanStatus('scanning');
    setSelectedFeatureId(null);
    setFeatureDetail(null);
    setFeatures([]);

    const status = await checkRepository(targetPath);

    if (!status.exists) {
      setScanStatus('not_found');
      setShowScanner(true);
      return;
    }

    if (!status.isSpeckit) {
      setScanStatus('invalid_speckit');
      setShowScanner(true);
      return;
    }

    setScanStatus('success');
    setSpeckitVersion(status.speckitVersion || 'Unknown');
    setShowScanner(false); // Collapse input on success

    // Save to localStorage
    localStorage.setItem('speckit_last_repo', targetPath);
    setHistory(prev => {
      const updated = [targetPath, ...prev.filter(p => p !== targetPath)].slice(0, 8);
      localStorage.setItem('speckit_repo_history', JSON.stringify(updated));
      return updated;
    });

    // Fetch features
    const feats = await getFeatures(targetPath);
    setFeatures(feats);
  };

  // Load feature details when selected
  useEffect(() => {
    if (!selectedFeatureId || scanStatus !== 'success') {
      setFeatureDetail(null);
      return;
    }

    const loadDetails = async () => {
      setLoadingDetail(true);
      const detail = await getFeatureDetails(repoPath, selectedFeatureId);
      setFeatureDetail(detail);
      setLoadingDetail(false);

      // Auto select first available tab
      const currentFeature = features.find(f => f.id === selectedFeatureId);
      if (currentFeature) {
        if (currentFeature.hasSpec) setActiveTab('spec');
        else if (currentFeature.hasPlan) setActiveTab('plan');
        else if (currentFeature.hasTasks) setActiveTab('tasks');
        else if (currentFeature.hasWalkthrough) setActiveTab('walkthrough');
        else if (currentFeature.hasRequirements) setActiveTab('requirements');
      }
    };

    loadDetails();
  }, [selectedFeatureId, repoPath, scanStatus, features]);

  // Calculate global repository stats
  const totalFeatures = features.length;
  const completedFeatures = features.filter(f => f.progress === 100).length;
  const avgProgress = totalFeatures > 0 
    ? Math.round(features.reduce((acc, curr) => acc + curr.progress, 0) / totalFeatures) 
    : 0;

  // Selected feature helper
  const selectedFeature = features.find(f => f.id === selectedFeatureId);

  return (
    <div className={styles.container}>
      {/* Header/Top Bar */}
      <header className={styles.topBar}>
        <div className={styles.logoArea}>
          <Sparkles className={styles.logoIcon} size={20} />
          <span className={styles.logoText}>SpecKit</span>
          {scanStatus === 'success' && (
            <span className={styles.logoSub}>v{speckitVersion}</span>
          )}
        </div>

        {/* Project Switcher OR Scanning Field */}
        {scanStatus === 'success' && !showScanner ? (
          <div className={styles.activeProjectArea}>
            <div className={styles.activeProjectInfo}>
              <FolderCheck size={16} className={styles.projectIcon} />
              <span className={styles.projectName} title={repoPath}>
                {repoPath.split(/[\\/]/).filter(Boolean).pop() || repoPath}
              </span>
            </div>
            <button 
              className={styles.changeProjectBtn} 
              onClick={() => setShowScanner(true)}
              type="button"
            >
              Switch Repository
            </button>
          </div>
        ) : (
          <div className={styles.scanSection}>
            <div className={styles.inputGroup} ref={historyRef}>
              <input 
                type="text" 
                placeholder="Enter absolute repository path (e.g. C:\Users\Fer\Desktop\DEV\dentaflow)..." 
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan(repoPath)}
              />
              <button 
                className={styles.folderPickerBtn} 
                onClick={handleOpenExplorer}
                title="Select Repository Folder"
                type="button"
              >
                <Folder size={16} />
              </button>
              {history.length > 0 && (
                <button 
                  className={styles.historyBtn} 
                  onClick={() => setShowHistory(!showHistory)}
                  title="Recent Repositories"
                  type="button"
                >
                  <History size={16} />
                </button>
              )}
              {showHistory && (
                <div className={styles.historyMenu}>
                  {history.map((path, idx) => (
                    <button 
                      key={idx} 
                      className={styles.historyItem}
                      onClick={() => {
                        setRepoPath(path);
                        handleScan(path);
                        setShowHistory(false);
                      }}
                      type="button"
                    >
                      <Folder size={14} className={styles.historyIcon} />
                      <span>{path}</span>
                    </button>
                  ))}
                </div>
              )}
              <button 
                className={styles.scanButton}
                onClick={() => handleScan(repoPath)}
                disabled={scanStatus === 'scanning'}
                type="button"
              >
                {scanStatus === 'scanning' ? (
                  <Loader2 size={14} className={styles.loadingSpinner} />
                ) : 'Scan'}
              </button>
            </div>
            {scanStatus === 'success' && (
              <button 
                className={styles.cancelScanBtn}
                onClick={() => setShowScanner(false)}
                type="button"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        <div className={styles.headerActions}>
          <button 
            className={styles.themeToggleBtn} 
            onClick={toggleTheme}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            type="button"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <div className={styles.badgeContainer}>
            {scanStatus === 'idle' && (
              <div className={styles.badge}>
                <Folder size={12} />
                <span>Ready</span>
              </div>
            )}
            {scanStatus === 'scanning' && (
              <div className={`${styles.badge} ${styles.badgeInfo}`}>
                <Loader2 size={12} className={styles.loadingSpinner} />
                <span>Checking...</span>
              </div>
            )}
            {scanStatus === 'success' && (
              <div className={`${styles.badge} ${styles.badgeSuccess}`}>
                <FolderCheck size={12} />
                <span>Detected</span>
              </div>
            )}
            {scanStatus === 'invalid_speckit' && (
              <div className={`${styles.badge} ${styles.badgeWarning}`}>
                <AlertCircle size={12} />
                <span>No SpecKit</span>
              </div>
            )}
            {scanStatus === 'not_found' && (
              <div className={`${styles.badge} ${styles.badgeDanger}`}>
                <AlertCircle size={12} />
                <span>Not Found</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <div className={styles.mainLayout}>
        {/* Sidebar */}
        {scanStatus === 'success' && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <button 
                className={`${styles.sidebarHomeBtn} ${!selectedFeatureId ? styles.sidebarHomeBtnActive : ''}`}
                onClick={() => setSelectedFeatureId(null)}
                type="button"
              >
                <Compass size={16} />
                <span>Overview</span>
                <span className={styles.homeProgressBadge}>{avgProgress}%</span>
              </button>
            </div>

            <div className={styles.sidebarTitle}>Features</div>
            <div className={styles.featureList}>
              {features.map((feat) => (
                <button
                  key={feat.id}
                  className={`${styles.featureCard} ${selectedFeatureId === feat.id ? styles.featureCardActive : ''}`}
                  onClick={() => setSelectedFeatureId(feat.id)}
                  type="button"
                >
                  <div className={styles.featureCardTitle}>{feat.title}</div>
                  <div className={styles.featureCardMeta}>
                    <code style={{ fontSize: '0.7rem' }}>{feat.id.split('-')[0]}</code>
                    <span className={styles.progressPill}>{feat.progress}%</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Content Pane */}
        <main className={styles.contentArea}>
          <div className={styles.scrollContainer}>
            {scanStatus === 'idle' && (
              <div className={styles.emptyState}>
                <Sparkles size={48} className={styles.emptyIcon} />
                <h2>SpecKit Dashboard</h2>
                <p>
                  Explore and manage your development specifications, tasks, and implementation plans.
                </p>
                
                <div className={styles.welcomeActions}>
                  <button 
                    className={styles.primaryScanBtn} 
                    onClick={handleOpenExplorer}
                    type="button"
                  >
                    <Folder size={16} />
                    <span>Select Repository Folder</span>
                  </button>
                </div>

                {history.length > 0 && (
                  <div className={styles.recentReposSection}>
                    <h3 className={styles.recentReposTitle}>Recent Repositories</h3>
                    <div className={styles.recentReposGrid}>
                      {history.map((path, idx) => {
                        const name = path.split(/[\\/]/).filter(Boolean).pop() || path;
                        return (
                          <button
                            key={idx}
                            className={styles.recentRepoCard}
                            onClick={() => {
                              setRepoPath(path);
                              handleScan(path);
                            }}
                            type="button"
                          >
                            <FolderCheck size={20} className={styles.recentIcon} />
                            <div className={styles.recentInfo}>
                              <span className={styles.recentName}>{name}</span>
                              <span className={styles.recentPath}>{path}</span>
                            </div>
                            <ArrowRight size={14} className={styles.recentArrow} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {scanStatus === 'scanning' && (
              <div className={styles.emptyState}>
                <Loader2 size={48} className={styles.loadingSpinner} style={{ marginBottom: '20px' }} />
                <h2>Scanning Workspace</h2>
                <p>Analyzing repository metadata and specs folders...</p>
              </div>
            )}

            {(scanStatus === 'not_found' || scanStatus === 'invalid_speckit') && (
              <div className={styles.emptyState}>
                <AlertCircle size={64} className={styles.emptyIcon} style={{ color: 'var(--color-warning)' }} />
                <h2>
                  {scanStatus === 'not_found' ? 'Folder Directory Not Found' : 'Repository is not using Spec-kit'}
                </h2>
                <p style={{ marginBottom: '24px' }}>
                  {scanStatus === 'not_found' 
                    ? 'The absolute path you entered does not exist. Please check your path spelling and formatting.' 
                    : 'The directory is valid but it does not contain a Spec-kit project configuration. Spec-kit projects contain a `.specify/` folder or a `specs/` directory.'}
                </p>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', maxWidth: '400px', textAlign: 'left', fontSize: '0.85rem' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Troubleshooting:</strong>
                  <ul style={{ paddingLeft: '20px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)' }}>
                    <li>Ensure you provide the full absolute path (e.g. <code>C:\Users\Fer\Desktop\DEV\dentaflow</code>)</li>
                    <li>Verify the folder contains a <code>specs</code> subdirectory with markdown files.</li>
                  </ul>
                </div>
              </div>
            )}

            {scanStatus === 'success' && !selectedFeatureId && (
              <div className={styles.dashboardSummary}>
                <div className={styles.summaryTitleArea}>
                  <h1>Repository Overview</h1>
                  <p style={{ color: 'var(--text-secondary)' }}>{repoPath}</p>
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                      <Layout className={styles.statIcon} size={20} />
                    </div>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Features</span>
                      <span className={styles.statValue}>{totalFeatures}</span>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                      <CheckCircle2 className={styles.statIcon} size={20} />
                    </div>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Completed</span>
                      <span className={styles.statValue}>{completedFeatures}</span>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                      <Compass className={styles.statIcon} size={20} />
                    </div>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>Avg Progress</span>
                      <span className={styles.statValue}>{avgProgress}%</span>
                    </div>
                  </div>
                </div>

                <div className={styles.summarySection}>
                  <h2>
                    <ClipboardList size={18} />
                    <span>Spec-kit Features Checklist</span>
                  </h2>

                  <table className={styles.featuresTable}>
                    <thead>
                      <tr>
                        <th>Feature Title</th>
                        <th>Target Branch</th>
                        <th>Release Date</th>
                        <th>SpecFiles Available</th>
                        <th>Progress</th>
                      </tr>
                    </thead>
                    <tbody>
                      {features.map((feat) => (
                        <tr key={feat.id} onClick={() => setSelectedFeatureId(feat.id)}>
                          <td>
                            <div className={styles.featureTitleCol}>
                              <span>{feat.title}</span>
                              <span className={styles.featureIdSub}>{feat.id}</span>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                            {feat.branch ? (
                              <span className={styles.metaItem}>
                                <GitBranch size={12} style={{ marginRight: '4px' }} />
                                {feat.branch}
                              </span>
                            ) : '-'}
                          </td>
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {feat.date ? (
                              <span className={styles.metaItem}>
                                <Calendar size={12} style={{ marginRight: '4px' }} />
                                {feat.date}
                              </span>
                            ) : '-'}
                          </td>
                          <td>
                            <div className={styles.filesGrid}>
                              <span className={`${styles.fileBadge} ${feat.hasSpec ? styles.fileBadgeActive : ''}`}>SPEC</span>
                              <span className={`${styles.fileBadge} ${feat.hasPlan ? styles.fileBadgeActive : ''}`}>PLAN</span>
                              <span className={`${styles.fileBadge} ${feat.hasTasks ? styles.fileBadgeActive : ''}`}>TASKS</span>
                              <span className={`${styles.fileBadge} ${feat.hasWalkthrough ? styles.fileBadgeActive : ''}`}>WALK</span>
                              <span className={`${styles.fileBadge} ${feat.hasRequirements ? styles.fileBadgeActive : ''}`}>REQ</span>
                            </div>
                          </td>
                          <td>
                            <div className={styles.progressBarContainer}>
                              <div className={styles.progressBarOuter}>
                                <div 
                                  className={styles.progressBarInner} 
                                  style={{ width: `${feat.progress}%` }} 
                                />
                              </div>
                              <span className={styles.progressText}>{feat.progress}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {scanStatus === 'success' && selectedFeatureId && selectedFeature && (
              <div>
                {/* Detail Header card */}
                <div className={styles.detailHeader}>
                  <div className={styles.detailTitleArea}>
                    <div className={styles.detailId}>FEATURE WORKSPACE &bull; {selectedFeature.id}</div>
                    <h1>{selectedFeature.title}</h1>
                    <div className={styles.metaRow}>
                      {selectedFeature.branch && (
                        <div className={styles.metaItem}>
                          <GitBranch size={14} />
                          <span>Branch: <code>{selectedFeature.branch}</code></span>
                        </div>
                      )}
                      {selectedFeature.date && (
                        <div className={styles.metaItem}>
                          <Calendar size={14} />
                          <span>Target Date: <strong>{selectedFeature.date}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.detailProgressArea}>
                    <div className={styles.detailStatsText}>
                      Tasks: <strong>{selectedFeature.tasksCount.completed}</strong> / {selectedFeature.tasksCount.total} completed
                      {selectedFeature.tasksCount.inProgress > 0 && (
                        <span> ({selectedFeature.tasksCount.inProgress} in progress)</span>
                      )}
                    </div>
                    <div className={styles.progressBarContainer} style={{ width: '220px', height: '8px' }}>
                      <div className={styles.progressBarOuter} style={{ height: '8px' }}>
                        <div 
                          className={styles.progressBarInner} 
                          style={{ width: `${selectedFeature.progress}%` }} 
                        />
                      </div>
                      <span className={styles.progressText} style={{ fontSize: '0.9rem' }}>{selectedFeature.progress}%</span>
                    </div>
                  </div>
                </div>

                {/* Tabs selection bar */}
                <div className={styles.tabsContainer}>
                  <button 
                    className={`${styles.tabBtn} ${activeTab === 'spec' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('spec')}
                    disabled={!selectedFeature.hasSpec}
                    style={{ opacity: selectedFeature.hasSpec ? 1 : 0.4, cursor: selectedFeature.hasSpec ? 'pointer' : 'not-allowed' }}
                    type="button"
                  >
                    <FileText size={16} />
                    <span>Specification</span>
                  </button>
                  <button 
                    className={`${styles.tabBtn} ${activeTab === 'plan' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('plan')}
                    disabled={!selectedFeature.hasPlan}
                    style={{ opacity: selectedFeature.hasPlan ? 1 : 0.4, cursor: selectedFeature.hasPlan ? 'pointer' : 'not-allowed' }}
                    type="button"
                  >
                    <Compass size={16} />
                    <span>Implementation Plan</span>
                  </button>
                  <button 
                    className={`${styles.tabBtn} ${activeTab === 'tasks' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('tasks')}
                    disabled={!selectedFeature.hasTasks}
                    style={{ opacity: selectedFeature.hasTasks ? 1 : 0.4, cursor: selectedFeature.hasTasks ? 'pointer' : 'not-allowed' }}
                    type="button"
                  >
                    <CheckSquare size={16} />
                    <span>Tasks Checklist</span>
                  </button>
                  <button 
                    className={`${styles.tabBtn} ${activeTab === 'walkthrough' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('walkthrough')}
                    disabled={!selectedFeature.hasWalkthrough}
                    style={{ opacity: selectedFeature.hasWalkthrough ? 1 : 0.4, cursor: selectedFeature.hasWalkthrough ? 'pointer' : 'not-allowed' }}
                    type="button"
                  >
                    <FileCheck size={16} />
                    <span>Walkthrough</span>
                  </button>
                  <button 
                    className={`${styles.tabBtn} ${activeTab === 'requirements' ? styles.tabBtnActive : ''}`}
                    onClick={() => setActiveTab('requirements')}
                    disabled={!selectedFeature.hasRequirements}
                    style={{ opacity: selectedFeature.hasRequirements ? 1 : 0.4, cursor: selectedFeature.hasRequirements ? 'pointer' : 'not-allowed' }}
                    type="button"
                  >
                    <ClipboardList size={16} />
                    <span>Requirements</span>
                  </button>
                </div>

                {/* Tab content panel */}
                <div className={styles.tabPanel}>
                  {loadingDetail ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                      <Loader2 size={36} className={styles.loadingSpinner} style={{ marginBottom: '16px' }} />
                      <p style={{ color: 'var(--text-secondary)' }}>Loading feature details...</p>
                    </div>
                  ) : (
                    <>
                      {activeTab === 'spec' && featureDetail?.specHtml && (
                        <div className="markdown-body" dangerouslySetInnerHTML={{ __html: featureDetail.specHtml }} />
                      )}
                      
                      {activeTab === 'plan' && featureDetail?.planHtml && (
                        <div className="markdown-body" dangerouslySetInnerHTML={{ __html: featureDetail.planHtml }} />
                      )}

                      {activeTab === 'walkthrough' && featureDetail?.walkthroughHtml && (
                        <div className="markdown-body" dangerouslySetInnerHTML={{ __html: featureDetail.walkthroughHtml }} />
                      )}

                      {activeTab === 'requirements' && featureDetail?.requirementsHtml && (
                        <div className="markdown-body" dangerouslySetInnerHTML={{ __html: featureDetail.requirementsHtml }} />
                      )}

                      {activeTab === 'tasks' && featureDetail && (
                        <div className={styles.tasksDashboard}>
                          {featureDetail.phases.length > 0 ? (
                            <div className={styles.phasesGrid}>
                              {featureDetail.phases.map((phase, pIdx) => {
                                const totalPTasks = phase.tasks.length;
                                const completedPTasks = phase.tasks.filter(t => t.status === 'done').length;
                                return (
                                  <div key={pIdx} className={styles.phaseBlock}>
                                    <div className={styles.phaseHeader}>
                                      <span className={styles.phaseTitle}>{phase.title}</span>
                                      <span className={styles.phaseProgressBadge}>
                                        {completedPTasks} / {totalPTasks} Done
                                      </span>
                                    </div>
                                    <div className={styles.phaseTasksList}>
                                      {phase.tasks.map((task) => (
                                        <div key={task.id} className={styles.taskRow}>
                                          <div className={styles.taskIconWrapper}>
                                            {task.status === 'done' && (
                                              <CheckCircle2 size={16} className={styles.taskIconDone} />
                                            )}
                                            {task.status === 'in_progress' && (
                                              <Clock size={16} className={styles.taskIconProgress} />
                                            )}
                                            {task.status === 'todo' && (
                                              <HelpCircle size={16} className={styles.taskIconTodo} />
                                            )}
                                          </div>
                                          <div className={`
                                            ${styles.taskText} 
                                            ${task.status === 'done' ? styles.taskTextDone : ''}
                                            ${task.status === 'in_progress' ? styles.taskTextProgress : ''}
                                          `}>
                                            {task.text}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            featureDetail.tasksHtml && (
                              <div className="markdown-body" dangerouslySetInnerHTML={{ __html: featureDetail.tasksHtml }} />
                            )
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* File Explorer Modal */}
      {isOpenExplorer && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <div className={styles.modalHeader}>
              <h3>
                <Folder className={styles.explorerFolderIcon} size={20} />
                <span>Browse Local Filesystem</span>
              </h3>
              <button className={styles.closeBtn} onClick={() => setIsOpenExplorer(false)} type="button">
                X
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Drives Selector */}
              {explorerContent?.drives && explorerContent.drives.length > 1 && (
                <div className={styles.drivesRow}>
                  <span className={styles.driveLabel}>Drives:</span>
                  {explorerContent.drives.map((drive) => (
                    <button 
                      key={drive} 
                      className={styles.driveBtn}
                      onClick={() => handleNavigateExplorer(drive)}
                      type="button"
                    >
                      {drive}
                    </button>
                  ))}
                </div>
              )}

              {/* Breadcrumbs Navigation */}
              <div className={styles.breadcrumbs}>
                {explorerPath.split(/[\\/]/).filter(Boolean).map((part, index, arr) => {
                  const isWindows = explorerPath.includes('\\') || !!explorerPath.match(/^[A-Z]:/i);
                  const sep = isWindows ? '\\' : '/';
                  let pathSegment = '';
                  
                  if (isWindows) {
                    const drivePart = explorerPath.match(/^[A-Z]:/i)?.[0] || 'C:';
                    pathSegment = [drivePart, ...arr.slice(1, index + 1)].join(sep);
                  } else {
                    pathSegment = '/' + arr.slice(0, index + 1).join(sep);
                  }

                  if (index === 0 && isWindows) pathSegment += sep;

                  return (
                    <span key={index} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {index > 0 && <span className={styles.breadcrumbSeparator}><ChevronRight size={12} /></span>}
                      <button 
                        className={styles.breadcrumbItem}
                        onClick={() => handleNavigateExplorer(pathSegment)}
                        type="button"
                      >
                        {part}
                      </button>
                    </span>
                  );
                })}
              </div>

              {/* Folder list */}
              <div className={styles.explorerList}>
                {loadingExplorer ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                    <Loader2 className={styles.loadingSpinner} size={28} style={{ marginBottom: '12px' }} />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Reading folder...</span>
                  </div>
                ) : (
                  <>
                    {/* Up Directory option */}
                    {explorerContent?.parentPath && (
                      <button 
                        className={styles.explorerRow}
                        onClick={() => handleNavigateExplorer(explorerContent.parentPath!)}
                        type="button"
                      >
                        <div className={styles.explorerFolderInfo}>
                          <Folder className={styles.explorerFolderIcon} size={16} />
                          <span>.. (Up One Level)</span>
                        </div>
                      </button>
                    )}

                    {/* Child Folders */}
                    {explorerContent?.folders && explorerContent.folders.length > 0 ? (
                      explorerContent.folders.map((folder) => (
                        <button 
                          key={folder.path}
                          className={styles.explorerRow}
                          onClick={() => handleNavigateExplorer(folder.path)}
                          type="button"
                        >
                          <div className={styles.explorerFolderInfo}>
                            <Folder className={styles.explorerFolderIcon} size={16} />
                            <span>{folder.name}</span>
                          </div>
                          {folder.isSpeckit && (
                            <span className={styles.explorerBadge}>SpecKit Project</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No folders found in this directory
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.currentSelectionText}>
                Path: <code>{explorerPath}</code>
              </div>
              <div className={styles.footerActions}>
                <button className={styles.cancelBtn} onClick={() => setIsOpenExplorer(false)} type="button">
                  Cancel
                </button>
                <button className={styles.scanButton} onClick={handleSelectExplorerFolder} type="button">
                  Select Folder
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
