// The parts of the contracts the app calls (src/ in the repo root, and ENSv2).

import { parseAbi } from "viem";

const SWAP = "struct Swap { address router; address[] path; uint256 amountOutMin; uint256 deadline; }";

/** ENSv2's ETHRegistrar: commitments and prices. */
export const registrarAbi = parseAbi([
  "function commit(bytes32 commitment)",
  "function commitmentAt(bytes32 commitment) view returns (uint64)",
  "function MIN_COMMITMENT_AGE() view returns (uint64)",
  "function MAX_COMMITMENT_AGE() view returns (uint64)",
  "function isAvailable(string label) view returns (bool)",
  "function getRegisterPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)",
  "function getRenewPrice(string label, uint64 duration, address paymentToken) view returns (uint256 base, uint256 premium)",
]);

/** ENSv2's PermissionedRegistry: who owns a name, and until when. Names are ERC-1155 tokens. */
export const registryAbi = parseAbi([
  "struct State { uint8 status; uint64 expiry; address latestOwner; uint256 tokenId; uint256 resource; }",
  "function getState(uint256 anyId) view returns (State)",
  "function getOwner(uint256 anyId) view returns (address)",
  "function LABEL_STORE() view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)",
]);

/** ENSv2's LabelStore: each name's label, by its id (keccak256 of the label, as referral tags are). */
export const labelStoreAbi = parseAbi(["function getLabel(uint256 anyId) view returns (string)"]);

/** The registrar's records of each purchase and renewal, with what was paid and the referral tag. */
export const registrarEvents = parseAbi([
  "event NameRegistered(uint256 indexed tokenId, string label, address owner, address subregistry, address resolver, uint64 duration, address paymentToken, bytes32 indexed referrer, uint256 base, uint256 premium)",
  "event NameRenewed(uint256 indexed tokenId, string label, uint64 duration, uint64 newExpiry, address paymentToken, bytes32 indexed referrer, uint256 amount)",
]);

/** AnyTokenCheckout: buys and renews with any token or PLS. Written out in full: the registration
 *  struct is too long for TypeScript to read from viem's one-line format. */
const registration = {
  type: "tuple",
  name: "reg",
  components: [
    { type: "string", name: "label" },
    { type: "address", name: "owner" },
    { type: "bytes32", name: "secret" },
    { type: "address", name: "subregistry" },
    { type: "address", name: "resolver" },
    { type: "uint64", name: "duration" },
    { type: "bytes32", name: "referrer" },
  ],
} as const;

const renewal = {
  type: "tuple",
  name: "ren",
  components: [
    { type: "string", name: "label" },
    { type: "uint64", name: "duration" },
    { type: "bytes32", name: "referrer" },
  ],
} as const;

const swap = {
  type: "tuple",
  name: "swap",
  components: [
    { type: "address", name: "router" },
    { type: "address[]", name: "path" },
    { type: "uint256", name: "amountOutMin" },
    { type: "uint256", name: "deadline" },
  ],
} as const;

const uint = (name: string) => ({ type: "uint256", name }) as const;

export const checkoutAbi = [
  {
    type: "function",
    name: "registerWithToken",
    stateMutability: "nonpayable",
    inputs: [registration, { type: "address", name: "tokenIn" }, uint("amountIn"), swap],
    outputs: [uint("tokenId"), uint("change")],
  },
  {
    type: "function",
    name: "registerWithPLS",
    stateMutability: "payable",
    inputs: [registration, swap],
    outputs: [uint("tokenId"), uint("change")],
  },
  {
    type: "function",
    name: "renewWithToken",
    stateMutability: "nonpayable",
    inputs: [renewal, { type: "address", name: "tokenIn" }, uint("amountIn"), swap],
    outputs: [uint("change")],
  },
  {
    type: "function",
    name: "renewWithPLS",
    stateMutability: "payable",
    inputs: [renewal, swap],
    outputs: [uint("change")],
  },
  ...parseAbi([
    "function quoteRegister(string label, uint64 duration, address router, address[] path) view returns (uint256 price, uint256 amountIn)",
    "function quoteRenew(string label, uint64 duration, address router, address[] path) view returns (uint256 price, uint256 amountIn)",
  ]),
] as const;

/** HexOrderBook: orders placed from Ethereum. */
export const orderBookAbi = parseAbi([
  SWAP,
  "function placeOrder(bytes32 commitment, uint256 amount, bytes encryptedReveal) returns (uint256 orderId)",
  "function placeOrderWithToken(bytes32 commitment, uint256 amount, bytes encryptedReveal, address tokenIn, uint256 amountIn, Swap swap) returns (uint256 orderId, uint256 change)",
  "function placeOrderWithETH(bytes32 commitment, uint256 amount, bytes encryptedReveal, Swap swap) payable returns (uint256 orderId, uint256 change)",
  "function quote(uint256 amount, address router, address[] path) view returns (uint256 amountIn)",
  "event OrderPlaced(uint256 indexed orderId, address indexed buyer, bytes32 indexed commitment, uint256 amount, uint64 deadline, bytes encryptedReveal)",
]);

export const erc20Abi = parseAbi([
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);
