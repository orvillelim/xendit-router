import {NextRequest, NextResponse} from 'next/server';
import {readFile} from 'fs/promises';
import path from 'path';
import {MidSettings, PaymentRequest} from "@/app/api/types/types";
import {findMerchant} from "@/app/api/card/util";

// Weighted random selection function for SPLIT routing
function selectRouteByWeight(routesWithWeights: Array<{ route: MidSettings; weight: number }>): MidSettings {
    // Filter out routes with zero weight
    const validRoutes = routesWithWeights.filter(r => r.weight > 0);

    if (validRoutes.length === 1) {
        console.log(`SIMPLE routing: Single route selected - ${validRoutes[0].route.id} (${validRoutes[0].route.cards.mid_label})`);
        return validRoutes[0].route;
    }

    // Calculate total weight
    const totalWeight = validRoutes.reduce((sum, r) => sum + r.weight, 0);

    // Generate random number between 0 and totalWeight
    const random = Math.random() * totalWeight;

    console.log(`SPLIT routing: Total weight = ${totalWeight}, Random = ${random.toFixed(4)}`);

    // Select route based on cumulative weight
    let cumulative = 0;
    for (const item of validRoutes) {
        cumulative += item.weight;
        if (random < cumulative) {
            const percentage = ((item.weight / totalWeight) * 100).toFixed(1);
            console.log(`Selected route: ${item.route.id} (${item.route.cards.mid_label}) - Weight: ${item.weight} (${percentage}%)`);
            return item.route;
        }
    }

    // Fallback (shouldn't happen due to floating point precision, return last route)
    const lastRoute = validRoutes[validRoutes.length - 1];
    console.log(`Fallback: Selected last route ${lastRoute.route.id}`);
    return lastRoute.route;
}


export async function findRoutes(country: string, currency: string, mcc: string, allowedCardBrands: string[], allowedCardTypes: string[], isSplit = false) {
    const midFilePath = path.join(process.cwd(), 'app/api/data/mid_settings.json');
    const midFileContent = await readFile(midFilePath, 'utf-8');
    const midSettings: MidSettings[] = JSON.parse(midFileContent);

    const weightFilePath = path.join(process.cwd(), 'app/api/data/routing_weights.json');
    const weightFileContent = await readFile(weightFilePath, 'utf-8');
    const routingWeights: Record<string, Array<{
        partner: string;
        mid_id: string;
        weight: number
    }>> = JSON.parse(weightFileContent);

    // Filter by status=ACTIVE, country, currency, supported_mcc, allowed_card_brands, and allowed_card_types
    console.log('Filtering routes with:', {country, currency, mcc, allowedCardBrands, allowedCardTypes});

    const routes = midSettings.filter(mid => {
        const isActive = mid.status === 'ACTIVE';
        const matchesCountry = mid.country === country;
        const matchesCurrency = mid.currency === currency;
        const matchesMcc = mid.cards.supported_mcc.length === 0 || mid.cards.supported_mcc.includes(mcc);
        const matchesCardBrands = mid.cards.supported_card_brands.some(brand => allowedCardBrands.includes(brand));
        const matchesCardTypes = !mid.cards.supported_card_types || mid.cards.supported_card_types.some(type => allowedCardTypes.includes(type));

        const passes = isActive && matchesCountry && matchesCurrency && matchesMcc && matchesCardBrands && matchesCardTypes;

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

    if (!isSplit) {
        return routes
    }

    // Apply split routing rules using weights based json config
    const countryWeights = routingWeights[country] || [];
    const routesWithWeights = routes.map(route => {
        const weightConfig = countryWeights.find(w => w.mid_id === route.id);
        const weight = weightConfig?.weight || 0;
        return {route, weight};
    });

    console.log('Available routes with weights:', routesWithWeights.map(r => ({
        id: r.route.id,
        label: r.route.cards.mid_label,
        partner: r.route.connection.partner_name,
        weight: r.weight
    })));

    // Use weighted random selection for SPLIT routing
    const selectedRoute = selectRouteByWeight(routesWithWeights);
    return [selectedRoute];
}

export async function POST(request: NextRequest) {
    try {
        const body: PaymentRequest = await request.json();

        const {business_id, country, currency, routing_type} = body;

        // Validate required fields
        if (!business_id || !country || !currency) {
            return NextResponse.json(
                {success: false, error: 'Missing required fields: business_id, country, currency'},
                {status: 400}
            );
        }

        // Find merchant by business_id
        const merchant = await findMerchant(business_id)

        if (!merchant) {
            return NextResponse.json(
                {success: false, error: `Merchant not found for business_id: ${business_id}`},
                {status: 404}
            );
        }

        // Find routes using the merchant's mcc, allowed_card_brands, and allowed_card_types, and apply weighted route
        const isSplit = routing_type === 'SPLIT'
        const routes = await findRoutes(country, currency, merchant.cards.mcc, merchant.cards.allowed_card_brands, merchant.cards.allowed_card_types, isSplit);

        console.log(routes)
        if (routes.length === 0) {
            return NextResponse.json(
                {success: false, error: 'No active routes found matching the criteria'},
                {status: 404}
            );
        }

        // Select first route if multiple found
        const selectedRoute = routes[0];

        return NextResponse.json(selectedRoute);
    } catch (error) {
        return NextResponse.json(
            {success: false, error: 'Invalid request'},
            {status: 400}
        );
    }
}



