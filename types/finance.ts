export type TransactionStatus = 'pending' | 'paid' | 'cancelled' | 'rejected';
export type FlowType = 'in' | 'out';

export interface TransactionMetadata {
  // Dùng cho chi thưởng (Auto)
  source_table?: 'member_milestone_rewards' | 'member_podium_rewards';
  source_id?: string;
  race_name?: string;
  milestone?: string;
  rank?: string;
  
  // Dùng cho chi mua sắm (Manual)
  related_challenge_id?: string;
  item_list?: string;
  note?: string;
  manual_entry?: boolean;
}

export interface Transaction {
  id: string;
  category_name: string;
  category_code: string;
  flow_type: FlowType;
  amount: number;
  description?: string;
  payment_status: TransactionStatus;
  created_at: string;
  processed_at?: string;
  metadata?: TransactionMetadata;
}
