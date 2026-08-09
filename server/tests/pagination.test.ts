import { describe, expect, it } from 'vitest';
import { parsePagination } from '../src/libs/pagination.js';

describe('parsePagination', () => {
  it('defaults to page 1, limit 20', () => {
    expect(parsePagination({})).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('parses page/limit and computes offset', () => {
    expect(parsePagination({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('clamps negative pages and oversized limits', () => {
    expect(parsePagination({ page: '-2', limit: '9999' })).toEqual({ page: 1, limit: 100, offset: 0 });
  });

  it('ignores garbage input', () => {
    expect(parsePagination({ page: 'abc', limit: 'xyz' })).toEqual({ page: 1, limit: 20, offset: 0 });
  });
});