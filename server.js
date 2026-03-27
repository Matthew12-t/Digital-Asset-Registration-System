const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const JWT_SECRET = process.env.JWT_SECRET || "itb-asset-registry-secret-2024";

// ─── In-Memory Database ────────────────────────────────────────────────────────
const db = {
  users: [],
  assets: [],
};

// ─── Solidity Contract ABI (snippet / reference) ──────────────────────────────
// This represents the ABI of an Ethereum smart contract for on-chain asset hashing.
// In production: deploy this contract and call it via ethers.js / web3.js.
const CONTRACT_ABI_SNIPPET = [
  {
    name: "registerAsset",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetId", type: "bytes32" },
      { name: "metadataHash", type: "bytes32" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ name: "success", type: "bool" }],
  },
  {
    name: "getAsset",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "assetId", type: "bytes32" }],
    outputs: [
      { name: "metadataHash", type: "bytes32" },
      { name: "owner", type: "address" },
      { name: "timestamp", type: "uint256" },
    ],
  },
  {
    name: "AssetRegistered",
    type: "event",
    inputs: [
      { name: "assetId", type: "bytes32", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
];

// Simulated Solidity contract interaction (pseudo call)
function simulateContractCall(action, params) {
  const mockTxHash =
    "0x" + Buffer.from(JSON.stringify(params)).toString("hex").slice(0, 64);
  return {
    success: true,
    txHash: mockTxHash,
    blockNumber: Math.floor(Math.random() * 1000000) + 18000000,
    gasUsed: Math.floor(Math.random() * 50000) + 21000,
    contractAddress: "0x742d35Cc6634C0532925a3b8D4C9B9e8f2e4c1D4",
    network: "ethereum-sepolia-testnet",
    action,
    params,
  };
}

// ─── Middleware ────────────────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// Health check
app.get("/", (req, res) => {
  res.json({
    service: "Asset Registration API",
    version: "1.0.0",
    author: "ITB Internship Candidate",
    endpoints: [
      "POST /auth/register",
      "POST /auth/login",
      "POST /assets",
      "GET  /assets",
      "GET  /assets/:id",
      "GET  /contract/abi",
    ],
  });
});

// Register user
app.post("/auth/register", async (req, res) => {
  const { username, email, password, walletAddress } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: "username, email, and password are required" });
  }
  if (db.users.find((u) => u.email === email)) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: uuidv4(),
    username,
    email,
    password: hashedPassword,
    walletAddress: walletAddress || null,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  const { password: _, ...safeUser } = user;
  res.status(201).json({ message: "User registered successfully", user: safeUser });
});

// Login
app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }
  const user = db.users.find((u) => u.email === email);
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: "Invalid credentials" });

  const token = jwt.sign(
    { userId: user.id, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
  res.json({ message: "Login successful", token, expiresIn: "24h" });
});

// Register asset (protected)
app.post("/assets", authMiddleware, (req, res) => {
  const { name, description, assetType, metadataUri, tags } = req.body;
  if (!name || !assetType) {
    return res.status(400).json({ error: "name and assetType are required" });
  }

  const assetId = uuidv4();
  const metadataHash =
    "0x" +
    Buffer.from(name + assetType + req.user.userId)
      .toString("hex")
      .padEnd(64, "0")
      .slice(0, 64);

  // Simulate on-chain registration
  const blockchainResult = simulateContractCall("registerAsset", {
    assetId: "0x" + assetId.replace(/-/g, ""),
    metadataHash,
    owner: req.user.walletAddress || "0x0000000000000000000000000000000000000000",
  });

  const asset = {
    id: assetId,
    name,
    description: description || "",
    assetType,
    metadataUri: metadataUri || null,
    tags: tags || [],
    owner: req.user.userId,
    ownerUsername: req.user.username,
    metadataHash,
    blockchain: blockchainResult,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.assets.push(asset);
  res.status(201).json({
    message: "Asset registered successfully",
    asset,
    blockchain: blockchainResult,
  });
});

// List assets (protected)
app.get("/assets", authMiddleware, (req, res) => {
  const { type, owner, search } = req.query;
  let assets = [...db.assets];

  if (type) assets = assets.filter((a) => a.assetType === type);
  if (owner === "me") assets = assets.filter((a) => a.owner === req.user.userId);
  if (search) {
    const q = search.toLowerCase();
    assets = assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  res.json({ total: assets.length, assets });
});

// Get single asset (protected)
app.get("/assets/:id", authMiddleware, (req, res) => {
  const asset = db.assets.find((a) => a.id === req.params.id);
  if (!asset) return res.status(404).json({ error: "Asset not found" });
  res.json({ asset });
});

// Contract ABI endpoint
app.get("/contract/abi", (req, res) => {
  res.json({
    description:
      "Solidity ABI snippet for the AssetRegistry smart contract on Ethereum",
    contractAddress: "0x742d35Cc6634C0532925a3b8D4C9B9e8f2e4c1D4",
    network: "Sepolia Testnet",
    abi: CONTRACT_ABI_SNIPPET,
    soliditySource: `
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
        external
        view
        returns (bytes32 metadataHash, address owner, uint256 timestamp)
    {
        Asset memory a = assets[assetId];
        require(a.timestamp != 0, "Asset not found");
        return (a.metadataHash, a.owner, a.timestamp);
    }
}`,
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Asset Registry API running on port ${PORT}`);
});

module.exports = app;
