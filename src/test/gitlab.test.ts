import { describe, it, expect } from 'vitest';
import { parseGitLabUrl } from '../services/gitlab';

describe('GitLab Service', () => {
  describe('parseGitLabUrl', () => {
    it('should parse simple group/project format', () => {
      const result = parseGitLabUrl('gitlab-org/gitlab');
      expect(result).toEqual({ host: 'gitlab.com', projectPath: 'gitlab-org/gitlab' });
    });

    it('should parse full GitLab URL', () => {
      const result = parseGitLabUrl('https://gitlab.com/gitlab-org/gitlab');
      expect(result).toEqual({ host: 'gitlab.com', projectPath: 'gitlab-org/gitlab' });
    });

    it('should parse GitLab URL with .git suffix', () => {
      const result = parseGitLabUrl('https://gitlab.com/gitlab-org/gitlab.git');
      expect(result).toEqual({ host: 'gitlab.com', projectPath: 'gitlab-org/gitlab' });
    });

    it('should handle nested groups', () => {
      const result = parseGitLabUrl('https://gitlab.com/group/subgroup/project');
      expect(result).toEqual({ host: 'gitlab.com', projectPath: 'group/subgroup/project' });
    });

    it('should handle URLs with trailing paths', () => {
      const result = parseGitLabUrl('https://gitlab.com/gitlab-org/gitlab/-/tree/main');
      expect(result).toEqual({ host: 'gitlab.com', projectPath: 'gitlab-org/gitlab' });
    });

    it('should handle self-hosted GitLab', () => {
      const result = parseGitLabUrl('https://gitlab.example.com/team/project');
      expect(result).toEqual({ host: 'gitlab.example.com', projectPath: 'team/project' });
    });

    it('should return null for invalid formats', () => {
      expect(parseGitLabUrl('not-a-valid-url')).toBeNull();
      expect(parseGitLabUrl('')).toBeNull();
    });
  });
});
