import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import {MerchantSettings, MidSettings} from "@/app/api/types/types";
import {findMerchant} from "@/app/api/card/util";

interface CardRoutePayload {
  business_id: string;
  reference_id?: string;
  payment_request_id?: string;
  type?: string;
  country: string;
  currency: string;
  request_amount?: number;
  capture_method?: string;
  channel_code?: string;
  channel_properties?: any;
  actions?: any[];
  status?: string;
  description?: string;
  metadata?: any;
  created?: string;
  updated?: string;
}



export async function findRoutes(country: string, currency: string, mcc: string, allowedCardBrands: string[], allowedCardTypes: string[]) {
  const midFilePath = path.join(process.cwd(), 'app/api/data/mid_settings.json');
  const midFileContent = await readFile(midFilePath, 'utf-8');
  const midSettings: MidSettings[] = JSON.parse(midFileContent);

  const weightFilePath = path.join(process.cwd(), 'app/api/data/routing_weights.json');
  const weightFileContent = await readFile(weightFilePath, 'utf-8');
  const routingWeights: Record<string, Array<{ partner: string; mid_id: string; weight: number }>> = JSON.parse(weightFileContent);

  // Filter by status=ACTIVE, country, currency, supported_mcc, allowed_card_brands, and allowed_card_types
  console.log('Filtering routes with:', { country, currency, mcc, allowedCardBrands, allowedCardTypes });

  const routes = midSettings.filter(mid => {
    const isActive = mid.status === 'ACTIVE';
    const matchesCountry = mid.country === country;
    const matchesCurrency = mid.currency === currency;
    const matchesMcc = mid.cards.supported_mcc.length === 0 || mid.cards.supported_mcc.includes(mcc);
    const matchesCardBrands = mid.cards.supported_card_brands.some(brand => allowedCardBrands.includes(brand));
    const matchesCardTypes = !mid.cards.supported_card_types || mid.cards.supported_card_types.some(type => allowedCardTypes.includes(type));

    const passes = isActive && matchesCountry && matchesCurrency && matchesMcc && matchesCardBrands && matchesCardTypes;

    if (mid.id == 'orville-test')  {
      console.log(isActive && matchesCountry && matchesCurrency && matchesMcc && matchesCardBrands && matchesCardTypes)
    }
    if (!passes) {
      const reasons = [];
      if (!isActive) reasons.push(`status=${mid.status} (not ACTIVE)`);
      if (!matchesCountry) reasons.push(`country=${mid.country} (expected ${country})`);
      if (!matchesCurrency) reasons.push(`currency=${mid.currency} (expected ${currency})`);
      if (!matchesMcc) reasons.push(`mcc=${mid.cards.supported_mcc.join(',')} (expected ${mcc})`);
      if (!matchesCardBrands) reasons.push(`supported_card_brands=${mid.cards.supported_card_brands.join(',')} (allowed ${allowedCardBrands.join(',')})`);
      if (!matchesCardTypes) reasons.push(`supported_card_types=${mid.cards.supported_card_types?.join(',') || 'none'} (allowed ${allowedCardTypes.join(',')})`);

      console.log(`Skipped MID ${mid.id}: ${reasons.join(', ')}`);
    } else {
      console.log(`Selected MID ${mid.id}: ${mid.cards.mid_label}`);
    }

    return passes;
  });

  console.log(`Found ${routes.length} matching routes`);

  // Apply weights based on country configuration
  const countryWeights = routingWeights[country] || [];
  const routesWithWeights = routes.map(route => {
    const weightConfig = countryWeights.find(w => w.mid_id === route.id);
    const weight = weightConfig?.weight || 0;
    return { route, weight };
  });

  // Sort by weight (higher weight = higher priority)
  routesWithWeights.sort((a, b) => b.weight - a.weight);

  console.log('Routes ordered by weight:', routesWithWeights.map(r => ({
    id: r.route.id,
    label: r.route.cards.mid_label,
    partner: r.route.connection.partner_name,
    weight: r.weight
  })));

  return routesWithWeights.map(r => r.route);
}

export async function POST(request: NextRequest) {
  try {
    const body: CardRoutePayload = await request.json();

    const { business_id, country, currency } = body;

    // Validate required fields
    if (!business_id || !country || !currency) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: business_id, country, currency' },
        { status: 400 }
      );
    }

    // Find merchant by business_id
    const merchant = await findMerchant(business_id)

    if (!merchant) {
      return NextResponse.json(
        { success: false, error: `Merchant not found for business_id: ${business_id}` },
        { status: 404 }
      );
    }

    // Find routes using the merchant's mcc, allowed_card_brands, and allowed_card_types, and apply weighted route
    const routes = await findRoutes(country, currency, merchant.cards.mcc, merchant.cards.allowed_card_brands, merchant.cards.allowed_card_types);

    if (routes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active routes found matching the criteria' },
        { status: 404 }
      );
    }

    // Select first route if multiple found
    const selectedRoute = routes[0];

    return NextResponse.json(selectedRoute);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Invalid request' },
      { status: 400 }
    );
  }
}



