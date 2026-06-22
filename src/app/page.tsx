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
  Moon,
  Globe,
  Copy,
  Check,
  Terminal
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
import { translations, Language, TranslationKeys } from './translations';
import {
  ClientFolderSource,
  DirectoryHandleSource,
  FilesListSource,
  clientCheckRepository,
  clientGetFeatures,
  clientGetFeatureDetails
} from './clientParser';

export default function Home() {
  const [repoPath, setRepoPath] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'success' | 'not_found' | 'invalid_speckit'>('idle');
  const [speckitVersion, setSpeckitVersion] = useState<string | null>(null);
  const [features, setFeatures] = useState<FeatureSummary[]>([]);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>('en');

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => {
      setCopiedText(null);
    }, 2000);
  };

  // Translation helper
  const t = (key: TranslationKeys): string => {
    return translations[lang]?.[key] || translations.en[key] || '';
  };

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('speckit_lang', newLang);
  };
  const [contentLang, setContentLang] = useState<string>('original');
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientSource, setClientSource] = useState<ClientFolderSource | null>(null);

  // Scan repository path
  const handleScan = async (pathToCheck: string | ClientFolderSource) => {
    const isClient = typeof pathToCheck !== 'string';
    const targetPath = isClient ? (pathToCheck as ClientFolderSource).name : (pathToCheck as string).trim();
    if (!targetPath) return;

    setScanStatus('scanning');
    setSelectedFeatureId(null);
    setFeatureDetail(null);
    setFeatures([]);

    let status;
    if (isClient) {
      status = await clientCheckRepository(pathToCheck as ClientFolderSource);
    } else {
      status = await checkRepository(targetPath);
    }

    if (!status.exists) {
      setScanStatus('not_found');
      setShowScanner(true);
      return;
    }

    if (!status.isSpeckit) {
      setScanStatus('invalid_speckit');
      setShowScanner(true);
      setShowInstallModal(true);
      return;
    }

    setScanStatus('success');
    setSpeckitVersion(status.speckitVersion || 'Unknown');
    setShowScanner(false); // Collapse input on success

    if (isClient) {
      setClientSource(pathToCheck as ClientFolderSource);
      setRepoPath((pathToCheck as ClientFolderSource).name);
      localStorage.setItem('speckit_last_repo', (pathToCheck as ClientFolderSource).name);
    } else {
      setClientSource(null);
      setRepoPath(targetPath);
      // Save to localStorage
      localStorage.setItem('speckit_last_repo', targetPath);
      setHistory(prev => {
        const updated = [targetPath, ...prev.filter(p => p !== targetPath)].slice(0, 8);
        localStorage.setItem('speckit_repo_history', JSON.stringify(updated));
        return updated;
      });
    }

    // Fetch features
    const feats = isClient 
      ? await clientGetFeatures(pathToCheck as ClientFolderSource)
      : await getFeatures(targetPath);
    setFeatures(feats);
  };

  // Load theme and history from localStorage on mount
  useEffect(() => {
    // Theme setup
    const savedTheme = localStorage.getItem('speckit_theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme); // eslint-disable-line react-hooks/set-state-in-effect
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      setTheme('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }

    // Language setup
    const savedLang = localStorage.getItem('speckit_lang') as Language | null;
    if (savedLang && (savedLang === 'en' || savedLang === 'es')) {
      setLang(savedLang);
    } else {
      const browserLang = navigator.language.split('-')[0];
      const defaultLang: Language = (browserLang === 'es') ? 'es' : 'en';
      setLang(defaultLang);
      localStorage.setItem('speckit_lang', defaultLang);
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
    const isServerScanningDisabled = typeof window !== 'undefined' && 
      window.location.hostname !== 'localhost' && 
      window.location.hostname !== '127.0.0.1';

    if (isServerScanningDisabled || (typeof window !== 'undefined' && 'showDirectoryPicker' in window)) {
      if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
        try {
          const handle = await (window as any).showDirectoryPicker();
          if (handle) {
            const source = new DirectoryHandleSource(handle);
            await handleScan(source);
          }
        } catch (err: any) {
          console.warn('Directory picker closed or failed:', err);
        }
      } else {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }
    } else {
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
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const source = new FilesListSource(Array.from(files));
      await handleScan(source);
    }
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

  // Load feature details when selected
  useEffect(() => {
    if (!selectedFeatureId || scanStatus !== 'success') {
      setFeatureDetail(null); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }

    const loadDetails = async () => {
      setLoadingDetail(true);
      const detail = clientSource
        ? await clientGetFeatureDetails(clientSource, selectedFeatureId, contentLang)
        : await getFeatureDetails(repoPath, selectedFeatureId, contentLang);
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
  }, [selectedFeatureId, repoPath, scanStatus, features, contentLang, clientSource]);

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
          <span className={styles.logoText}>{t('logoText')}</span>
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
              {t('switchRepo')}
            </button>
          </div>
        ) : (
          <div className={styles.scanSection}>
            <div className={styles.inputGroup} ref={historyRef}>
              <input 
                type="text" 
                placeholder={t('inputPlaceholder')} 
                value={repoPath}
                onChange={(e) => setRepoPath(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan(repoPath)}
              />
              <button 
                className={styles.folderPickerBtn} 
                onClick={handleOpenExplorer}
                title={t('folderPickerTitle')}
                type="button"
              >
                <Folder size={16} />
              </button>
              {history.length > 0 && (
                <button 
                  className={styles.historyBtn} 
                  onClick={() => setShowHistory(!showHistory)}
                  title={t('recentReposTitle')}
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
                ) : t('scanBtnScan')}
              </button>
            </div>
            {scanStatus === 'success' && (
              <button 
                className={styles.cancelScanBtn}
                onClick={() => setShowScanner(false)}
                type="button"
              >
                {t('modalCancel')}
              </button>
            )}
          </div>
        )}

        <div className={styles.headerActions}>
          {/* Sliding Language Switcher */}
          <div className={styles.langSwitcher}>
            <div className={`${styles.langSlider} ${lang === 'en' ? styles.langSliderEn : styles.langSliderEs}`} />
            <button 
              className={`${styles.langBtn} ${lang === 'en' ? styles.langBtnActive : ''}`}
              onClick={() => handleLanguageChange('en')}
              type="button"
            >
              EN
            </button>
            <button 
              className={`${styles.langBtn} ${lang === 'es' ? styles.langBtnActive : ''}`}
              onClick={() => handleLanguageChange('es')}
              type="button"
            >
              ES
            </button>
          </div>

          <button 
            className={styles.themeToggleBtn} 
            onClick={toggleTheme}
            title={theme === 'light' ? t('themeToggleDark') : t('themeToggleLight')}
            type="button"
          >
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          <div className={styles.badgeContainer}>
            {scanStatus === 'idle' && (
              <div className={styles.badge}>
                <Folder size={12} />
                <span>{t('badgeReady')}</span>
              </div>
            )}
            {scanStatus === 'scanning' && (
              <div className={`${styles.badge} ${styles.badgeInfo}`}>
                <Loader2 size={12} className={styles.loadingSpinner} />
                <span>{t('badgeChecking')}</span>
              </div>
            )}
            {scanStatus === 'success' && (
              <div className={`${styles.badge} ${styles.badgeSuccess}`}>
                <FolderCheck size={12} />
                <span>{t('badgeDetected')}</span>
              </div>
            )}
            {scanStatus === 'invalid_speckit' && (
              <div className={`${styles.badge} ${styles.badgeWarning}`}>
                <AlertCircle size={12} />
                <span>{t('badgeNoSpecKit')}</span>
              </div>
            )}
            {scanStatus === 'not_found' && (
              <div className={`${styles.badge} ${styles.badgeDanger}`}>
                <AlertCircle size={12} />
                <span>{t('badgeNotFound')}</span>
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
                <span>{t('sidebarOverview')}</span>
                <span className={styles.homeProgressBadge}>{avgProgress}%</span>
              </button>
            </div>

            <div className={styles.sidebarTitle}>{t('sidebarFeatures')}</div>
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
                <h2>{t('emptyStateTitle')}</h2>
                <p>{t('emptyStateSubtitle')}</p>
                
                <div className={styles.welcomeActions}>
                  <button 
                    className={styles.primaryScanBtn} 
                    onClick={handleOpenExplorer}
                    type="button"
                  >
                    <Folder size={16} />
                    <span>{t('emptyStateSelectFolder')}</span>
                  </button>
                </div>

                {history.length > 0 && (
                  <div className={styles.recentReposSection}>
                    <h3 className={styles.recentReposTitle}>{t('emptyStateRecentTitle')}</h3>
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
                <h2>{t('scanningTitle')}</h2>
                <p>{t('scanningSubtitle')}</p>
              </div>
            )}

            {(scanStatus === 'not_found' || scanStatus === 'invalid_speckit') && (
              <div className={styles.emptyState}>
                <AlertCircle size={64} className={styles.emptyIcon} style={{ color: 'var(--color-warning)' }} />
                <h2>
                  {scanStatus === 'not_found' ? t('errorDirNotFound') : t('errorNotSpeckit')}
                </h2>
                <p style={{ marginBottom: '24px' }}>
                  {scanStatus === 'not_found' 
                    ? t('errorDirNotFoundDesc') 
                    : t('errorNotSpeckitDesc')}
                </p>
                <div style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', maxWidth: '400px', textAlign: 'left', fontSize: '0.85rem', marginBottom: '24px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{t('troubleshootingTitle')}</strong>
                  <ul style={{ paddingLeft: '20px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)' }}>
                    <li>{t('troubleshootingStep1')}</li>
                    <li>{t('troubleshootingStep2')}</li>
                  </ul>
                </div>
                {scanStatus === 'invalid_speckit' && (
                  <button 
                    className={styles.viewInstallBtn}
                    onClick={() => setShowInstallModal(true)}
                    type="button"
                  >
                    {t('installModalTitle')}
                  </button>
                )}
              </div>
            )}

            {scanStatus === 'success' && !selectedFeatureId && (
              <div className={styles.dashboardSummary}>
                <div className={styles.summaryTitleArea}>
                  <h1>{t('overviewTitle')}</h1>
                  <p style={{ color: 'var(--text-secondary)' }}>{repoPath}</p>
                </div>

                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                      <Layout className={styles.statIcon} size={20} />
                    </div>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>{t('statsFeatures')}</span>
                      <span className={styles.statValue}>{totalFeatures}</span>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                      <CheckCircle2 className={styles.statIcon} size={20} />
                    </div>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>{t('statsCompleted')}</span>
                      <span className={styles.statValue}>{completedFeatures}</span>
                    </div>
                  </div>

                  <div className={styles.statCard}>
                    <div className={styles.statIconWrapper}>
                      <Compass className={styles.statIcon} size={20} />
                    </div>
                    <div className={styles.statInfo}>
                      <span className={styles.statLabel}>{t('statsAvgProgress')}</span>
                      <span className={styles.statValue}>{avgProgress}%</span>
                    </div>
                  </div>
                </div>

                <div className={styles.summarySection}>
                  <h2>
                    <ClipboardList size={18} />
                    <span>{t('checklistTitle')}</span>
                  </h2>

                  <table className={styles.featuresTable}>
                    <thead>
                      <tr>
                        <th>{t('tableColTitle')}</th>
                        <th>{t('tableColBranch')}</th>
                        <th>{t('tableColDate')}</th>
                        <th>{t('tableColFiles')}</th>
                        <th>{t('tableColProgress')}</th>
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
                    <div className={styles.detailId}>{t('featureWorkspace')} &bull; {selectedFeature.id}</div>
                    <h1>{selectedFeature.title}</h1>
                    <div className={styles.metaRow}>
                      {selectedFeature.branch && (
                        <div className={styles.metaItem}>
                          <GitBranch size={14} />
                          <span>{t('branchLabel')}: <code>{selectedFeature.branch}</code></span>
                        </div>
                      )}
                      {selectedFeature.date && (
                        <div className={styles.metaItem}>
                          <Calendar size={14} />
                          <span>{t('dateLabel')}: <strong>{selectedFeature.date}</strong></span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.detailProgressArea}>
                    <div className={styles.detailStatsText}>
                      {t('tasksCompletedLabel')
                        .replace('{completed}', selectedFeature.tasksCount.completed.toString())
                        .replace('{total}', selectedFeature.tasksCount.total.toString())}
                      {selectedFeature.tasksCount.inProgress > 0 && (
                        <span> {t('tasksInProgressLabel').replace('{inProgress}', selectedFeature.tasksCount.inProgress.toString())}</span>
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

                {/* Tabs selection bar and Translator */}
                <div className={styles.tabsHeaderRow}>
                  <div className={styles.tabsContainer}>
                    <button 
                      className={`${styles.tabBtn} ${activeTab === 'spec' ? styles.tabBtnActive : ''}`}
                      onClick={() => setActiveTab('spec')}
                      disabled={!selectedFeature.hasSpec}
                      style={{ opacity: selectedFeature.hasSpec ? 1 : 0.4, cursor: selectedFeature.hasSpec ? 'pointer' : 'not-allowed' }}
                      type="button"
                    >
                      <FileText size={16} />
                      <span>{t('tabSpec')}</span>
                    </button>
                    <button 
                      className={`${styles.tabBtn} ${activeTab === 'plan' ? styles.tabBtnActive : ''}`}
                      onClick={() => setActiveTab('plan')}
                      disabled={!selectedFeature.hasPlan}
                      style={{ opacity: selectedFeature.hasPlan ? 1 : 0.4, cursor: selectedFeature.hasPlan ? 'pointer' : 'not-allowed' }}
                      type="button"
                    >
                      <Compass size={16} />
                      <span>{t('tabPlan')}</span>
                    </button>
                    <button 
                      className={`${styles.tabBtn} ${activeTab === 'tasks' ? styles.tabBtnActive : ''}`}
                      onClick={() => setActiveTab('tasks')}
                      disabled={!selectedFeature.hasTasks}
                      style={{ opacity: selectedFeature.hasTasks ? 1 : 0.4, cursor: selectedFeature.hasTasks ? 'pointer' : 'not-allowed' }}
                      type="button"
                    >
                      <CheckSquare size={16} />
                      <span>{t('tabTasks')}</span>
                    </button>
                    <button 
                      className={`${styles.tabBtn} ${activeTab === 'walkthrough' ? styles.tabBtnActive : ''}`}
                      onClick={() => setActiveTab('walkthrough')}
                      disabled={!selectedFeature.hasWalkthrough}
                      style={{ opacity: selectedFeature.hasWalkthrough ? 1 : 0.4, cursor: selectedFeature.hasWalkthrough ? 'pointer' : 'not-allowed' }}
                      type="button"
                    >
                      <FileCheck size={16} />
                      <span>{t('tabWalk')}</span>
                    </button>
                    <button 
                      className={`${styles.tabBtn} ${activeTab === 'requirements' ? styles.tabBtnActive : ''}`}
                      onClick={() => setActiveTab('requirements')}
                      disabled={!selectedFeature.hasRequirements}
                      style={{ opacity: selectedFeature.hasRequirements ? 1 : 0.4, cursor: selectedFeature.hasRequirements ? 'pointer' : 'not-allowed' }}
                      type="button"
                    >
                      <ClipboardList size={16} />
                      <span>{t('tabReq')}</span>
                    </button>
                  </div>
                  
                  <div className={styles.translatorWrapper}>
                    <label htmlFor="md-translator-select" className={styles.translatorLabel}>
                      <Globe size={14} />
                      <span>{t('translatorLabel')}</span>
                    </label>
                    <select 
                      id="md-translator-select"
                      className={styles.translatorSelect}
                      value={contentLang}
                      onChange={(e) => setContentLang(e.target.value)}
                    >
                      <option value="original">{t('translatorOriginal')}</option>
                      <option value="en">English (EN)</option>
                      <option value="es">Español (ES)</option>
                      <option value="pt">Português (PT)</option>
                      <option value="fr">Français (FR)</option>
                      <option value="de">Deutsch (DE)</option>
                      <option value="it">Italiano (IT)</option>
                      <option value="ja">日本語 (JA)</option>
                      <option value="zh">中文 (ZH)</option>
                    </select>
                  </div>
                </div>

                {/* Tab content panel */}
                <div className={styles.tabPanel}>
                  {loadingDetail ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                      <Loader2 size={36} className={styles.loadingSpinner} style={{ marginBottom: '16px' }} />
                      <p style={{ color: 'var(--text-secondary)' }}>{t('loadingFeatureDetails')}</p>
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
                                      <span className={styles.phaseTitle}>
                                        {phase.title === 'General Setup / Pre-phase' ? t('phasePrePhase') : phase.title}
                                      </span>
                                      <span className={styles.phaseProgressBadge}>
                                        {t('phaseDone')
                                          .replace('{completed}', completedPTasks.toString())
                                          .replace('{total}', totalPTasks.toString())}
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
                <span>{t('modalBrowseTitle')}</span>
              </h3>
              <button className={styles.closeBtn} onClick={() => setIsOpenExplorer(false)} type="button">
                X
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Drives Selector */}
              {explorerContent?.drives && explorerContent.drives.length > 1 && (
                <div className={styles.drivesRow}>
                  <span className={styles.driveLabel}>{t('modalDrives')}</span>
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
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('modalReadingFolder')}</span>
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
                          <span>{t('modalUpOneLevel')}</span>
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
                            <span className={styles.explorerBadge}>{t('modalProjectBadge')}</span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {t('modalNoFolders')}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <div className={styles.currentSelectionText}>
                {t('modalPathLabel')} <code>{explorerPath}</code>
              </div>
              <div className={styles.footerActions}>
                <button className={styles.cancelBtn} onClick={() => setIsOpenExplorer(false)} type="button">
                  {t('modalCancel')}
                </button>
                <button className={styles.scanButton} onClick={handleSelectExplorerFolder} type="button">
                  {t('modalSelectFolder')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* SpecKit Installation Modal */}
      {showInstallModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContainer} ${styles.installModal}`}>
            <div className={styles.modalHeader}>
              <h3>
                <Terminal className={styles.explorerFolderIcon} size={20} />
                <span>{t('installModalTitle')}</span>
              </h3>
              <button className={styles.closeBtn} onClick={() => setShowInstallModal(false)} type="button">
                X
              </button>
            </div>

            <div className={styles.modalBody} style={{ overflowY: 'auto', maxHeight: '60vh' }}>
              <p className={styles.installModalDesc}>
                {t('installModalDesc')}
              </p>

              <div className={styles.installOptionSection}>
                <h4>1. {t('installModalStep1Title')}</h4>
                <p className={styles.installStepText}>
                  {t('installModalStep1Req')}{' '}
                  <a href="https://github.com/astral-sh/uv" target="_blank" rel="noopener noreferrer" className={styles.installLink}>
                    {t('installModalStep1ReqLink')}
                  </a>.
                  {' '}{t('installModalStep1Replace')}{' '}
                  <a href="https://github.com/github/spec-kit/releases" target="_blank" rel="noopener noreferrer" className={styles.installLink}>
                    Releases
                  </a>:
                </p>
                <div className={styles.codeBlockWrapper}>
                  <pre>
                    <code>uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z</code>
                  </pre>
                  <button 
                    className={styles.copyCodeBtn}
                    onClick={() => handleCopy('uv tool install specify-cli --from git+https://github.com/github/spec-kit.git@vX.Y.Z', 'cli-install')}
                    type="button"
                  >
                    {copiedText === 'cli-install' ? (
                      <>
                        <Check size={12} />
                        <span>{t('installModalCopied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>{t('installModalCopy')}</span>
                      </>
                    )}
                  </button>
                </div>
                <p className={styles.installStepText}>
                  {t('installModalStep1GuidePrefix')}{' '}
                  <a href="https://github.com/github/spec-kit" target="_blank" rel="noopener noreferrer" className={styles.installLink}>
                    {t('installModalStep1GuideLink')}
                  </a>{' '}
                  {t('installModalStep1GuideSuffix')}
                </p>
              </div>

              <div className={styles.divider} />

              <div className={styles.installOptionSection}>
                <h4>2. {t('installModalStep2Title')}</h4>
                <div className={styles.codeBlockWrapper}>
                  <pre>
                    <code>specify init my-project --integration copilot
cd my-project</code>
                  </pre>
                  <button 
                    className={styles.copyCodeBtn}
                    onClick={() => handleCopy("specify init my-project --integration copilot\ncd my-project", 'cli-init')}
                    type="button"
                  >
                    {copiedText === 'cli-init' ? (
                      <>
                        <Check size={12} />
                        <span>{t('installModalCopied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>{t('installModalCopy')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <div style={{ flexGrow: 1 }} />
              <button className={styles.scanButton} onClick={() => setShowInstallModal(false)} type="button">
                {t('installModalClose')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden input for folder fallback selection */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        {...{ webkitdirectory: '', directory: '' }}
        onChange={handleFileInputChange}
      />
    </div>
  );
}
