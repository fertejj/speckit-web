'use server'

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter'; // eslint-disable-line @typescript-eslint/no-unused-vars
import { marked } from 'marked';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execPromise = promisify(exec);

// Configure marked to handle basic options if needed
marked.setOptions({
  gfm: true,
  breaks: true,
});

export interface RepoStatus {
  exists: boolean;
  isSpeckit: boolean;
  error?: string;
  speckitVersion?: string;
}

export interface TaskInfo {
  id: string;
  text: string;
  status: 'todo' | 'in_progress' | 'done';
  raw: string;
}

export interface TaskPhase {
  title: string;
  tasks: TaskInfo[];
}

export interface FeatureSummary {
  id: string;
  title: string;
  branch: string;
  date: string;
  tasksCount: {
    total: number;
    completed: number;
    inProgress: number;
  };
  progress: number;
  hasSpec: boolean;
  hasPlan: boolean;
  hasTasks: boolean;
  hasWalkthrough: boolean;
  hasRequirements: boolean;
}

export interface FeatureDetails {
  id: string;
  specHtml: string | null;
  planHtml: string | null;
  tasksHtml: string | null;
  walkthroughHtml: string | null;
  requirementsHtml: string | null;
  phases: TaskPhase[];
  tasksCount: {
    total: number;
    completed: number;
    inProgress: number;
  };
}

// Check if a path is a valid speckit repository
export async function checkRepository(repoPath: string): Promise<RepoStatus> {
  if (!repoPath) {
    return { exists: false, isSpeckit: false, error: 'Path is empty' };
  }

  const normalizedPath = path.normalize(repoPath.trim());

  try {
    const stats = await fs.stat(normalizedPath);
    if (!stats.isDirectory()) {
      return { exists: false, isSpeckit: false, error: 'Path is not a directory' };
    }

    const specifyPath = path.join(normalizedPath, '.specify');
    const specsPath = path.join(normalizedPath, 'specs');

    let hasSpecify = false;
    let hasSpecs = false;

    try {
      const specifyStats = await fs.stat(specifyPath);
      hasSpecify = specifyStats.isDirectory();
    } catch {
      hasSpecify = false;
    }

    try {
      const specsStats = await fs.stat(specsPath);
      hasSpecs = specsStats.isDirectory();
    } catch {
      hasSpecs = false;
    }

    // It works with speckit if it contains at least the specs directory or .specify directory
    const isSpeckit = hasSpecify || hasSpecs;

    let speckitVersion = 'Unknown';
    if (hasSpecify) {
      try {
        const initOptionsContent = await fs.readFile(path.join(specifyPath, 'init-options.json'), 'utf8');
        const initOptions = JSON.parse(initOptionsContent);
        if (initOptions.speckit_version) {
          speckitVersion = initOptions.speckit_version;
        }
      } catch {
        // Try reading integration.json
        try {
          const integrationContent = await fs.readFile(path.join(specifyPath, 'integration.json'), 'utf8');
          const integration = JSON.parse(integrationContent);
          if (integration.version) {
            speckitVersion = integration.version;
          }
        } catch {}
      }
    }

    return {
      exists: true,
      isSpeckit,
      speckitVersion: isSpeckit ? speckitVersion : undefined,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      exists: false,
      isSpeckit: false,
      error: errorMsg || 'Error checking directory stats',
    };
  }
}

