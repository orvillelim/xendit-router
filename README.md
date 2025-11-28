# Xendit Card Router

A backend API for intelligent card payment routing based on merchant settings, country, currency, and MCC codes.

## Overview
- **Smart Route Selection**: Automatically selects the best payment route based on routing rules. Check Routing Rules below.
- **Payment Simulation**: Test payment success/failure scenarios
- **Database Logging**: Stores all payment transactions in PostgreSQL


### Routing Rules
The idea is to route the payment to *best* route based on the following rules 

- **Processor Capability Filtering**: Routes payments by Active, country, currency, MCC, card brands, and card types.
- **Configurable Weights**: JSON-based routing weight configuration per country.

### Weighted split routing

```
  Visual Example: Weights [0.7, 0.2, 0.1]

  Number line from 0 to 1.0:

  Route A  │  Route B  │  Route C
  0───────0.7─────────0.9────────1.0

  Iteration Process:

  Loop 1: Route A (weight 0.7)
  cumulative = 0 + 0.7 = 0.7

  Route A's range: 0.0 to 0.7
              ▼
  0───────────0.7─────────0.9────────1.0
  ◄──Route A──►

  If random < 0.7 → It's in Route A's range!

  Loop 2: Route B (weight 0.2)
  cumulative = 0.7 + 0.2 = 0.9

  Route B's range: 0.7 to 0.9
                      ▼
  0───────────0.7─────────0.9────────1.0
              ◄──Route B──►
```


## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma 7
- **Runtime**: Node.js

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database

### Installation

1. Clone the repository
```bash
cd xendit-card-router
```

2. Install dependencies
```bash
npm install
```

3. Set up DB
```bash
# .env
DATABASE_URL="postgresql://{}:{}@localhost:5432/xendit"
```

4. Run database migrations
```bash
npx prisma migrate dev
npx prisma generate
```

5. Start development server
```bash
npm run dev
```

Server runs at `http://localhost:3000`

## API Endpoints

### 1. Find Route
`POST /api/card/routes`

Finds the best payment route based on merchant and transaction details.

**Request:**
```json
{
  "business_id": "5f1feace75d97c11a21935a4",
  "country": "PH",
  "currency": "PHP"
}
```

**Response:**
```json
{
  "id": "24196270-9675-4b30-b974-beef3acf59a6",
  "status": "ACTIVE",
  "country": "PH",
  "currency": "PHP",
  "connection": {
    "partner_name": "CYBERSOURCE",
    "acquiring_bank_name": "UBP",
    ...
  },
  "cards": {
    "mid_label": "XENDIT_UBP_PHP",
    "supported_mcc": ["5999"],
    ...
  }
}
```

### 2. Process Payment
`POST /api/card/payment`

A payment simulation transaction and stores it in the database.

**Request:**
```json
{
  "business_id": "5f1feace75d97c11a21935a4",
  "reference_id": "ref-123",
  "payment_request_id": "pr-123",
  "country": "PH",
  "currency": "PHP",
  "request_amount": 10000.01,
  "card_number": "4111111111111112"
}
```

**Success Response:**
```json
{
  "success": true,
  "status": "CAPTURED",
  "transaction_id": "clxxx...",
  "reference_id": "ref-123",
  "amount": 10000.01,
  "currency": "PHP",
  "processed_at": "2025-11-28T..."
}
```

**Payment Simulation Logic:**
-  Random 50% success rate

## Configuration Files

Contains payment gateway (MID) configurations with supported countries, currencies, card brands, and MCC codes.
```
xendit-card-router/
├── app/
│   ├── api/
│   │   ├── card/
│   │   │   ├── routes/route.ts      # Route finding endpoint
│   │   │   ├── payment/route.ts     # Payment processing endpoint
│   │   │   └── util.ts              # Shared utilities
│   │   └── data/
│   │       ├── merchant_settings.json
│   │       ├── mid_settings.json
│   │       └── routing_weights.json
│   └── page.tsx
├── lib/
│   └── prisma.ts                    # Prisma client singleton
├── prisma/
│   ├── schema.prisma                # Database schema
│   └── migrations/
├── .env                             # Environment variables
├── prisma.config.ts                 # Prisma configuration
└── package.json
```

## Get Routes
### Find Routes simple routing 
POST `/api/card/routes`

```
curl --location 'localhost:3000/api/card/routes' \
--header 'Content-Type: application/json' \
--data '{
    "business_id": "5f1feace75d97c11a21935a4",
    "reference_id": "90392f42-d98a-49ef-a7f3-abcezas123",
    "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas123",
    "type": "PAY",
    "country": "PH",
    "currency": "PHP",
    "request_amount": 10000.01,
    "routing_type": "SIMPLE"
  }'
```

### Find Routes split routing 
POST `/api/card/routes`
```
curl --location 'localhost:3000/api/card/routes' \
--header 'Content-Type: application/json' \
--data '{
    "business_id": "5f1feace75d97c11a21935a4",
    "reference_id": "90392f42-d98a-49ef-a7f3-abcezas123",
    "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas123",
    "type": "PAY",
    "country": "PH",
    "currency": "PHP",
    "request_amount": 10000.01,
    "routing_type": "SPLIT" # defined here
  }'
```

### Response object
```json
{
    "id": "orville-test",
    "status": "ACTIVE",
    "country": "PH",
    "currency": "PHP",
    "connection": {
        "alias": "CYBS_REST-xendit_philippines-c5cde9c66b5a901902881d0c38b12918",
        "partner_name": "CYBERSOURCE",
        "merchant_id": "xendit_philippines",
        "acquiring_bank_name": "UBP",
        "acquiring_bank_mid": "007250000003107"
    },
    "cards": {
        "mid_label": "XENDIT_UBP_PHP",
        "supported_mcc": [],
        "supported_card_brands": [
            "VISA",
            "MASTERCARD"
        ],
        "installment": {}
    }
}
```

## Payment endpoint
POST /api/card/payment

```
curl --location 'localhost:3000/api/card/payment' \
--header 'Content-Type: application/json' \
--data '{
    "business_id": "5f1feace75d97c11a21935a4",
    "reference_id": "90392f42-d98a-49ef-a7f3-abcezas123",
    "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas123",
    "type": "PAY",
    "country": "PH",
    "currency": "PHP",
    "request_amount": 10000.01,
    "routing_type": "SPLIT"
  }'
```

### Response body
```json
{
    "success": false,
    "status": "FAILED",
    "transaction_id": "cmiihkrjr00032r1bpcpvjhm3",
    "reference_id": "90392f42-d98a-49ef-a7f3-abcezas123",
    "payment_request_id": "pr-90392f42-d98a-49ef-a7f3-abcezas123",
    "error_code": "PAYMENT_DECLINED",
    "error_message": "Payment was declined by the issuing bank",
    "processed_at": "2025-11-28T06:33:25.623Z"
}

```