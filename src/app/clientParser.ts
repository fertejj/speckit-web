import { marked } from 'marked';
import { RepoStatus, FeatureSummary, FeatureDetails, TaskPhase, TaskInfo } from './actions';
import { translateMarkdown } from './actions';

// Define the interface for client-side directory reading
export interface ClientFolderSource {
  type: 'handle' | 'files';
  name: string;
  exists(relativePath: string): Promise<boolean>;
  readFile(relativePath: string): Promise<string>;
  readDirectories(relativePath: string): Promise<string[]>;
}

// 1. Implementation using File System Access API (showDirectoryPicker)
export class DirectoryHandleSource implements ClientFolderSource {
  type = 'handle' as const;
  constructor(public handle: FileSystemDirectoryHandle) {}
  
  get name() {
    return this.handle.name;
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await this.getHandle(relativePath);
      return true;
    } catch {
      return false;
    }
  }

  async readFile(relativePath: string): Promise<string> {
    const handle = await this.getFileHandle(relativePath);
    const file = await handle.getFile();
    return await file.text();
  }

  async readDirectories(relativePath: string): Promise<string[]> {
    const handle = relativePath ? await this.getDirectoryHandle(relativePath) : this.handle;
    const dirs: string[] = [];
    for await (const entry of (handle as any).values()) {
      if (entry.kind === 'directory') {
        dirs.push(entry.name);
      }
    }
    return dirs;
  }

  private async getHandle(relativePath: string): Promise<FileSystemHandle> {
    // Normalize path separators to forward slash and split
    const parts = relativePath.replace(/\\/g, '/').split('/').filter(Boolean);
    let current: FileSystemHandle = this.handle;
    
    for (let i = 0; i < parts.length; i++) {
      if (current.kind !== 'directory') throw new Error('Not a directory');
      const dir = current as FileSystemDirectoryHandle;
      if (i === parts.length - 1) {
        try {
          current = await dir.getDirectoryHandle(parts[i]);
        } catch {
          current = await dir.getFileHandle(parts[i]);
        }
      } else {
        current = await dir.getDirectoryHandle(parts[i]);
      }
    }
    return current;
  }

  private async getFileHandle(relativePath: string): Promise<FileSystemFileHandle> {
    const handle = await this.getHandle(relativePath);
    if (handle.kind !== 'file') throw new Error('Not a file');
    return handle as FileSystemFileHandle;
  }

  private async getDirectoryHandle(relativePath: string): Promise<FileSystemDirectoryHandle> {
    const handle = await this.getHandle(relativePath);
    if (handle.kind !== 'directory') throw new Error('Not a directory');
    return handle as FileSystemDirectoryHandle;
  }
}

// 2. Implementation using standard input element (webkitdirectory)
export class FilesListSource implements ClientFolderSource {
  type = 'files' as const;
  private fileMap = new Map<string, File>();
  private dirMap = new Map<string, Set<string>>(); // parentPath -> set of folder names
  name: string;

  constructor(files: File[]) {
    // Find the root folder name from the first file's webkitRelativePath
    const firstPath = files[0]?.webkitRelativePath || '';
    const rootName = firstPath.split('/')[0] || 'Repository';
    this.name = rootName;

    for (const file of files) {
      // Normalize path to use forward slashes and strip the root folder name
      const pathParts = file.webkitRelativePath.split('/');
      pathParts.shift(); // Remove root name
      
      const relativePath = pathParts.join('/');
      this.fileMap.set(relativePath, file);

      // Populate directories
      for (let i = 0; i < pathParts.length - 1; i++) {
        const parentPath = pathParts.slice(0, i).join('/');
        const dirName = pathParts[i];
        if (!this.dirMap.has(parentPath)) {
          this.dirMap.set(parentPath, new Set());
        }
        this.dirMap.get(parentPath)!.add(dirName);
      }
    }
  }

  async exists(relativePath: string): Promise<boolean> {
    const normPath = relativePath.replace(/\\/g, '/');
    return this.fileMap.has(normPath) || this.dirMap.has(normPath);
  }

  async readFile(relativePath: string): Promise<string> {
    const normPath = relativePath.replace(/\\/g, '/');
    const file = this.fileMap.get(normPath);
    if (!file) throw new Error(`File not found: ${relativePath}`);
    return await file.text();
  }