// Get the list of features inside specs folder
export async function getFeatures(repoPath: string): Promise<FeatureSummary[]> {
  const normalizedPath = path.normalize(repoPath.trim());
  const specsPath = path.join(normalizedPath, 'specs');

  try {
    const dirs = await fs.readdir(specsPath);
    const features: FeatureSummary[] = [];

    for (const dirName of dirs) {
      const featureDir = path.join(specsPath, dirName);
      const stat = await fs.stat(featureDir);

      if (!stat.isDirectory()) continue;

      // Check which files exist
      const specPath = path.join(featureDir, 'spec.md');
      const planPath = path.join(featureDir, 'plan.md');
      const tasksPath = path.join(featureDir, 'tasks.md');
      const walkthroughPath = path.join(featureDir, 'walkthrough.md');
      const reqPath = path.join(featureDir, 'checklists', 'requirements.md');

      const [hasSpec, hasPlan, hasTasks, hasWalkthrough, hasRequirements] = await Promise.all([
        fs.access(specPath).then(() => true).catch(() => false),
        fs.access(planPath).then(() => true).catch(() => false),
        fs.access(tasksPath).then(() => true).catch(() => false),
        fs.access(walkthroughPath).then(() => true).catch(() => false),
        fs.access(reqPath).then(() => true).catch(() => false),
      ]);

      // Parse plan metadata if plan exists
      let title = dirName.replace(/^\d+-/, '').replace(/-/g, ' ');
      // Capitalize first letter
      title = title.charAt(0).toUpperCase() + title.slice(1);

      let branch = '';
      let date = '';

      if (hasPlan) {
        try {
          const planContent = await fs.readFile(planPath, 'utf8');
          // Parse title (H1)
          const h1Match = planContent.match(/^#\s+(.+)$/m);
          if (h1Match) {
            title = h1Match[1].trim();
          }

          // Parse metadata using regexes since they may not always be in YAML frontmatter
          const branchMatch = planContent.match(/\*\*Branch\*\*:\s*`([^`]+)`/i);
          if (branchMatch) branch = branchMatch[1];

          const dateMatch = planContent.match(/\*\*Date\*\*:\s*([^\s|]+)/i);
          if (dateMatch) date = dateMatch[1];
        } catch {}
      }

      // Parse tasks count from tasks.md
      let total = 0;
      let completed = 0;
      let inProgress = 0;

      if (hasTasks) {
        try {
          const tasksContent = await fs.readFile(tasksPath, 'utf8');
          const lines = tasksContent.split('\n');

          for (const line of lines) {
            // Match checkbox markdown: - [ ] or - [/] or - [x]
            const match = line.match(/^\s*[-*+]\s+\[([\s/xX])\]/);
            if (match) {
              total++;
              const statusChar = match[1].toLowerCase();
              if (statusChar === 'x') {
                completed++;
              } else if (statusChar === '/') {
                inProgress++;
              }
            }
          }
        } catch {}
      }

      const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

      features.push({
        id: dirName,
        title,
        branch,
        date,
        tasksCount: { total, completed, inProgress },
        progress,
        hasSpec,
        hasPlan,
        hasTasks,
        hasWalkthrough,
        hasRequirements,
      });
    }

    // Sort features by their folder name prefix (e.g. 001, 002)
    return features.sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

// Global translation cache
const translationCache = new Map<string, string>();

// Translate plain text using Google's free translation web API
async function translateText(text: string, targetLang: string): Promise<string> {
  if (!text || text.trim() === '') return text;

  const cacheKey = `${targetLang}:${text}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Google Translate API returned status ${response.status}`);
    }

    const data = await response.json();
    if (data && data[0]) {
      const translated = data[0].map((item: any) => item[0] || '').join('');
      translationCache.set(cacheKey, translated);
      return translated;
    }
  } catch (err) {
    console.error(`Error translating text to ${targetLang}:`, err);
  }

  return text; // Fallback
}

// Translate markdown content while preserving structure (code blocks, checkboxes, alerts)
export async function translateMarkdown(markdown: string, targetLang: string): Promise<string> {
  if (!markdown || !targetLang || targetLang === 'original') return markdown;

  // Split into code blocks and normal text blocks
  const lines = markdown.split('\n');
  const blocks: { type: 'code' | 'text'; lines: string[] }[] = [];
  let currentBlock: { type: 'code' | 'text'; lines: string[] } | null = null;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // Ending code block
        currentBlock?.lines.push(line);
        inCodeBlock = false;
        currentBlock = null;
      } else {
        // Starting code block
        currentBlock = { type: 'code', lines: [line] };
        blocks.push(currentBlock);
        inCodeBlock = true;
      }
    } else {
      if (inCodeBlock) {
        currentBlock?.lines.push(line);
      } else {
        if (!currentBlock || currentBlock.type !== 'text') {
          currentBlock = { type: 'text', lines: [line] };
          blocks.push(currentBlock);
        } else {
          currentBlock.lines.push(line);
        }
      }
    }
  }

  // Process and translate text blocks
  const translatedBlocks = await Promise.all(
    blocks.map(async (block) => {
      if (block.type === 'code') {
        return block.lines.join('\n');
      }

      const textContent = block.lines.join('\n');
      if (textContent.trim() === '') return textContent;

      // Split text content into paragraphs to avoid huge payloads, keeping chunks <= 2500 chars
      const paragraphs = textContent.split('\n\n');
      const chunks: string[] = [];
      let currentChunk = '';

      for (const p of paragraphs) {
        if ((currentChunk + '\n\n' + p).length > 2500) {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = p;
        } else {
          if (currentChunk) {
            currentChunk += '\n\n' + p;
          } else {
            currentChunk = p;
          }
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      // Translate each chunk
      const translatedChunks = await Promise.all(
        chunks.map(async (chunk) => {
          // Pre-process: protect alert banners
          let processed = chunk.replace(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/gim, 'X_ALERT_$1_X');

          // Pre-process: protect checkboxes
          processed = processed.replace(/^(\s*[-*+]\s+)\[\s*\](\s+)/gm, '$1X_CHECK_TODO_X$2');
          processed = processed.replace(/^(\s*[-*+]\s+)\[\s*[xX]\s*\](\s+)/gm, '$1X_CHECK_DONE_X$2');
          processed = processed.replace(/^(\s*[-*+]\s+)\[\s*\/\s*\](\s+)/gm, '$1X_CHECK_PROGRESS_X$2');

          // Call translator
          let translated = await translateText(processed, targetLang);

          // Post-process: restore alert banners
          translated = translated.replace(/X_ALERT_(NOTE|TIP|IMPORTANT|WARNING|CAUTION)_X/gi, (_, type) => `> [!${type.toUpperCase()}]`);

          // Post-process: restore checkboxes
          translated = translated.replace(/X_CHECK_TODO_X/gi, '[ ]');
          translated = translated.replace(/X_CHECK_DONE_X/gi, '[x]');
          translated = translated.replace(/X_CHECK_PROGRESS_X/gi, '[/]');

          return translated;
        })
      );

      return translatedChunks.join('\n\n');
    })
  );

  return translatedBlocks.join('\n');
}

// Get the full detail of a specific feature, with optional target translation language
export async function getFeatureDetails(repoPath: string, featureId: string, targetLang?: string): Promise<FeatureDetails | null> {
  const normalizedPath = path.normalize(repoPath.trim());
  const featureDir = path.join(normalizedPath, 'specs', featureId);

  try {
    const specPath = path.join(featureDir, 'spec.md');
    const planPath = path.join(featureDir, 'plan.md');
    const tasksPath = path.join(featureDir, 'tasks.md');
    const walkthroughPath = path.join(featureDir, 'walkthrough.md');
    const reqPath = path.join(featureDir, 'checklists', 'requirements.md');

    // Helper to read file content
    const readFileIfExists = async (filePath: string): Promise<string | null> => {
      try {
        return await fs.readFile(filePath, 'utf8');
      } catch {
        return null;
      }
    };

    // Read all raw markdown contents
    let [specMd, planMd, tasksMd, walkthroughMd, requirementsMd] = await Promise.all([
      readFileIfExists(specPath),
      readFileIfExists(planPath),
      readFileIfExists(tasksPath),
      readFileIfExists(walkthroughPath),
      readFileIfExists(reqPath),
    ]);

    // Translate markdown content if target language is requested
    if (targetLang && targetLang !== 'original') {
      [specMd, planMd, tasksMd, walkthroughMd, requirementsMd] = await Promise.all([
        specMd ? translateMarkdown(specMd, targetLang) : null,
        planMd ? translateMarkdown(planMd, targetLang) : null,
        tasksMd ? translateMarkdown(tasksMd, targetLang) : null,
        walkthroughMd ? translateMarkdown(walkthroughMd, targetLang) : null,
        requirementsMd ? translateMarkdown(requirementsMd, targetLang) : null,
      ]);
    }

    // Helper to parse markdown string into HTML
    const parseMdToHtml = (content: string | null): string | null => {
      if (!content) return null;
      // Handle github-style alerts: > [!NOTE], > [!IMPORTANT], etc.
      const cleanedContent = content.replace(
        /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\n((?:^>.*\n?)*)/gim,
        (match, type, text) => {
          const innerText = text.replace(/^>\s?/gm, '').trim();
          return `<div class="alert alert-${type.toLowerCase()}">
  <div class="alert-title">${type}</div>
  <div class="alert-content">${innerText}</div>
</div>`;
        }
      );
      return marked.parse(cleanedContent) as string;
    };

    const specHtml = parseMdToHtml(specMd);
    const planHtml = parseMdToHtml(planMd);
    const tasksHtml = parseMdToHtml(tasksMd);
    const walkthroughHtml = parseMdToHtml(walkthroughMd);
    const requirementsHtml = parseMdToHtml(requirementsMd);

    // Parse tasks.md into structured sections (phases)
    const phases: TaskPhase[] = [];
    let currentPhase: TaskPhase | null = null;
    let total = 0;
    let completed = 0;
    let inProgress = 0;

    if (tasksMd) {
      const lines = tasksMd.split('\n');
      let taskCounter = 0;

      for (const line of lines) {
        // Look for headers that designate phases
        const headerMatch = line.match(/^##\s+(Phase\s+\d+|Fase\s+\d+|.+)$/i);
        if (headerMatch) {
          if (currentPhase) {
            phases.push(currentPhase);
          }
          currentPhase = {
            title: headerMatch[1].trim(),
            tasks: [],
          };
          continue;
        }

        // Look for checkbox items
        const checkboxMatch = line.match(/^\s*[-*+]\s+\[([\s/xX])\]\s+(.+)$/);
        if (checkboxMatch) {
          total++;
          const statusChar = checkboxMatch[1].toLowerCase();
          let status: 'todo' | 'in_progress' | 'done' = 'todo';
          if (statusChar === 'x') {
            status = 'done';
            completed++;
          } else if (statusChar === '/') {
            status = 'in_progress';
            inProgress++;
          }

          const text = checkboxMatch[2].trim();
          taskCounter++;

          const taskInfo: TaskInfo = {
            id: `task-${taskCounter}`,
            text,
            status,
            raw: line.trim(),
          };

          if (!currentPhase) {
            currentPhase = {
              title: 'General Setup / Pre-phase',
              tasks: [],
            };
          }
          currentPhase.tasks.push(taskInfo);
        }
      }

      if (currentPhase) {
        phases.push(currentPhase);
      }
    }

    return {
      id: featureId,
      specHtml,
      planHtml,
      tasksHtml,
      walkthroughHtml,
      requirementsHtml,
      phases,
      tasksCount: { total, completed, inProgress },
    };
  } catch (err) {
    console.error('Error fetching feature details:', err);
    return null;
  }
}

// File Explorer Support
export interface FolderItem {
  name: string;
  path: string;
  isSpeckit: boolean;
}

export interface DirectoryContent {
  currentPath: string;
  parentPath: string | null;
  folders: FolderItem[];
  drives: string[];
}

export async function getHomeDir(): Promise<string> {
  return os.homedir();
}

export async function listDirectory(dirPath: string): Promise<DirectoryContent | null> {
  let targetPath = dirPath.trim();
  if (!targetPath) {
    targetPath = os.homedir();
  }

  // Normalize path
  targetPath = path.resolve(targetPath);

  try {
    const stats = await fs.stat(targetPath);
    if (!stats.isDirectory()) return null;

    const items = await fs.readdir(targetPath, { withFileTypes: true });
    const folders: FolderItem[] = [];

    for (const item of items) {
      if (item.isDirectory()) {
        const fullPath = path.join(targetPath, item.name);
        
        // Skip hidden folders like .git, node_modules, AppData etc to make it fast
        if (item.name.startsWith('.') && item.name !== '.specify') continue;
        if (item.name === 'node_modules' || item.name === 'AppData') continue;

        // Check if this subfolder is a speckit repo
        let isSpeckit = false;
        try {
          const specDir = path.join(fullPath, 'specs');
          const specifyDir = path.join(fullPath, '.specify');
          const [hasSpecs, hasSpecify] = await Promise.all([
            fs.stat(specDir).then(s => s.isDirectory()).catch(() => false),
            fs.stat(specifyDir).then(s => s.isDirectory()).catch(() => false),
          ]);
          isSpeckit = hasSpecs || hasSpecify;
        } catch {}

        folders.push({
          name: item.name,
          path: fullPath,
          isSpeckit,
        });
      }
    }

    // Sort folders alphabetically
    folders.sort((a, b) => a.name.localeCompare(b.name));

    // Get parent path
    const parentPath = targetPath === path.parse(targetPath).root ? null : path.dirname(targetPath);

    // Get Windows drives
    const drives = ['C:\\'];
    try {
      const potentialDrives = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
      for (const d of potentialDrives) {
        if (d === 'C') continue;
        try {
          await fs.access(`${d}:\\`);
          drives.push(`${d}:\\`);
        } catch {}
      }
    } catch {}

    return {
      currentPath: targetPath,
      parentPath,
      folders,
      drives,
    };
  } catch (err) {
    console.error(`Error listing directory ${targetPath}:`, err);
    return null;
  }
}

// Open folder browser dialog using powershell (local windows only)
export async function selectFolder(): Promise<string | null> {
  const tempFile = path.join(process.cwd(), 'temp-picker.ps1');
  const scriptContent = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select a SpecKit Repository Folder"
$dialog.ShowNewFolderButton = $false

# Create a temporary form and set it to TopMost to force dialog to the front
$Form = New-Object System.Windows.Forms.Form
$Form.TopMost = $true

# Show dialog with topmost form as the owner
$res = $dialog.ShowDialog($Form)
if ($res -eq "OK") {
    Write-Output $dialog.SelectedPath
}

# Clean up resources
$Form.Dispose()
$dialog.Dispose()
  `.trim();

  try {
    // Write temporary powershell script to project root
    await fs.writeFile(tempFile, scriptContent, 'utf8');

    // Run PowerShell script in STA mode (crucial for GUI thread dialogs)
    const command = `powershell -STA -NoProfile -ExecutionPolicy Bypass -File "${tempFile}"`;
    const { stdout } = await execPromise(command);

    // Clean up temporary script
    await fs.unlink(tempFile).catch(() => {});

    return stdout.trim() || null;
  } catch (err) {
    console.error('Error opening folder selector:', err);
    // Cleanup on error
    await fs.unlink(tempFile).catch(() => {});
    return null;
  }
}

