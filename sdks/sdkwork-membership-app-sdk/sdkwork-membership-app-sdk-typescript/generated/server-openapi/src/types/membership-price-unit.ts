/** Per-seat pricing mode of a package. `package` means the price covers the whole package; `seat` means the price is the unit price of one seat for one billing period, and the checkout total is unit price x selected seats. */
export type MembershipPriceUnit = 'package' | 'seat';
