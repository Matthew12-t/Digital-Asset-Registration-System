# Asset Registration System — REST API

A simple but complete asset registration system that lets users register and query digital assets on Ethereum, with metadata stored in a backend service.

## Stack
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **Storage**: In-memory (simulated DB)
- **Blockchain**: Solidity ABI snippet + simulated contract calls
- **Deploy**: Vercel (serverless)

---

## Architecture

```
Client → POST /auth/register → Create user (bcrypt hashed password)
Client → POST /auth/login    → Get JWT token
Client → POST /assets        → Register asset (JWT required) + simulate on-chain tx
Client → GET  /assets        → List/search assets (JWT required)
Client → GET  /assets/:id    → Fetch single asset (JWT required)
Client → GET  /contract/abi  → View Solidity ABI + contract source
```

---

## API Endpoints

### `POST /auth/register`
Register a new user.

**Body:**
```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "SecurePass123",
  "walletAddress": "0xYourEthAddress"  // optional
}
```

**Response (201):**
```json
{
  "message": "User registered successfully",
  "user": { "id": "...", "username": "alice", "email": "...", "createdAt": "..." }
}
```

---

### `POST /auth/login`
Authenticate and receive a JWT token.

**Body:**
```json
{
  "email": "alice@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "24h"
}
```

---

### `POST /assets` 🔒
Register a new digital asset. Requires `Authorization: Bearer <token>`.

**Body:**
```json
{
  "name": "Digital Artwork #001",
  "description": "A generative art piece",
  "assetType": "NFT",
  "metadataUri": "ipfs://Qm...",
  "tags": ["art", "generative"]
}
```

**Response (201):**
```json
{
  "message": "Asset registered successfully",
  "asset": { "id": "...", "name": "...", "metadataHash": "0x...", ... },
  "blockchain": {
    "success": true,
    "txHash": "0x...",
    "blockNumber": 18542123,
    "gasUsed": 34521,
    "contractAddress": "0x742d35...",
    "network": "ethereum-sepolia-testnet"
  }
}
```

---

### `GET /assets` 🔒
List all assets. Supports query params:
- `?owner=me` — only your assets
- `?type=NFT` — filter by asset type
- `?search=art` — search name, description, tags

---

### `GET /assets/:id` 🔒
Fetch a single asset by UUID.

---

### `GET /contract/abi`
Returns the Solidity ABI snippet and full contract source code.

---

## Solidity Contract (Snippet)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AssetRegistry {
    struct Asset {
        bytes32 metadataHash;
        address owner;
        uint256 timestamp;
    }

    mapping(bytes32 => Asset) private assets;

    event AssetRegistered(
        bytes32 indexed assetId,
        address indexed owner,
        uint256 timestamp
    );

    function registerAsset(
        bytes32 assetId,
        bytes32 metadataHash,
        address owner
    ) external returns (bool) {
        require(assets[assetId].timestamp == 0, "Asset already registered");
        assets[assetId] = Asset(metadataHash, owner, block.timestamp);
        emit AssetRegistered(assetId, owner, block.timestamp);
        return true;
    }

    function getAsset(bytes32 assetId)
        external view
        returns (bytes32, address, uint256)
    {
        Asset memory a = assets[assetId];
        require(a.timestamp != 0, "Asset not found");
        return (a.metadataHash, a.owner, a.timestamp);
    }
}
```

---

## Deploy to Vercel

### Option A: Vercel CLI
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Clone this project
git clone <your-repo>
cd asset-registry-api

# 3. Set your JWT secret
vercel env add JWT_SECRET

# 4. Deploy
vercel --prod
```

### Option B: GitHub → Vercel Dashboard
1. Push code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project
3. Import the repository
4. Add environment variable: `JWT_SECRET = your-secret-here`
5. Click **Deploy**

---

## Local Development

```bash
npm install
npm run dev
# → Server running at http://localhost:3000
```

---

## Notes & Assumptions
- **In-memory storage** resets on server restart. For production, replace with PostgreSQL/MongoDB.
- **Blockchain calls are simulated** — to connect to real Ethereum, use `ethers.js` with a provider (e.g. Infura/Alchemy) and deploy the Solidity contract above to Sepolia testnet.
- JWT tokens expire in **24 hours**.
- Passwords are hashed with **bcrypt (salt rounds: 10)**.
