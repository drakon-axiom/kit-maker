// Order Add-On eligibility logic

// Statuses where add-ons are blocked (packing has started or later)
const ADDON_BLOCKED_STATUSES = [
  'in_packing',
  'packed', 
  'awaiting_invoice',
  'awaiting_payment',
  'ready_to_ship',
  'shipped',
  'cancelled'
];

/**
 * Check if an order can have add-ons created for it
 * Add-ons are allowed until packing begins
 */
export const canCreateAddon = (status: string): boolean => {
  return !ADDON_BLOCKED_STATUSES.includes(status);
};

/**
 * Get a user-friendly message explaining why add-ons are blocked
 */
export const getAddonBlockedReason = (status: string): string | null => {
  if (canCreateAddon(status)) return null;
  
  switch (status) {
    case 'in_packing':
      return 'Add-ons cannot be created once packing has started';
    case 'packed':
      return 'Order has already been packed';
    case 'awaiting_invoice':
    case 'awaiting_payment':
      return 'Order is in the invoicing/payment stage';
    case 'ready_to_ship':
      return 'Order is ready to ship';
    case 'shipped':
      return 'Order has already been shipped';
    case 'cancelled':
      return 'Order has been cancelled';
    default:
      return 'Add-ons are not available for this order status';
  }
};

/**
 * Validate add-on size against settings limits
 */
export const validateAddonSize = (
  addonTotal: number,
  parentTotal: number,
  maxPercent: number
): { valid: boolean; message?: string } => {
  if (maxPercent <= 0) {
    return { valid: true }; // No limit configured
  }
  
  const percentOfParent = (addonTotal / parentTotal) * 100;
  
  if (percentOfParent > maxPercent) {
    return {
      valid: false,
      message: `Add-on exceeds ${maxPercent}% of original order value. Consider creating a separate order instead.`
    };
  }
  
  return { valid: true };
};
