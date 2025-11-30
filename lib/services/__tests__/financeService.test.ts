import { getUserTransactions, getPublicFundStats } from '../financeService';

// Mock supabase client for server-side functions
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  rpc: jest.fn().mockReturnThis(),
  storage: {
    from: jest.fn().mockReturnThis(),
    upload: jest.fn(),
    getPublicUrl: jest.fn(),
  },
};

describe('financeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getUserTransactions returns sorted transactions', async () => {
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.order.mockReturnThis();
    mockSupabase.limit.mockResolvedValue({ data: [
      { id: '2', created_at: '2025-11-30T10:00:00Z' },
      { id: '1', created_at: '2025-11-29T10:00:00Z' },
    ], error: null });
    // @ts-ignore
    const result = await getUserTransactions.call({ supabase: mockSupabase }, 'user1');
    expect(result[0].id).toBe('2');
    expect(result.length).toBe(2);
  });

  it('getPublicFundStats returns correct balance and expenses', async () => {
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.in.mockReturnThis();
    mockSupabase.order.mockReturnThis();
    mockSupabase.limit.mockReturnThis();
    mockSupabase.from.mockReturnValueOnce({ data: [{ amount: 100000, type: 'fund_collection' }], error: null });
    mockSupabase.from.mockReturnValueOnce({ data: [{ amount: 50000, type: 'expense' }], error: null });
    mockSupabase.from.mockReturnValueOnce({ data: [{ created_at: '2025-11-30', description: 'Chi nước', amount: 50000 }], error: null });
    // @ts-ignore
    const result = await getPublicFundStats.call({ supabase: mockSupabase });
    expect(result.totalBalance).toBe(50000);
    expect(result.latestExpenses[0].description).toBe('Chi nước');
  });
});
