const nf = new Intl.NumberFormat("fa-IR");

/** Persian digits for display. Raw numbers are always what gets stored. */
export const fa = (n: number) => nf.format(n);

/** SPEC 3.6.6 -- round(multiplier * price_ref_toman, -4) toman. */
export const priceToman = (mult: number, refToman: number) =>
  Math.round((mult * refToman) / 10000) * 10000;

export const faToman = (mult: number, refToman: number) =>
  fa(priceToman(mult, refToman)) + " تومان";
