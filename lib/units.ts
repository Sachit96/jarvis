const KG_TO_LBS = 2.2046226218;

/** Converts a kilogram value (as stored in the DB — every weight/volume column in the schema is kg) to pounds for display. */
export function kgToLbs(kg: number): number {
  return kg * KG_TO_LBS;
}

/** Converts a pounds value (user input) to kilograms for storage — every weight/volume column in the schema stays kg internally. */
export function lbsToKg(lbs: number): number {
  return lbs / KG_TO_LBS;
}

export function formatLbs(kg: number, fractionDigits = 0): string {
  return kgToLbs(kg).toLocaleString(undefined, { maximumFractionDigits: fractionDigits });
}
