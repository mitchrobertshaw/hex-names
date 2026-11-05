// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GatewayProvider} from "@ens/contracts/ccipRead/GatewayProvider.sol";
import {VerifiableFactory} from "@ensdomains/verifiable-factory/VerifiableFactory.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import {ETHRegistrar} from "../src/ensv2/registrar/ETHRegistrar.sol";
import {StandardRentPriceOracle, PaymentRatio} from "../src/ensv2/registrar/StandardRentPriceOracle.sol";
import {RegistryRolesLib} from "../src/ensv2/registry/libraries/RegistryRolesLib.sol";
import {PermissionedRegistry} from "../src/ensv2/registry/PermissionedRegistry.sol";
import {UserRegistry} from "../src/ensv2/registry/UserRegistry.sol";
import {PermissionedResolver} from "../src/ensv2/resolver/PermissionedResolver.sol";
import {UniversalResolverV2} from "../src/ensv2/universalResolver/UniversalResolverV2.sol";
import {ContractNamer} from "../src/ensv2/utils/ContractNamer.sol";
import {LabelStore} from "../src/ensv2/utils/LabelStore.sol";

import {HexConfig} from "./HexConfig.sol";

/// @notice Every contract in a `.hex` deployment.
struct HexDeployment {
    ContractNamer contractNamer;
    VerifiableFactory verifiableFactory;
    LabelStore labelStore;
    UserRegistry userRegistryImpl;
    PermissionedRegistry rootRegistry;
    PermissionedRegistry hexRegistry;
    StandardRentPriceOracle rentPriceOracle;
    ETHRegistrar registrar;
    GatewayProvider batchGatewayProvider;
    UniversalResolverV2 universalResolver;
    PermissionedResolver resolverImpl;
}

/// @notice Deploys the ENSv2 registry stack for the `.hex` ending, wired the same way ENS wires
///         `.eth`: a root registry holding `hex`, a `.hex` registry, a registrar allowed to
///         register and renew in it, a rent price oracle, and a universal resolver for lookups.
/// @dev Shared by the deploy script and the tests. `admin` must be the account making these calls:
///      it receives the setup roles, which it should hand to a multisig or give up afterwards.
abstract contract HexStack {
    /// @notice Root roles on the root registry, matching ENS's static deployment permissions.
    function _rootRegistryRoles() internal pure returns (uint256) {
        return RegistryRolesLib.ROLE_REGISTRAR | RegistryRolesLib.ROLE_REGISTRAR_ADMIN
            | RegistryRolesLib.ROLE_REGISTER_RESERVED | RegistryRolesLib.ROLE_REGISTER_RESERVED_ADMIN
            | RegistryRolesLib.ROLE_SET_PARENT | RegistryRolesLib.ROLE_SET_PARENT_ADMIN | RegistryRolesLib.ROLE_RENEW
            | RegistryRolesLib.ROLE_RENEW_ADMIN | RegistryRolesLib.ROLE_CAN_NAME | RegistryRolesLib.ROLE_CAN_NAME_ADMIN;
    }

    /// @notice Root roles on the `.hex` registry. Registering and renewing go to the registrar.
    function _hexRegistryRoles() internal pure returns (uint256) {
        return RegistryRolesLib.ROLE_REGISTRAR_ADMIN | RegistryRolesLib.ROLE_REGISTER_RESERVED_ADMIN
            | RegistryRolesLib.ROLE_SET_PARENT | RegistryRolesLib.ROLE_SET_PARENT_ADMIN
            | RegistryRolesLib.ROLE_RENEW_ADMIN | RegistryRolesLib.ROLE_CAN_NAME | RegistryRolesLib.ROLE_CAN_NAME_ADMIN;
    }

    /// @notice Roles on the `hex` entry in the root registry.
    function _hexTokenRoles() internal pure returns (uint256) {
        return RegistryRolesLib.ROLE_SET_SUBREGISTRY | RegistryRolesLib.ROLE_SET_SUBREGISTRY_ADMIN
            | RegistryRolesLib.ROLE_SET_RESOLVER | RegistryRolesLib.ROLE_SET_RESOLVER_ADMIN;
    }

    /// @param admin Receives the setup roles. Must be the account making these calls.
    /// @param beneficiary Receives registration and renewal payments.
    /// @param paymentRatios Stablecoins the registrar accepts, with their exchange rates.
    function _deployHexStack(address admin, address beneficiary, PaymentRatio[] memory paymentRatios)
        internal
        returns (HexDeployment memory d)
    {
        d.contractNamer = ContractNamer(
            address(new ERC1967Proxy(address(new ContractNamer()), abi.encodeCall(ContractNamer.initialize, (admin))))
        );
        d.verifiableFactory = new VerifiableFactory();
        d.labelStore = new LabelStore(d.contractNamer);
        d.userRegistryImpl = new UserRegistry(d.labelStore, admin);

        d.rootRegistry = new PermissionedRegistry(d.labelStore, admin, _rootRegistryRoles());
        d.hexRegistry = new PermissionedRegistry(d.labelStore, admin, _hexRegistryRoles());
        d.rootRegistry.register(HexConfig.ENDING, admin, d.hexRegistry, address(0), _hexTokenRoles(), type(uint64).max);
        d.hexRegistry.setParent(d.rootRegistry, HexConfig.ENDING);

        d.rentPriceOracle = new StandardRentPriceOracle(
            admin,
            HexConfig.baseRates(),
            HexConfig.discountPoints(),
            HexConfig.DISCOUNT_DENOMINATOR,
            HexConfig.PREMIUM_PRICE_INITIAL,
            HexConfig.PREMIUM_HALVING_PERIOD,
            HexConfig.PREMIUM_PERIOD,
            paymentRatios
        );
        d.registrar = new ETHRegistrar(
            admin,
            d.hexRegistry,
            beneficiary,
            d.rentPriceOracle,
            HexConfig.GRACE_PERIOD,
            HexConfig.MIN_COMMITMENT_AGE,
            HexConfig.MAX_COMMITMENT_AGE,
            HexConfig.MIN_REGISTER_DURATION
        );
        d.hexRegistry.grantRootRoles(RegistryRolesLib.ROLE_REGISTRAR | RegistryRolesLib.ROLE_RENEW, address(d.registrar));

        d.batchGatewayProvider = new GatewayProvider(admin, new string[](0));
        d.universalResolver = new UniversalResolverV2(d.rootRegistry, d.batchGatewayProvider, d.contractNamer);
        d.resolverImpl = new PermissionedResolver(admin);
    }
}
