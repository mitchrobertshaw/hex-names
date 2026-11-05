// Makes a new encryption key pair for the bot: npm run keygen
//
// Buyers on Ethereum seal their order details to the public key, so that only the bot can read
// which name they are buying. Put the secret key in BOT_ENCRYPTION_SECRET_KEY and publish the
// public key wherever the website that places orders can read it.

import nacl from "tweetnacl";
import { bytesToHex } from "viem";

const keyPair = nacl.box.keyPair();
console.log(`BOT_ENCRYPTION_SECRET_KEY=${bytesToHex(keyPair.secretKey)}`);
console.log(`Public key, for websites:  ${bytesToHex(keyPair.publicKey)}`);
