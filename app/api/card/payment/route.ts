import {NextRequest, NextResponse} from 'next/server';
import {findRoutes} from '../routes/route';
import {findMerchant} from "@/app/api/card/util";
import {prisma} from '@/lib/prisma';
import {PaymentRequest} from "@/app/api/types/types";


export async function POST(request: NextRequest) {
    try {
        const body: PaymentRequest = await request.json();

        const {business_id, reference_id, payment_request_id, country, currency, request_amount, routing_type} = body;

        // Validate required fields
        if (!business_id || !reference_id || !payment_request_id || !country || !currency || !request_amount) {
            return NextResponse.json(
                {success: false, error: 'Missing required fields'},
                {status: 400}
            );
        }

        const merchant = await findMerchant(business_id)

        if (!merchant) {
            return NextResponse.json(
                {success: false, error: `Merchant not found for business_id: ${business_id}`},
                {status: 404}
            );
        }

        // Find best route
        const isSplit = routing_type === 'SPLIT'
        const routes = await findRoutes(country, currency, merchant.cards.mcc, merchant.cards.allowed_card_brands, merchant.cards.allowed_card_types, isSplit);

        if (routes.length === 0) {
            return NextResponse.json(
                {success: false, error: 'No active routes found matching the criteria'},
                {status: 404}
            );
        }

        const selectedRoute = routes[0];

        // Simulate payment processing
        const isSuccess = simulatePayment(body);
        const transactionStatus = isSuccess ? 'SUCCESS' : 'FAILED';

        // Save transaction to database
        const transaction = await prisma.paymentTransaction.create({
            data: {
                business_id,
                mid_id: selectedRoute.id,
                status: transactionStatus,
                payment_request: body as any
            }
        });

        if (isSuccess) {
            return NextResponse.json({
                success: true,
                status: 'CAPTURED',
                transaction_id: transaction.id,
                reference_id,
                payment_request_id,
                amount: request_amount,
                currency,
                processed_at: transaction.created_at.toISOString()
            });
        } else {
            return NextResponse.json({
                success: false,
                status: 'FAILED',
                transaction_id: transaction.id,
                reference_id,
                payment_request_id,
                error_code: 'PAYMENT_DECLINED',
                error_message: 'Payment was declined by the issuing bank',
                processed_at: transaction.created_at.toISOString()
            }, {status: 402});
        }
    } catch (error) {
        console.error('Payment endpoint error:', error);
        console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));

        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('Error details:', errorMessage);

        return NextResponse.json(
            {
                success: false,
                error: 'Invalid request',
                details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
                errorCode: (error as any)?.code,
                meta: (error as any)?.meta,
                stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
            },
            {status: 400}
        );
    }
}

function simulatePayment(payment: PaymentRequest): boolean {
    // Random success (80% success rate)
    return Math.random() < 0.5;
}


