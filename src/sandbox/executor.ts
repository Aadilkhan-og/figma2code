/**
 * Sandbox Executor
 * Executes generated code in an isolated environment for build validation
 */

import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import type { GeneratedCodeBundle, BuildResult, BuildError, AgentConfig } from '../types/agent.js';

export interface SandboxOptions {
  workDir?: string;
  timeout?: number;
  port?: number;
  keepAlive?: boolean;
}

export class SandboxExecutor {
  private config: AgentConfig;
  private options: SandboxOptions;
  private workDir: string;
  private devServer: ChildProcess | null = null;

  constructor(config: AgentConfig, options?: SandboxOptions) {
    this.config = config;
    this.options = options || {};
    // Use config.outputDir as the working directory for the sandbox
    this.workDir = options?.workDir || config.outputDir;
  }

  /**
   * Initialize sandbox environment
   */
  async initialize(): Promise<void> {
    // Create sandbox directory
    await fs.mkdir(this.workDir, { recursive: true });

    // Check if package.json exists, if not create project structure
    const packageJsonPath = path.join(this.workDir, 'package.json');
    try {
      await fs.access(packageJsonPath);
    } catch {
      await this.createProjectStructure();
    }
  }

  /**
   * Create base project structure for sandbox
   */
  private async createProjectStructure(): Promise<void> {
    // Create package.json for Vite React project
    const packageJson = {
      name: 'figma2code-sandbox',
      private: true,
      version: '0.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'tsc && vite build',
        preview: 'vite preview',
        typecheck: 'tsc --noEmit',
      },
      dependencies: {
        react: '^18.2.0',
        'react-dom': '^18.2.0',
      },
      devDependencies: {
        '@types/react': '^18.2.43',
        '@types/react-dom': '^18.2.17',
        '@vitejs/plugin-react': '^4.2.1',
        autoprefixer: '^10.4.16',
        postcss: '^8.4.32',
        tailwindcss: '^3.4.0',
        typescript: '^5.3.3',
        vite: '^5.0.8',
      },
    };

