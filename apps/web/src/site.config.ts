/** Settings that belong to the operator of the site, not to the code. */
export const SITE = {
  name: 'Motivado',
  /** Single contact address: footer, order pages, legal pages. */
  contactEmail: 'contact@simsab.net',
  /**
   * Link for voluntary support (a Stripe Payment Link where the customer chooses the amount, or a PayPal.me link).
   * While empty, the support page, its footer link and the notes on it stay hidden.
   */
  supportUrl: '',
  /** Name of the payment provider behind supportUrl, shown on the support page. */
  supportProvider: 'Stripe',
  /** Operator, as required for the Impressum and the privacy notice. */
  operator: {
    name: 'Simon Sablowski',
    street: 'Alt-Stralau 5',
    city: '10245 Berlin',
  },
};
