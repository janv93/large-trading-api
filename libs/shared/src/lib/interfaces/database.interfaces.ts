export interface DatabaseMaintenanceState {
  lastOutdatedBarRemoval: Date;
  hadStockSplitCleanup?: boolean;
}