import api from '@/services/core/api';

export type GoogleAdsAssetKind = 'audience' | 'keyword_group' | 'headline_set';

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

export type GoogleAdsAssetPayload = AudiencePayload | KeywordGroupPayload | HeadlineSetPayload;

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
}

export const googleAdsCreationService = new GoogleAdsCreationService();
