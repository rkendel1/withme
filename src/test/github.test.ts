import { describe, it, expect } from 'vitest';
import { parseGitHubUrl } from '../services/github';

describe('GitHub Service', () => {
  describe('parseGitHubUrl', () => {
    it('should parse owner/repo format', () => {
      const result = parseGitHubUrl('facebook/react');
      expect(result).toEqual({ owner: 'facebook', repo: 'react' });
    });

    it('should parse full GitHub URL', () => {
      const result = parseGitHubUrl('https://github.com/facebook/react');
      expect(result).toEqual({ owner: 'facebook', repo: 'react' });
    });

    it('should parse GitHub URL with .git suffix', () => {
      const result = parseGitHubUrl('https://github.com/facebook/react.git');
      expect(result).toEqual({ owner: 'facebook', repo: 'react' });
    });

    it('should handle URLs with trailing paths', () => {
      const result = parseGitHubUrl('https://github.com/facebook/react/tree/main');
      expect(result).toEqual({ owner: 'facebook', repo: 'react' });
    });

    it('should return null for invalid URLs', () => {
      expect(parseGitHubUrl('invalid')).toBeNull();
      expect(parseGitHubUrl('')).toBeNull();
    });
  });
});
