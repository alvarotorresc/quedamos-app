import { buildDatasourceUrl } from './prisma.service';

describe('buildDatasourceUrl', () => {
  it('should append connection_limit with ? when URL has no query params', () => {
    const url = buildDatasourceUrl('postgresql://user:pass@host:5432/db', 5);
    expect(url).toBe('postgresql://user:pass@host:5432/db?connection_limit=5');
  });

  it('should append connection_limit with & when URL already has query params', () => {
    const url = buildDatasourceUrl('postgresql://user:pass@host:5432/db?schema=public', 5);
    expect(url).toBe('postgresql://user:pass@host:5432/db?schema=public&connection_limit=5');
  });

  it('should use the provided connection limit value', () => {
    const url = buildDatasourceUrl('postgresql://host/db', 10);
    expect(url).toContain('connection_limit=10');
  });

  it('should handle Supabase pooler URLs with existing params', () => {
    const url = buildDatasourceUrl('postgresql://user:pass@host:6543/db?pgbouncer=true', 3);
    expect(url).toBe('postgresql://user:pass@host:6543/db?pgbouncer=true&connection_limit=3');
  });
});