  async readDirectories(relativePath: string): Promise<string[]> {
    const normPath = relativePath.replace(/\\/g, '/').replace(/^\//, '');
    const dirs = this.dirMap.get(normPath);
    return dirs ? Array.from(dirs) : [];
  }
}

// Client-side implementation of checkRepository
export async function clientCheckRepository(source: ClientFolderSource): Promise<RepoStatus> {
  try {
    const hasSpecify = await source.exists('.specify');
    const hasSpecs = await source.exists('specs');
    const isSpeckit = hasSpecify || hasSpecs;

    let speckitVersion = 'Unknown';
    if (hasSpecify) {
      try {
        const initOptionsContent = await source.readFile('.specify/init-options.json');
        const initOptions = JSON.parse(initOptionsContent);
        if (initOptions.speckit_version) {
          speckitVersion = initOptions.speckit_version;
        }
      } catch {
        try {
          const integrationContent = await source.readFile('.specify/integration.json');
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
      error: errorMsg || 'Error checking client directory',
    };
  }
}

// Client-side implementation of getFeatures
export async function clientGetFeatures(source: ClientFolderSource): Promise<FeatureSummary[]> {
  try {
    const dirs = await source.readDirectories('specs');
    const features: FeatureSummary[] = [];

    for (const dirName of dirs) {
      const featureDir = `specs/${dirName}`;

      const [hasSpec, hasPlan, hasTasks, hasWalkthrough, hasRequirements] = await Promise.all([
        source.exists(`${featureDir}/spec.md`),
        source.exists(`${featureDir}/plan.md`),
        source.exists(`${featureDir}/tasks.md`),
        source.exists(`${featureDir}/walkthrough.md`),
        source.exists(`${featureDir}/checklists/requirements.md`),
      ]);

      let title = dirName.replace(/^\d+-/, '').replace(/-/g, ' ');
      title = title.charAt(0).toUpperCase() + title.slice(1);

      let branch = '';
      let date = '';

      if (hasPlan) {
        try {
          const planContent = await source.readFile(`${featureDir}/plan.md`);
          const h1Match = planContent.match(/^#\s+(.+)$/m);
          if (h1Match) {
            title = h1Match[1].trim();
          }
          const branchMatch = planContent.match(/\*\*Branch\*\*:\s*`([^`]+)`/i);
          if (branchMatch) branch = branchMatch[1];

          const dateMatch = planContent.match(/\*\*Date\*\*:\s*([^\s|]+)/i);
          if (dateMatch) date = dateMatch[1];
        } catch {}
      }

      let total = 0;
      let completed = 0;
      let inProgress = 0;

      if (hasTasks) {
        try {
          const tasksContent = await source.readFile(`${featureDir}/tasks.md`);
          const lines = tasksContent.split('\n');

          for (const line of lines) {
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

    return features.sort((a, b) => a.id.localeCompare(b.id));
  } catch {
    return [];
  }
}

// Client-side implementation of getFeatureDetails
export async function clientGetFeatureDetails(
  source: ClientFolderSource,
  featureId: string,
  targetLang?: string
): Promise<FeatureDetails | null> {
  const featureDir = `specs/${featureId}`;

  try {
    const readFileIfExists = async (relativePath: string): Promise<string | null> => {
      try {
        const exists = await source.exists(relativePath);
        if (!exists) return null;
        return await source.readFile(relativePath);
      } catch {
        return null;
      }
    };

    let [specMd, planMd, tasksMd, walkthroughMd, requirementsMd] = await Promise.all([
      readFileIfExists(`${featureDir}/spec.md`),
      readFileIfExists(`${featureDir}/plan.md`),
      readFileIfExists(`${featureDir}/tasks.md`),
      readFileIfExists(`${featureDir}/walkthrough.md`),
      readFileIfExists(`${featureDir}/checklists/requirements.md`),
    ]);

    // Translate content using server action if requested
    if (targetLang && targetLang !== 'original') {
      [specMd, planMd, tasksMd, walkthroughMd, requirementsMd] = await Promise.all([
        specMd ? translateMarkdown(specMd, targetLang) : null,
        planMd ? translateMarkdown(planMd, targetLang) : null,
        tasksMd ? translateMarkdown(tasksMd, targetLang) : null,
        walkthroughMd ? translateMarkdown(walkthroughMd, targetLang) : null,
        requirementsMd ? translateMarkdown(requirementsMd, targetLang) : null,
      ]);
    }

    const parseMdToHtml = (content: string | null): string | null => {
      if (!content) return null;
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

    const phases: TaskPhase[] = [];
    let currentPhase: TaskPhase | null = null;
    let total = 0;
    let completed = 0;
    let inProgress = 0;

    if (tasksMd) {
      const lines = tasksMd.split('\n');
      let taskCounter = 0;

      for (const line of lines) {
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
    console.error('Error fetching client feature details:', err);
    return null;
  }
}
