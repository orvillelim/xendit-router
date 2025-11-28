export interface MerchantSettings {
  id: string;
  business_id: string;
  signing_entity: string;
  cards: {
    allowed_card_brands: string[];
    allowed_card_types: string[];
    currency_configuration: {
      [key: string]: {
        min_amount: string | null;
        max_amount: string | null;
        settlement_time: string | null;
      } | null;
    };
    mcc: string;
    industry_sector: string;
  };
}

export interface MidSettings {
  id: string;
  status: string;
  country: string;
  currency: string;
  weight?: number;
  connection: {
    alias: string;
    partner_name: string;
    merchant_id: string;
    acquiring_bank_name: string;
    acquiring_bank_mid: string;
  };
  cards: {
    mid_label: string;
    supported_mcc: string[];
    supported_card_brands: string[];
    supported_card_types?: string[];
    installment: any;
  };
}