    await fs.writeFile(
      path.join(this.workDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Create vite.config.ts
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
`;
    await fs.writeFile(path.join(this.workDir, 'vite.config.ts'), viteConfig);

    // Create tsconfig.json
    const tsConfig = {
      compilerOptions: {
        target: 'ES2020',
        useDefineForClassFields: true,
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        skipLibCheck: true,
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: 'react-jsx',
        strict: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        noFallthroughCasesInSwitch: true,
        baseUrl: '.',
        paths: {
          '@/*': ['./src/*'],
        },
      },
      include: ['src'],
      references: [{ path: './tsconfig.node.json' }],
    };

    await fs.writeFile(
      path.join(this.workDir, 'tsconfig.json'),
      JSON.stringify(tsConfig, null, 2)
    );

    // Create tsconfig.node.json
    const tsConfigNode = {
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowSyntheticDefaultImports: true,
      },
      include: ['vite.config.ts'],
    };

    await fs.writeFile(
      path.join(this.workDir, 'tsconfig.node.json'),
      JSON.stringify(tsConfigNode, null, 2)
    );

    // Create index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Figma2Code Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
    await fs.writeFile(path.join(this.workDir, 'index.html'), indexHtml);

    // Create src directory
    await fs.mkdir(path.join(this.workDir, 'src'), { recursive: true });
    await fs.mkdir(path.join(this.workDir, 'src', 'components', 'ui'), { recursive: true });
    await fs.mkdir(path.join(this.workDir, 'src', 'pages'), { recursive: true });

    // Create main.tsx
    const mainTsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.js'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`;
    await fs.writeFile(path.join(this.workDir, 'src', 'main.tsx'), mainTsx);

    // Create vite-env.d.ts
    const viteEnvDts = `/// <reference types="vite/client" />
`;
    await fs.writeFile(path.join(this.workDir, 'src', 'vite-env.d.ts'), viteEnvDts);

    // Install dependencies
    await this.runCommand('npm', ['install'], { cwd: this.workDir, timeout: 120000 });
  }

  /**
   * Deploy generated code to sandbox
   */
  async deploy(bundle: GeneratedCodeBundle): Promise<void> {
    // Write all files
    for (const file of bundle.files) {
      const filePath = path.join(this.workDir, file.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, file.content);
    }

    // Create App.tsx that imports the main component
    const entryFile = bundle.entryPoint;
    const componentName = path.basename(entryFile, '.tsx');
    const componentPath = './' + entryFile.replace(/^src\//, '').replace(/\.tsx$/, '');

    const appTsx = `import React from 'react'
import ${componentName} from '${componentPath}'

function App() {
  return <${componentName} />
}

export default App
`;
    await fs.writeFile(path.join(this.workDir, 'src', 'App.tsx'), appTsx);
  }

  /**
   * Run TypeScript type checking
   */
  async typeCheck(): Promise<BuildResult> {
    const result: BuildResult = {
      status: 'PENDING',
      errors: [],
      warnings: [],
    };

    try {
      const { stdout, stderr } = await this.runCommand('npm', ['run', 'typecheck'], {
        cwd: this.workDir,
        timeout: this.options.timeout || 30000,
      });

      if (stderr && !stderr.includes('error TS')) {
        result.warnings.push(stderr);
      }

      // Parse TypeScript errors from output
      const errorPattern = /(.+)\((\d+),(\d+)\): error (TS\d+): (.+)/g;
      const output = stdout + stderr;
      let match;

      while ((match = errorPattern.exec(output)) !== null) {
        result.errors.push({
          type: 'typescript',
          file: match[1],
          line: parseInt(match[2] ?? '0', 10),
          column: parseInt(match[3] ?? '0', 10),
          code: match[4],
          message: match[5] ?? '',
        });
      }

      result.status = result.errors.length === 0 ? 'SUCCESS' : 'FAILED';
    } catch (error) {
      result.status = 'FAILED';
      result.errors.push({
        type: 'typescript',
        message: error instanceof Error ? error.message : 'Unknown error during type check',
      });
    }

    return result;
  }

  /**
   * Run build process
   */
  async build(): Promise<BuildResult> {
    const result: BuildResult = {
      status: 'PENDING',
      errors: [],
      warnings: [],
    };

    const startTime = Date.now();

    try {
      const { stdout, stderr } = await this.runCommand('npm', ['run', 'build'], {
        cwd: this.workDir,
        timeout: this.options.timeout || 60000,
      });

      result.buildTime = Date.now() - startTime;
      result.outputPath = path.join(this.workDir, 'dist');

      // Parse errors from output
      const errors = this.parseErrors(stdout + stderr);
      result.errors = errors;

      // Check for warnings
      if (stderr && !errors.length) {
        result.warnings.push(stderr);
      }

      result.status = errors.length === 0 ? 'SUCCESS' : 'FAILED';
    } catch (error) {
      result.status = 'FAILED';
      result.buildTime = Date.now() - startTime;

      if (error instanceof Error) {
        const errors = this.parseErrors(error.message);
        if (errors.length > 0) {
          result.errors = errors;
        } else {
          result.errors.push({
            type: 'unknown',
            message: error.message,
          });
        }
      }
    }

    return result;
  }

  /**
   * Start development server
   */
  async startDevServer(): Promise<{ url: string; pid: number }> {
    const port = this.options.port || this.config.sandboxPort || 3001;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Dev server startup timeout'));
      }, 30000);

      this.devServer = spawn('npm', ['run', 'dev', '--', '--port', port.toString()], {
        cwd: this.workDir,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      const handleOutput = (data: Buffer) => {
        const output = data.toString();
        // Look for Vite ready message
        if (output.includes('Local:') || output.includes('localhost:')) {
          clearTimeout(timeout);
          resolve({
            url: `http://localhost:${port}`,
            pid: this.devServer!.pid!,
          });
        }
      };

      this.devServer.stdout?.on('data', handleOutput);
      this.devServer.stderr?.on('data', handleOutput);

      this.devServer.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.devServer.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timeout);
          reject(new Error(`Dev server exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Stop development server
   */
  async stopDevServer(): Promise<void> {
    if (this.devServer) {
      this.devServer.kill('SIGTERM');
      this.devServer = null;
    }
  }

  /**
   * Clean sandbox directory
   */
  async clean(): Promise<void> {
    await this.stopDevServer();

    // Remove dist and node_modules if not keeping alive
    if (!this.options.keepAlive) {
      try {
        await fs.rm(this.workDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Parse build errors from output
   */
  private parseErrors(output: string): BuildError[] {
    const errors: BuildError[] = [];

    // TypeScript errors
    const tsPattern = /(.+)\((\d+),(\d+)\): error (TS\d+): (.+)/g;
    let match;
    while ((match = tsPattern.exec(output)) !== null) {
      errors.push({
        type: 'typescript',
        file: match[1],
        line: parseInt(match[2] ?? '0', 10),
        column: parseInt(match[3] ?? '0', 10),
        code: match[4],
        message: match[5] ?? '',
      });
    }

    // Vite/ESBuild errors
    const vitePattern = /error: (.+)\n\s+(.+):(\d+):(\d+)/g;
    while ((match = vitePattern.exec(output)) !== null) {
      errors.push({
        type: 'syntax',
        message: match[1] ?? '',
        file: match[2],
        line: parseInt(match[3] ?? '0', 10),
        column: parseInt(match[4] ?? '0', 10),
      });
    }

    // Import errors
    const importPattern = /Cannot find module '([^']+)'/g;
    while ((match = importPattern.exec(output)) !== null) {
      errors.push({
        type: 'import',
        message: `Cannot find module '${match[1]}'`,
        suggestion: `Install package: npm install ${match[1]}`,
      });
    }

    // JSX errors
    const jsxPattern = /JSX element '([^']+)' has no corresponding closing tag/g;
    while ((match = jsxPattern.exec(output)) !== null) {
      errors.push({
        type: 'jsx',
        message: `JSX element '${match[1]}' has no corresponding closing tag`,
      });
    }

    return errors;
  }

  /**
   * Run a command and capture output
   */
  private runCommand(
    command: string,
    args: string[],
    options: { cwd: string; timeout?: number }
  ): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(command, args, {
        cwd: options.cwd,
        shell: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Command timeout'));
      }, options.timeout || 30000);

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Command failed with code ${code}\n${stderr}\n${stdout}`));
        }
      });

      proc.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * Get sandbox working directory
   */
  getWorkDir(): string {
    return this.workDir;
  }
}
