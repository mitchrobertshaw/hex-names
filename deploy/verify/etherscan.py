"""Publish a contract's source code on Etherscan, from the build's own record of what it compiled.

usage: ETHERSCAN_API_KEY=... python3 deploy/verify/etherscan.py <address> <source file:contract> <constructor args, or ->

Run it after `forge build`, from the repository's root. `forge verify-contract` makes its own bundle
of source files, and for a contract that reaches a library through a remapping that applies only
inside another library (ENS's UniversalResolverV2 imports OpenZeppelin 4 that way) the bundle leaves
files out, so Etherscan can't compile it. The compiler's metadata, which forge build writes next to
each contract, lists every file the compiler read and the exact settings, so this sends exactly
those. Etherscan compiles them and only publishes the code if the result matches the chain.
Contracts already verified are left alone.
"""
import glob
import json
import os
import sys
import time
import urllib.parse
import urllib.request

ADDRESS, TARGET, ARGS = sys.argv[1], sys.argv[2], sys.argv[3]
API = os.environ.get("ETHERSCAN_API_URL", "https://api.etherscan.io/v2/api?chainid=1")
KEY = os.environ["ETHERSCAN_API_KEY"]
NAME = TARGET.rsplit(":", 1)[1]


def etherscan(params, post=False):
    data = urllib.parse.urlencode({**params, "apikey": KEY})
    for attempt in range(8):
        time.sleep(1)  # a free Etherscan key allows 3 calls a second
        request = (urllib.request.Request(API, data=data.encode(), method="POST") if post
                   else urllib.request.Request(f"{API}&{data}"))
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                reply = json.load(response)
        except Exception as error:  # a network hiccup: wait, then ask again
            print(f"  Etherscan didn't answer ({type(error).__name__}), asking again", flush=True)
            time.sleep(10 * (attempt + 1))
            continue
        if "rate limit" in str(reply.get("result", "")).lower():  # too many calls a second: ask again
            time.sleep(3)
            continue
        return reply
    sys.exit(f"Not verified: {NAME} {ADDRESS}: Etherscan didn't answer")


def verified():
    result = etherscan({"module": "contract", "action": "getsourcecode", "address": ADDRESS}).get("result")
    return isinstance(result, list) and bool(result) and bool(result[0].get("SourceCode"))


def standard_input():
    source, name = TARGET.rsplit(":", 1)
    for path in glob.glob(f"out/**/{name}.json", recursive=True):
        artifact = json.load(open(path))
        meta = artifact.get("metadata")
        meta = meta if isinstance(meta, dict) else json.loads(artifact.get("rawMetadata") or "{}")
        if meta.get("settings", {}).get("compilationTarget", {}).get(source) == name:
            settings = {k: v for k, v in meta["settings"].items() if k != "compilationTarget"}
            settings["outputSelection"] = {"*": {"*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"]}}
            sources = {file: {"content": open(file, encoding="utf-8").read()} for file in meta["sources"]}
            return meta["compiler"]["version"], {"language": "Solidity", "sources": sources, "settings": settings}
    sys.exit(f"Not verified: {NAME} {ADDRESS}: no build of {TARGET}; run forge build first")


if verified():
    print(f"Already verified: {NAME} https://etherscan.io/address/{ADDRESS}#code")
    sys.exit(0)

version, std = standard_input()
print(f"Sending {NAME} ({len(std['sources'])} source files, compiler {version})", flush=True)
form = {
    "module": "contract",
    "action": "verifysourcecode",
    "codeformat": "solidity-standard-json-input",
    "contractaddress": ADDRESS,
    "contractname": TARGET,
    "compilerversion": f"v{version}",
    "sourceCode": json.dumps(std),
}
if ARGS != "-":
    form["constructorArguements"] = ARGS  # Etherscan's own spelling; left out when there are none, as forge does
reply = etherscan(form, post=True)
if str(reply.get("status")) != "1":
    if "already verified" in str(reply.get("result", "")).lower():
        print(f"Already verified: {NAME} https://etherscan.io/address/{ADDRESS}#code")
        sys.exit(0)
    sys.exit(f"Not verified: {NAME} {ADDRESS}: {reply.get('result') or reply.get('message')}")

guid = reply["result"]
for _ in range(60):  # Etherscan's queue can take minutes; wait up to 10
    time.sleep(10)
    status = etherscan({"module": "contract", "action": "checkverifystatus", "guid": guid})
    result = str(status.get("result", ""))
    if "pending" in result.lower() or "queue" in result.lower():
        continue
    if str(status.get("status")) == "1" or "already verified" in result.lower():
        print(f"Verified: {NAME} https://etherscan.io/address/{ADDRESS}#code")
        sys.exit(0)
    sys.exit(f"Not verified: {NAME} {ADDRESS}: {result}")
sys.exit(f"Not verified: {NAME} {ADDRESS}: Etherscan was still checking after 10 minutes; run it again later")
