#!/usr/bin/env bash
# Installs the libraries this repo builds on, at pinned versions, into lib/.
# The ENSv2 code in src/ensv2 is built and tested against exactly these commits, which match
# ensdomains/contracts-v2 at 48b3e2d, so change them only together with that code.
# Needs Foundry (https://getfoundry.sh). GitHub Actions runs this for you.
set -euo pipefail

install() { # install <folder in lib/> <owner/repo@commit-or-tag>
  if [ -d "lib/$1" ]; then
    echo "lib/$1 already installed"
  else
    forge install --no-git "$1=$2"
  fi
}

install forge-std foundry-rs/forge-std@v1.17.0
install openzeppelin-contracts OpenZeppelin/openzeppelin-contracts@e4f70216d759d8e6a64144a9e1f7bbeed78e7079 # 5.3.0
install openzeppelin-contracts-upgradeable OpenZeppelin/openzeppelin-contracts-upgradeable@5fc3fee14043035097ae718387200f4f4daaa982 # 5.2.0
install openzeppelin-contracts-v4 OpenZeppelin/openzeppelin-contracts@54b3f14346da01ba0d159114b399197fea8b7cda # used inside ens-contracts
install ens-contracts ensdomains/ens-contracts@3b1cc225ccdf64581d5fdc81db574f51ba5c8c09
install verifiable-factory ensdomains/verifiable-factory@5ef7b1a88fd9062bae580ed4048ca369f18450c4
install buffer ensdomains/buffer@82cc81935de1d1a82e021cf1030d902c5248982b
install solsha1 ensdomains/solsha1@c4fbe97cf5e8c1b8d607001588fd23abb5bfb923
install unruggable-gateways unruggable-labs/unruggable-gateways@7426ac57509e2023a673956439eed29998d2e371
install solady vectorized/solady@90db92ce173856605d24a554969f2c67cadbc7e9
