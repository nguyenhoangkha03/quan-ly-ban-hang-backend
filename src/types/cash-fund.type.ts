export interface CashFundCreateInput {
  fundDate: Date;
  openingBalance?: number;
  notes?: string;
}

export interface CashFundUpdateInput {
  openingBalance?: number;
  notes?: string;
}

export interface CashFundLockInput {
  approvedBy: number;
  reconciledBy: number;
  notes?: string;
}

export interface CashFundFilter {
  startDate?: Date;
  endDate?: Date;
  isLocked?: boolean;
  page?: number;
  limit?: number;
}
