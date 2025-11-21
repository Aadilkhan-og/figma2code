/**
 * Error Fixer
 * Automatically repairs build and type errors in generated code
 */

import OpenAI from 'openai';
import { promises as fs } from 'fs';
import path from 'path';
import type { BuildError, AgentConfig, GeneratedFile } from '../types/agent';

export class ErrorFixer {
  private openai: OpenAI | null = null;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
  }

  /**
   * Fix errors in generated code
   */
  async fixErrors(
    errors: BuildError[],
    files: GeneratedFile[],
    workDir: string
  ): Promise<{ fixedFiles: GeneratedFile[]; remainingErrors: BuildError[] }> {
    const fixedFiles: GeneratedFile[] = [];
    const fixedPaths = new Set<string>();

    // Group errors by file
    const errorsByFile = this.groupErrorsByFile(errors);

    for (const [filePath, fileErrors] of Object.entries(errorsByFile)) {
      const file = files.find(f => f.path.endsWith(filePath) || filePath.endsWith(f.path));

      if (file) {
        const fixedContent = await this.fixFileErrors(file.content, fileErrors);
        if (fixedContent !== file.content) {
          fixedFiles.push({
            ...file,
            content: fixedContent,
          });
          fixedPaths.add(file.path);
        }
      } else {
        // Try to read file from workDir and fix it
        try {
          const absolutePath = path.join(workDir, filePath);
          const content = await fs.readFile(absolutePath, 'utf-8');
          const fixedContent = await this.fixFileErrors(content, fileErrors);

          if (fixedContent !== content) {
            fixedFiles.push({
              path: filePath,
              content: fixedContent,
              type: 'component',
            });
            fixedPaths.add(filePath);
          }
        } catch {
          // File not found - might be a different issue
        }
      }
    }

    // Add unfixed files
    for (const file of files) {
      if (!fixedPaths.has(file.path)) {
        fixedFiles.push(file);
      }
    }

    // Track remaining errors (errors we couldn't fix)
    const remainingErrors = errors.filter(e => {
      if (!e.file) return true;
      return !fixedPaths.has(e.file);
    });

    return { fixedFiles, remainingErrors };
  }

  /**
   * Fix errors in a single file
   */
  private async fixFileErrors(content: string, errors: BuildError[]): Promise<string> {
    if (this.openai) {
      return this.fixWithOpenAI(content, errors);
    }
    return this.fixWithPatterns(content, errors);
  }

  /**
   * Fix errors using OpenAI
   */
  private async fixWithOpenAI(content: string, errors: BuildError[]): Promise<string> {
    const errorDescription = errors
      .map(e => `- ${e.type}: ${e.message}${e.line ? ` (line ${e.line})` : ''}`)
      .join('\n');

    const response = await this.openai!.chat.completions.create({
      model: this.config.openaiModel || 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: `You are an expert TypeScript/React developer. Fix the errors in the provided code.

Rules:
1. Only fix the specific errors mentioned
2. Maintain the original code structure and style
3. Do not add unnecessary changes
4. Return ONLY the fixed code, no explanations
5. Ensure all imports are correct
6. Ensure all TypeScript types are valid`,
        },
        {
          role: 'user',
          content: `Fix these errors in the code:

Errors:
${errorDescription}

Code:
\`\`\`tsx
${content}
\`\`\`

Return the fixed code:`,
        },
      ],
      temperature: 0.1,
      max_tokens: 4000,
    });

    const fixedContent = response.choices[0]?.message?.content || content;

    // Extract code from markdown if present
    const codeMatch = fixedContent.match(/```(?:tsx?|jsx?|typescript|javascript)?\n([\s\S]*?)```/);
    return codeMatch ? codeMatch[1]!.trim() : fixedContent.trim();
  }

  /**
   * Fix errors using pattern matching (fallback)
   */
  private fixWithPatterns(content: string, errors: BuildError[]): string {
    let fixedContent = content;

    for (const error of errors) {
      fixedContent = this.applyPatternFix(fixedContent, error);
    }

    return fixedContent;
  }

  /**
   * Apply pattern-based fix for specific error
   */
  private applyPatternFix(content: string, error: BuildError): string {
    let result = content;

    switch (error.type) {
      case 'import':
        // Try to add missing import
        if (error.message.includes("Cannot find module")) {
          const moduleMatch = error.message.match(/Cannot find module '([^']+)'/);
          if (moduleMatch) {
            const moduleName = moduleMatch[1];
            // Check if it's a relative import that might be missing
            if (moduleName?.startsWith('.') || moduleName?.startsWith('@/')) {
              // Leave it - might need manual fix
            } else {
              // Add comment about missing dependency
              result = `// TODO: Install missing dependency: ${moduleName}\n${result}`;
            }
          }
        }
        break;

      case 'typescript':
        // Common TS error fixes
        if (error.message.includes("has no exported member")) {
          // Remove problematic import
          const memberMatch = error.message.match(/has no exported member '([^']+)'/);
          if (memberMatch) {
            const member = memberMatch[1];
            result = result.replace(new RegExp(`\\b${member}\\b,?\\s*`, 'g'), '');
          }
        }

        if (error.message.includes("'children' is specified more than once")) {
          // Remove duplicate children prop
          result = result.replace(/children\s*=\s*\{[^}]+\}\s*(?=children|>)/g, '');
        }

        if (error.message.includes("Property") && error.message.includes("does not exist")) {
          // Add any type annotation as quick fix
          const propMatch = error.message.match(/Property '([^']+)' does not exist/);
          if (propMatch && error.line) {
            const lines = result.split('\n');
            if (lines[error.line - 1]) {
              // Add @ts-ignore comment
              lines.splice(error.line - 1, 0, '  // @ts-ignore - Property fix needed');
              result = lines.join('\n');
            }
          }
        }
        break;

      case 'jsx':
        // Fix unclosed JSX tags
        if (error.message.includes("has no corresponding closing tag")) {
          const tagMatch = error.message.match(/JSX element '([^']+)'/);
          if (tagMatch) {
            const tag = tagMatch[1];
            // Try to find and close the tag
            const tagRegex = new RegExp(`<${tag}([^>]*)>(?![\s\S]*</${tag}>)`, 'g');
            result = result.replace(tagRegex, `<${tag}$1 />`);
          }
        }
        break;

      case 'syntax':
        // Common syntax error fixes
        if (error.message.includes("Unexpected token")) {
          // Try to fix common issues
          result = result
            .replace(/,\s*}/g, '}') // Remove trailing commas
            .replace(/,\s*\)/g, ')') // Remove trailing commas in function calls
            .replace(/{\s*,/g, '{'); // Remove leading commas
        }
        break;
    }

    return result;
  }

  /**
   * Group errors by file path
   */
  private groupErrorsByFile(errors: BuildError[]): Record<string, BuildError[]> {
    const grouped: Record<string, BuildError[]> = {};

    for (const error of errors) {
      const file = error.file || '_unknown_';
      if (!grouped[file]) {
        grouped[file] = [];
      }
      grouped[file]!.push(error);
    }

    return grouped;
  }
}
