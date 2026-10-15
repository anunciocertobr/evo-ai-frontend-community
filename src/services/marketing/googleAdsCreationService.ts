import api from '@/services/core/api';

export type GoogleAdsAssetKind =
  | 'audience'
  | 'keyword_group'
  | 'headline_set'
  | 'sitelink'
  | 'callout'
  | 'structured_snippet'
  | 'call'
  | 'lead_form'
  | 'price'
  | 'image_asset';

export interface AudiencePayload {
  description?: string;
  keywords: string[];
  urls: string[];
  apps: string[];
}

export type KeywordMatchType = 'broad' | 'phrase' | 'exact';

export interface KeywordEntry {
  text: string;
  matchType: KeywordMatchType;
  negative: boolean;
}

export interface KeywordGroupPayload {
  adGroupName?: string;
  keywords: KeywordEntry[];
}

export interface HeadlineSetPayload {
  finalUrl?: string;
  headlines: string[];
  descriptions: string[];
}

export interface SitelinkEntry {
  linkText: string;
  description1?: string;
  description2?: string;
  finalUrl: string;
}

export interface SitelinkPayload {
  sitelinks: SitelinkEntry[];
}

export interface CalloutPayload {
  callouts: string[];
}

// Valores do enum StructuredSnippetHeader da Google Ads API.
export type StructuredSnippetHeader =
  | 'BRANDS'
  | 'COURSES'
  | 'DEGREE_PROGRAMS'
  | 'DESTINATIONS'
  | 'FEATURED_HOTELS'
  | 'INSURANCE_COVERAGE'
  | 'MODELS'
  | 'NEIGHBORHOODS'
  | 'SERVICE_CATALOG'
  | 'SHOWS'
  | 'STYLES'
  | 'TYPES'
  | 'AMENITIES';

export interface StructuredSnippetPayload {
  header: StructuredSnippetHeader;
  values: string[];
}

export interface CallPayload {
  countryCode: string;
  phoneNumber: string;
}

export type LeadFormCallToAction =
  | 'LEARN_MORE'
  | 'GET_QUOTE'
  | 'APPLY_NOW'
  | 'SIGN_UP'
  | 'CONTACT_US'
  | 'SUBSCRIBE'
  | 'DOWNLOAD'
  | 'BOOK_NOW'
  | 'GET_OFFER'
  | 'REGISTER';

export type LeadFormQuestionField =
  | 'FULL_NAME'
  | 'EMAIL'
  | 'PHONE_NUMBER'
  | 'POSTAL_CODE'
  | 'CITY'
  | 'REGION'
  | 'COMPANY_NAME'
  | 'JOB_TITLE';

export interface LeadFormPayload {
  businessName: string;
  headline: string;
  description: string;
  callToAction: LeadFormCallToAction;
  privacyPolicyUrl: string;
  questions: LeadFormQuestionField[];
}

export type PriceExtensionType =
  | 'BRANDS'
  | 'EVENTS'
  | 'LOCATIONS'
  | 'NEIGHBORHOODS'
  | 'PRODUCT_CATEGORIES'
  | 'PRODUCT_TIERS'
  | 'SERVICES'
  | 'SERVICE_CATEGORIES'
  | 'SERVICE_TIERS';

export type PriceQualifier = 'FROM' | 'UP_TO' | 'AVERAGE';

export type PriceUnit = 'PER_HOUR' | 'PER_DAY' | 'PER_WEEK' | 'PER_MONTH' | 'PER_YEAR' | 'PER_NIGHT';

export interface PriceOfferingEntry {
  header: string;
  description: string;
  price: string;
  unit?: PriceUnit;
  finalUrl: string;
}

export interface PricePayload {
  type: PriceExtensionType;
  priceQualifier?: PriceQualifier;
  offerings: PriceOfferingEntry[];
}

export interface ImageAssetEntry {
  fileUrl: string;
  fileName: string;
}

export interface ImageAssetPayload {
  images: ImageAssetEntry[];
}

export type GoogleAdsAssetPayload =
  | AudiencePayload
  | KeywordGroupPayload
  | HeadlineSetPayload
  | SitelinkPayload
  | CalloutPayload
  | StructuredSnippetPayload
  | CallPayload
  | LeadFormPayload
  | PricePayload
  | ImageAssetPayload;

export interface GoogleAdsAsset<P = GoogleAdsAssetPayload> {
  id: string;
  kind: GoogleAdsAssetKind;
  name: string;
  payload: P;
  created_at: string;
  updated_at: string;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  errors?: string[];
}

class GoogleAdsCreationService {
  private readonly baseUrl = '/marketing/google_ads_assets';

  async list<P = GoogleAdsAssetPayload>(kind: GoogleAdsAssetKind): Promise<GoogleAdsAsset<P>[]> {
    const response = await api.get<ApiEnvelope<GoogleAdsAsset<P>[]>>(this.baseUrl, {
      params: { kind },
    });
    return response.data.data;
  }

  async create<P = GoogleAdsAssetPayload>(
    kind: GoogleAdsAssetKind,
    name: string,
    payload: P,
  ): Promise<GoogleAdsAsset<P>> {
    const response = await api.post<ApiEnvelope<GoogleAdsAsset<P>>>(this.baseUrl, {
      google_ads_asset: { kind, name, payload },
    });
    return response.data.data;
  }

  async update<P = GoogleAdsAssetPayload>(
    id: string,
    name: string,
    payload: P,
  ): Promise<GoogleAdsAsset<P>> {
    const response = await api.put<ApiEnvelope<GoogleAdsAsset<P>>>(`${this.baseUrl}/${id}`, {
      google_ads_asset: { name, payload },
    });
    return response.data.data;
  }

  async remove(id: string): Promise<void> {
    await api.delete(`${this.baseUrl}/${id}`);
  }

  // Reaproveita o endpoint genérico de upload (ActiveStorage) já usado por
  // anexos de conversa/produtos — devolve a URL pública do arquivo.
  async uploadImage(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('attachment', file);
    const response = await api.post<ApiEnvelope<{ file_url: string }>>('/uploads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data.file_url;
  }
}

export const googleAdsCreationService = new GoogleAdsCreationService();
